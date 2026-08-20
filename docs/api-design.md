# API設計書

単一のLambda関数(ルーター方式)がLambda Function URLとして公開する各エンドポイントの仕様。API Gatewayは使用しない。各エンドポイントへの振り分けは、Lambda関数内でリクエストのメソッド・パスを見て行う(detail-design.md 1章参照)。

## エンドポイント一覧

| メソッド | パス | 用途 | 呼び出し元 |
|---|---|---|---|
| POST | /tickets | 発券(整理券番号を発行) | 利用者向け画面 |
| POST | /tickets/{ticketNumber}/cancel | キャンセル | 利用者向け画面 |
| GET | /status | 公開情報(呼出し中番号・発券済番号・全体の待機人数)の取得 | 共有ディスプレイ画面・管理者画面 |
| POST | /status/me | 自分の状況(自分より前の待ち人数)の取得 | 利用者向け画面 |
| POST | /admin/call-next | 次の番号を呼ぶ | 管理者画面 |

## 共通事項

- レスポンスは全て `Content-Type: application/json`
- CORS対応必須(フロントエンドはAWS外の別オリジンでホスティングするため、Lambda Function URL側でCORS設定を行う)
- 管理者用エンドポイント(`/admin/*`)は `Authorization: Bearer <ADMIN_TOKEN>` ヘッダーを必須とする。`ADMIN_TOKEN` はLambda環境変数で管理する固定の秘密文字列
- 利用者向けのキャンセルは、発券時に払い出す `ticketToken`(推測困難なランダム文字列)を用いて本人確認を行う

---

## 1. POST /tickets — 発券

利用者が番号を取得する。

**リクエスト**: ボディなし

**レスポンス 201**
```json
{
  "ticketNumber": 42,
  "ticketToken": "8f3a1c2e-....(ランダム文字列)"
}
```

- `ticketNumber`: 表示・呼び出しに使う整理券番号(連番)
- `ticketToken`: キャンセル時に必要な認証用トークン。ブラウザのlocalStorageに保存する想定

---

## 2. POST /tickets/{ticketNumber}/cancel — キャンセル

利用者が自分の番号をキャンセルする。

**リクエスト**
```json
{
  "ticketToken": "8f3a1c2e-...."
}
```

**レスポンス 200**
```json
{
  "ticketNumber": 42,
  "status": "cancelled"
}
```

**エラー**
- `403 Forbidden`: ticketTokenが一致しない
- `404 Not Found`: 指定番号が存在しない
- `409 Conflict`: 既に呼出し済み、または既にキャンセル済みの番号

---

## 3. GET /status — 現在の状況取得(公開情報)

共有ディスプレイ画面・管理者画面から定期的にポーリングする。パラメータなし、認証不要。

**リクエスト**: パラメータなし

**レスポンス 200**
```json
{
  "calledNumber": 38,
  "issuedNumber": 45,
  "waitingCount": 6
}
```

- `calledNumber`: 現在呼出し中の番号(まだ誰も呼ばれていない場合は0)
- `issuedNumber`: 直近に発行された番号(＝発券済の最大値)
- `waitingCount`: 呼出し中番号より後ろ、発券済番号までの未キャンセル件数(全体の待機人数)

---

## 4. POST /status/me — 自分の状況取得

利用者向け画面(発券後)から定期的にポーリングする。`ticketToken`をボディに含めることで、GETのクエリパラメータやログにトークンが残ることを避ける。

**リクエスト**
```json
{
  "ticketToken": "8f3a1c2e-...."
}
```

**レスポンス 200**
```json
{
  "calledNumber": 38,
  "issuedNumber": 45,
  "waitingCount": 3
}
```

- `waitingCount`: トークンから特定した自分の`ticketNumber`をもとに、呼出し中番号より後ろ、自分の番号の1つ前までの未キャンセル件数(自分より前の待ち人数)

**エラー**
- `404 Not Found`: トークンに一致する整理券が存在しない

---

## 5. POST /admin/call-next — 次の人を呼ぶ

管理者が次の番号を呼び出す。キャンセル済みの番号は自動的にスキップする。

**リクエスト**: ヘッダーに `Authorization: Bearer <ADMIN_TOKEN>`。ボディなし

**レスポンス 200**
```json
{
  "calledNumber": 39
}
```

**エラー**
- `401 Unauthorized`: トークンが不正または未指定
- `409 Conflict`: 呼び出せる番号が残っていない(発券済番号に追いついた)

---

## 6. 今後の設計で確定させる点

- 日次リセット処理をどのエンドポイント/トリガーで行うか(EventBridge Scheduled Rule + Lambdaなど)
- 同時発券時の連番採番の排他制御方式(DynamoDBのアトミックカウンタ機能で対応予定、データ設計フェーズで詳細化)
