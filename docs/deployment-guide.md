# AWSデプロイ手順書(AWS CLI)

リージョンは東京(`ap-northeast-1`)を前提とする。変更する場合は各コマンドの`--region`を書き換える。

## 0. 前提条件

- AWS CLIがインストール・認証設定済みであること(`aws configure`済み)
- 以下でアカウントIDを控えておく

```bash
aws sts get-caller-identity --query Account --output text
# 例: 123456789012 (以降 <ACCOUNT_ID> と表記)
```

- `aws configure sso`を実行した場合、コマンドの末尾に`--profile <PROFILE_NAME>`(実行時に設定したプロファイル名)をつけるか、環境変数を指定する
```bash
export AWS_PROFILE=<PROFILE_NAME>
```
---

## 1. DynamoDB: Countersテーブル作成

**重要**: Always Free枠(25 RCU/25 WCU)はプロビジョンドモード限定。オンデマンドモードは対象外で課金が発生するため、必ず`PROVISIONED`を明示する。

```bash
aws dynamodb create-table \
  --table-name Counters \
  --attribute-definitions AttributeName=counterId,AttributeType=S \
  --key-schema AttributeName=counterId,KeyType=HASH \
  --billing-mode PROVISIONED \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region ap-northeast-1
```

---

## 2. DynamoDB: Ticketsテーブル作成(GSI付き)

GSI `ticketToken-index` は パーティションキー`dateKey`+ソートキー`ticketToken`(data-design.md参照)。

```bash
aws dynamodb create-table \
  --table-name Tickets \
  --attribute-definitions \
      AttributeName=dateKey,AttributeType=S \
      AttributeName=ticketNumber,AttributeType=S \
      AttributeName=ticketToken,AttributeType=S \
  --key-schema \
      AttributeName=dateKey,KeyType=HASH \
      AttributeName=ticketNumber,KeyType=RANGE \
  --billing-mode PROVISIONED \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --global-secondary-indexes '[
    {
      "IndexName": "ticketToken-index",
      "KeySchema": [
        {"AttributeName":"dateKey","KeyType":"HASH"},
        {"AttributeName":"ticketToken","KeyType":"RANGE"}
      ],
      "Projection": {"ProjectionType":"ALL"},
      "ProvisionedThroughput": {"ReadCapacityUnits":5,"WriteCapacityUnits":5}
    }
  ]' \
  --region ap-northeast-1
```

(Counters 5+5 / Tickets 5+5 / GSI 5+5 = 合計15 RCU・15 WCU。25の上限に余裕あり)

テーブル作成完了まで少し時間がかかるため、以下で状態を確認できる。

```bash
aws dynamodb describe-table --table-name Tickets --region ap-northeast-1 --query "Table.TableStatus"
# "ACTIVE" になったら完了
```

---

## 3. DynamoDB: TicketsテーブルのTTL設定

data-design.mdで決めた`expiresAt`属性をTTLに指定する。

```bash
aws dynamodb update-time-to-live \
  --table-name Tickets \
  --time-to-live-specification "Enabled=true,AttributeName=expiresAt" \
  --region ap-northeast-1
```

---

## 4. IAM: Lambda実行ロールの作成

**信頼ポリシー**(Lambdaサービスがこのロールを引き受けられるようにする)を作成する。

```bash
cat > lambda-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "lambda.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
  --role-name queue-system-lambda-role \
  --assume-role-policy-document file://lambda-trust-policy.json
```

**CloudWatch Logsへの書き込み権限**(AWS管理ポリシー)を付与する。

```bash
aws iam attach-role-policy \
  --role-name queue-system-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

**DynamoDBアクセス権限**(2テーブル+GSIへの読み書きのみに限定したカスタムポリシー)を作成・付与する。`<ACCOUNT_ID>`は実際の値に置き換える。

```bash
cat > dynamodb-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:ap-northeast-1:<ACCOUNT_ID>:table/Counters",
        "arn:aws:dynamodb:ap-northeast-1:<ACCOUNT_ID>:table/Tickets",
        "arn:aws:dynamodb:ap-northeast-1:<ACCOUNT_ID>:table/Tickets/index/ticketToken-index"
      ]
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name queue-system-lambda-role \
  --policy-name queue-system-dynamodb-access \
  --policy-document file://dynamodb-policy.json
```

ロール作成直後はAWS内部での伝播に数秒〜十数秒かかることがあるため、次のLambda作成でエラーが出た場合は少し待って再実行する。

---

## 5. Lambda関数のビルド・パッケージング

```bash
cd backend
npm install
npm run build   # tsconfig.jsonのoutDir(dist)にコンパイル結果が出力される

# dist配下にnode_modules・package.jsonを同梱してzip化する
cd dist
cp -r ../node_modules .
cp ../package.json .
zip -r ../function.zip .
cd ..
```

これで`backend/function.zip`ができる(中身: `functions/api/index.js`等 + `node_modules` + `package.json`)。

---

## 6. Lambda関数の作成

```bash
aws lambda create-function \
  --function-name queue-system-api \
  --runtime nodejs24.x \
  --role arn:aws:iam::<ACCOUNT_ID>:role/queue-system-lambda-role \
  --handler functions/api/index.handler \
  --zip-file fileb://function.zip \
  --timeout 10 \
  --memory-size 256 \
  --region ap-northeast-1
```

**ランタイムの保守について**: Node.jsランタイムには終了時期(EOL)がある。AWSからランタイム終了通知のメールが届いたら、以下でコード変更なしに切り替えられる(async/awaitベースのハンドラーである限り、コールバック形式廃止等の影響を受けない)。

```bash
aws lambda update-function-configuration \
  --function-name queue-system-api \
  --runtime <新しいランタイム名> \
  --region ap-northeast-1
```

---

## 7. 環境変数の設定

`ADMIN_TOKEN`は管理者操作画面のログインで入力する秘密文字列。`FRONTEND_ORIGIN`はフロントエンドの公開URL(GitHub Pages等、まだ決まっていなければ後で更新可能)。

```bash
aws lambda update-function-configuration \
  --function-name queue-system-api \
  --environment "Variables={COUNTERS_TABLE_NAME=Counters,TICKETS_TABLE_NAME=Tickets,TICKET_TOKEN_INDEX_NAME=ticketToken-index,ADMIN_TOKEN=<好きな秘密文字列>,FRONTEND_ORIGIN=<フロントエンドの公開URL>}" \
  --region ap-northeast-1
```

---

## 8. Lambda Function URLの作成

コード側(`shared/cors.ts`)でCORSヘッダーを付与する設計のため、Function URL自体の認証は`NONE`(誰でも呼び出せる=公開API)にする。

```bash
aws lambda create-function-url-config \
  --function-name queue-system-api \
  --auth-type NONE \
  --region ap-northeast-1
```

Function URLを公開で呼び出せるようにするための、リソースベースポリシーの許可を追加する。**2025年10月以降、`lambda:InvokeFunctionUrl`と`lambda:InvokeFunction`の両方の権限が必要**になったため、2つのコマンドを別々に実行する(片方だけだと403 Forbiddenになる)。

```bash
# 1. lambda:InvokeFunctionUrl の許可
aws lambda add-permission \
  --function-name queue-system-api \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region ap-northeast-1

# 2. lambda:InvokeFunction の許可(--invoked-via-function-url フラグを使う。
#    --function-url-auth-type は lambda:InvokeFunctionUrl 専用のオプションなので
#    ここでは使えない点に注意)
aws lambda add-permission \
  --function-name queue-system-api \
  --statement-id FunctionURLAllowPublicAccessInvoke \
  --action lambda:InvokeFunction \
  --principal "*" \
  --invoked-via-function-url \
  --region ap-northeast-1
```

作成したURLを確認する。

```bash
aws lambda get-function-url-config \
  --function-name queue-system-api \
  --region ap-northeast-1 \
  --query FunctionUrl --output text
```

---

## 9. 動作確認

上記で取得したURL(例: `https://xxxxxxxxxx.lambda-url.ap-northeast-1.on.aws/`)に対して、`GET /status`を呼んでみる。

```bash
curl "https://xxxxxxxxxx.lambda-url.ap-northeast-1.on.aws/status"
# {"calledNumber":0,"issuedNumber":0,"waitingCount":0} が返れば成功
```

成功したら、フロントエンドの`.env`の`VITE_API_BASE_URL`にこのURL(末尾のスラッシュなし)を設定する。

```
VITE_API_BASE_URL=https://xxxxxxxxxx.lambda-url.ap-northeast-1.on.aws
```

---

## 10. コード修正後の再デプロイ

Lambda関数のコードを修正した場合は、5章のzip作成をやり直し、以下で更新する(テーブル・ロール・Function URLの再作成は不要)。

```bash
cd backend
npm run build
cd dist
cp -r ../node_modules .
cp ../package.json .
zip -r ../function.zip .
cd ..

aws lambda update-function-code \
  --function-name queue-system-api \
  --zip-file fileb://function.zip \
  --region ap-northeast-1
```
