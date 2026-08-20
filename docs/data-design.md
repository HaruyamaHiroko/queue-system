# データ設計書(DynamoDB)

## 設計方針

- パーティションキーに日付を含めることで、明示的なリセットバッチを作らずに日次リセットを実現する
- 発券の連番採番は、DynamoDBのアトミックカウンタ(`UpdateItem` + `ADD`)により排他制御する
- 待機人数(waitingCount)は、呼出し中番号より後ろの範囲をQueryし、キャンセルを除いた件数をその都度算出する(単純な累積キャンセル数を引く方式は、キャンセルされた番号が呼出し中番号より前だった場合に不正確になるため採用しない)

---

## テーブル1: Counters

当日の発券・呼出しカウンタを保持する。1日1アイテム。

| 属性名 | 型 | 説明 |
|---|---|---|
| PK (`counterId`) | String | `COUNTER#2026-08-15` のように日付を含む固定文字列 |
| `issuedNumber` | Number | 発券済番号(アトミックカウンタ、`ADD issuedNumber 1`で採番) |
| `calledNumber` | Number | 呼出し中番号(アトミックカウンタ、`ADD calledNumber 1`で更新) |

---

## テーブル2: Tickets

整理券本体。番号ごとに1アイテム。

| 属性名 | 型 | 説明 |
|---|---|---|
| PK (`dateKey`) | String | `DATE#2026-08-15` |
| SK (`ticketNumber`) | String | 番号をゼロ埋めした文字列(例: `00042`)。範囲検索のためゼロ埋め必須 |
| `ticketToken` | String | キャンセル・状況照会時の本人確認用トークン(UUID等) |
| `status` | String | `issued` \| `called` \| `cancelled` |
| `createdAt` | String | 発券日時(ISO8601) |
| `expiresAt` | Number | TTL用のUnixタイムスタンプ(秒)。発券日の翌々日0時(JST)などに設定し、一定期間後にDynamoDBが自動削除する |

### GSI: ticketToken-index
- パーティションキー: `dateKey`
- ソートキー: `ticketToken`
- 用途: `POST /status/me`で、当日の`dateKey`とリクエストボディの`ticketToken`を組み合わせて`Query`し、該当する`ticketNumber`を逆引きするため
- **日またぎ対策**: パーティションキーを`dateKey`にすることで、過去日のticketTokenを指定した場合は自動的に0件(該当なし)となり、古いトークンでの照会を防げる(トークン単体をキーにする設計だと、日付を問わず一致してしまう問題があった)
- Always Free枠は25 RCU/WCU・25GBというテーブル横断の枠のため、GSI追加によるコスト増は発生しない(プロトタイプ規模の利用であれば無料枠内)

### TTL設定
- テーブルのTTL属性として`expiresAt`を指定する
- 発券時に、当日の翌々日0時(JST)を`expiresAt`として設定する(例: 8/17発券分は8/19 00:00 JSTに削除対象となる)
- DynamoDBのTTLは削除タイミングを保証しない(最大48時間程度の遅延がありうる)ため、「即座に消える」ことを前提とした設計にはしない。あくまでストレージ容量の自動整理が目的
- `Counters`テーブルは1日1アイテムかつ件数が少ないため、TTLは設定しない(手動または将来的なバッチ削除で対応)

---

## 主要処理フロー

### 発券(POST /tickets)
1. `Counters`テーブルに対し `UpdateItem` で `ADD issuedNumber 1`、更新後の値を取得
2. `ticketToken`をUUID等で生成
3. `expiresAt`(TTL用、当日の翌々日0時JSTのUnixタイムスタンプ)を算出
4. `Tickets`テーブルに新規アイテムを作成(`status = issued`、`expiresAt`を設定)
5. `ticketNumber`と`ticketToken`をレスポンス

### キャンセル(POST /tickets/{ticketNumber}/cancel)
1. `Tickets`テーブルから該当アイテムを取得
2. `ticketToken`が一致するか確認(不一致なら403)
3. `status`が`issued`であることを確認(`called`や既に`cancelled`なら409)
4. `status`を`cancelled`に更新

### 状況取得・公開情報(GET /status)
1. `Counters`テーブルから`issuedNumber`・`calledNumber`を取得
2. `Tickets`テーブルに対し以下をQuery
   ```
   KeyCondition: dateKey = "DATE#<今日>" AND ticketNumber BETWEEN <calledNumber+1のゼロ埋め> AND <issuedNumberのゼロ埋め>
   FilterExpression: status <> "cancelled"
   Select: COUNT
   ```
3. Queryの件数を`waitingCount`(全体の待機人数)としてレスポンス

### 自分の状況取得(POST /status/me)
1. `Counters`テーブルから`issuedNumber`・`calledNumber`を取得
2. `ticketToken-index`(GSI)に対し、`dateKey`(当日)と`ticketToken`(リクエストボディ)を条件に`Query`。0件なら404(過去日のトークンもここで自動的に除外される)
3. `Tickets`テーブルに対し以下をQuery
   ```
   KeyCondition: dateKey = "DATE#<今日>" AND ticketNumber BETWEEN <calledNumber+1のゼロ埋め> AND <取得したticketNumber-1のゼロ埋め>
   FilterExpression: status <> "cancelled"
   Select: COUNT
   ```
4. Queryの件数を`waitingCount`(自分より前の待ち人数)としてレスポンス

### 次の人を呼ぶ(POST /admin/call-next)
1. `Counters`テーブルに対し `UpdateItem` で `ADD calledNumber 1`、更新後の値を取得
2. `issuedNumber`を超えていないか確認(超えていれば409を返しロールバック)
3. `Tickets`テーブルから該当番号のアイテムを取得し`status`を確認
4. `cancelled`ならステップ1に戻り、さらに次の番号へ進める
5. `issued`なら`status`を`called`に更新し、確定した`calledNumber`をレスポンス