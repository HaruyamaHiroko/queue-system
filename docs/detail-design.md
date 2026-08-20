# 詳細設計書

## 1. プロジェクト構成(フォルダ構成)

```
queue-system/
├── backend/
│   ├── functions/
│   │   └── api/                     … 単一Lambda関数(ルーター方式)
│   │       ├── index.ts             … エントリポイント。method+pathで各処理に振り分け
│   │       ├── createTicket.ts      … POST /tickets
│   │       ├── cancelTicket.ts      … POST /tickets/{ticketNumber}/cancel
│   │       ├── getStatus.ts         … GET /status
│   │       ├── getMyStatus.ts       … POST /status/me
│   │       └── callNext.ts          … POST /admin/call-next
│   ├── shared/
│   │   ├── dynamodb.ts          … DynamoDBクライアントの初期化・共通操作
│   │   ├── cors.ts              … CORSヘッダー付与の共通処理
│   │   ├── response.ts          … 成功/エラーレスポンスの統一フォーマット生成
│   │   ├── errors.ts            … カスタムエラークラス群
│   │   ├── request.ts           … パスパラメータ・JSONボディ・ヘッダーの解析処理
│   │   ├── dateKey.ts           … 日付キー(DATE#yyyy-mm-dd)生成処理
│   │   └── types.ts             … 共通型定義
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── screens/
│   │   │   ├── DisplayScreen.tsx    … A. 共有ディスプレイ画面
│   │   │   ├── UserScreen.tsx       … B. 利用者向け画面(状態はこの中で管理)
│   │   │   └── AdminScreen.tsx      … C. 管理者操作画面
│   │   ├── components/
│   │   │   ├── FacilityHeader.tsx   … 施設名ヘッダー(共通)
│   │   │   ├── ConfirmModal.tsx     … 発券確認ポップアップ
│   │   │   └── RefreshButton.tsx    … 手動更新ボタン(共通)
│   │   ├── hooks/
│   │   │   └── usePolling.ts        … 60秒間隔の自動ポーリング共通フック
│   │   ├── api/
│   │   │   └── client.ts            … fetchラッパー(エラーハンドリング共通化)
│   │   └── types.ts                 … フロントエンド用の型定義(backend/shared/types.tsと整合)
│   ├── vite.config.ts
│   └── package.json
└── docs/
    ├── requirements.md
    ├── api-design.md
    ├── data-design.md
    └── detail-design.md（本ファイル）
```

Lambda関数は**1つに統合**し、`functions/api/index.ts`がエントリポイントとなる。Lambda Function URLsはAPI Gatewayと異なり自動ルーティングを行わないため、`index.ts`が`event.rawPath`・`event.requestContext.http.method`を見て各処理(`createTicket`等)に振り分ける「ルーター」の役割を持つ。各処理ファイルはtry-catchを持たず、エラーはthrowするのみとし、`index.ts`側で一括して`handleError`に渡す構成にしている。

---

## 2. バックエンド共通処理

### 2.1 CORSヘッダー(`shared/cors.ts`)
フロントエンドがAWS外のオリジンでホスティングされるため、全レスポンスに以下を付与する。

```
Access-Control-Allow-Origin: <フロントエンドの公開URL>
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

Lambda Function URLsのCORS設定機能で対応するか、関数内で明示的にヘッダーを付与するかは実装時に選択(いずれも可能)。

### 2.2 エラーレスポンスの統一フォーマット(`shared/response.ts`)

```json
{
  "error": {
    "code": "TICKET_NOT_FOUND",
    "message": "指定された整理券が見つかりません"
  }
}
```

| HTTPステータス | code | 用途 |
|---|---|---|
| 400 | VALIDATION_ERROR | 入力値不正 |
| 401 | UNAUTHORIZED | 管理者トークン不正・未指定 |
| 403 | FORBIDDEN | ticketTokenの不一致 |
| 404 | TICKET_NOT_FOUND | 該当する整理券が存在しない |
| 409 | CONFLICT | 状態不整合(既にキャンセル済み・呼び出す番号が残っていない等) |
| 500 | INTERNAL_ERROR | 想定外のサーバーエラー |

成功時は各エンドポイントのレスポンス例(api-design.md参照)をそのまま返す(共通の成功ラッパーは設けない)。

### 2.3 カスタムエラークラス(`shared/errors.ts`)
`ValidationError` `UnauthorizedError` `ForbiddenError` `NotFoundError` `ConflictError` `RouteNotFoundError` を定義し、各処理のロジックでthrowする。**try-catchはルーター(`functions/api/index.ts`)に一本化**しており、各処理ファイル(`createTicket.ts`等)はエラーをthrowするだけでよい。ルーター側でエラークラスの種類に応じて2.2の対応表通りのHTTPステータス・codeに変換する。

### 2.4 日付キー生成(`shared/dateKey.ts`)
JSTの日付を`DATE#yyyy-mm-dd`形式で返す関数。全Lambda関数で共通利用し、日付の算出ロジックが分散しないようにする。

---

## 3. エンドポイント別 詳細設計

### 3.1 POST /tickets(create-ticket)

**処理フロー**
1. `dateKey`を算出(`DATE#2026-08-17`など)
2. `Counters`テーブルに対し `UpdateItem`(`ADD issuedNumber 1`)。存在しなければ`issuedNumber=1`で新規作成(`UpdateItem`のUpsert動作を利用)
3. 採番された`issuedNumber`をゼロ埋めし`ticketNumber`(SK)として使用
4. `ticketToken`をUUIDv4で生成
5. `expiresAt`(TTL用、当日の翌々日0時JSTのUnixタイムスタンプ)を算出
6. `Tickets`テーブルに `PutItem`(`status: "issued"`, `createdAt: 現在時刻ISO8601`, `expiresAt`)
7. `{ ticketNumber, ticketToken }` を201で返す

**バリデーション**: リクエストボディなしのため入力チェック不要

**エラーケース**: DynamoDBの障害等の500のみ(業務エラーは基本的に発生しない)

---

### 3.2 POST /tickets/{ticketNumber}/cancel(cancel-ticket)

**処理フロー**
1. パスパラメータ`ticketNumber`とボディの`ticketToken`を取得
2. `dateKey`(当日)+`ticketNumber`(ゼロ埋め)で`Tickets`テーブルから`GetItem`
3. アイテムが存在しなければ`NotFoundError`(404)
4. `ticketToken`が一致しなければ`ForbiddenError`(403)
5. `status`が`issued`以外(=`called`または`cancelled`)なら`ConflictError`(409)
6. `status`を`cancelled`に`UpdateItem`
7. `{ ticketNumber, status: "cancelled" }` を200で返す

**バリデーション**: `ticketNumber`が数値形式であること、`ticketToken`が空でないこと(不正なら400)

---

### 3.3 GET /status(get-status)

**処理フロー**
1. `dateKey`(当日)で`Counters`テーブルから`GetItem`。存在しなければ`issuedNumber=0, calledNumber=0`として扱う(=まだ誰も発券していない日)
2. `issuedNumber > calledNumber`の場合のみ、`Tickets`テーブルに範囲Query(data-design.md参照)し`waitingCount`を算出。それ以外は`waitingCount = 0`
3. `{ calledNumber, issuedNumber, waitingCount }` を200で返す

**バリデーション**: なし(パラメータなし)

---

### 3.4 POST /status/me(get-my-status)

**処理フロー**
1. ボディから`ticketToken`を取得(未指定なら`VALIDATION_ERROR`で400)
2. `dateKey`を算出(当日)
3. `ticketToken-index`(GSI)に対し、`dateKey`(当日)と`ticketToken`を条件に`Query`。0件なら`NotFoundError`(404)。過去日のトークンはこの時点で自動的に除外される
4. `dateKey`(当日)で`Counters`テーブルから`GetItem`
5. 自分の`ticketNumber`を上限として範囲Queryし`waitingCount`を算出
6. `{ calledNumber, issuedNumber, waitingCount }` を200で返す

---

### 3.5 POST /admin/call-next(call-next)

**処理フロー**
1. `Authorization: Bearer <token>`ヘッダーを検証。`ADMIN_TOKEN`環境変数と不一致・未指定なら`UnauthorizedError`(401)
2. `dateKey`(当日)で`Counters`テーブルから`GetItem`
3. `calledNumber >= issuedNumber`なら、呼び出せる番号がないため`ConflictError`(409)
4. `UpdateItem`(`ADD calledNumber 1`)で暫定的に1つ進める
5. 該当`ticketNumber`の`Tickets`アイテムを`GetItem`
6. `status`が`cancelled`ならステップ3に戻り繰り返す(スキップ)。`issued`なら`status`を`called`に更新して終了
7. 確定した`calledNumber`を`{ calledNumber }`として200で返す

**ループの上限**: 万一データ不整合で無限ループとなることを避けるため、繰り返し回数の上限(例: 発券可能な最大件数程度)を設け、超えたら500エラーとする

---

## 4. 積み残し・要検討事項

- ~~3.4の補足: ticketToken-indexに日付をまたいだ古いトークンで照会できてしまう問題~~ → GSIのパーティションキーを`dateKey`に変更し解決済み(data-design.md参照)。あわせて`Tickets`テーブルにTTL(`expiresAt`)を設定し、古いデータを自動整理する設計とした
- DynamoDBテーブルの実際の作成(IaC: CDK / SAM / 手動作成のいずれにするか)は本設計では未確定
- フロントエンドの状態管理ライブラリ(useState中心で足りるか、追加ライブラリが必要か)は実装しながら判断
