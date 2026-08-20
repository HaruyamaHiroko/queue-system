import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { padTicketNumber } from "./dateKey";

// クライアントはLambdaの実行コンテキスト間で使い回すため、モジュールスコープで1度だけ生成する
// (コールドスタート後のウォームな呼び出しでは再利用され、初期化コストを節約できる)。
const ddbClient = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

// テーブル名・インデックス名は環境変数から取得(未設定時は開発用のデフォルト名にフォールバック)
export const TABLE_COUNTERS = process.env.COUNTERS_TABLE_NAME ?? "Counters";
export const TABLE_TICKETS = process.env.TICKETS_TABLE_NAME ?? "Tickets";
export const TICKET_TOKEN_INDEX =
  process.env.TICKET_TOKEN_INDEX_NAME ?? "ticketToken-index";

// 指定範囲(fromNumber 〜 toNumber、両端含む)にある未キャンセルの整理券数を数える。
// GET /status と POST /status/me の両方で使う共通ロジック(範囲が異なるだけ)。
// data-design.md の Query 仕様に対応する。
export async function countActiveTicketsInRange(
  dateKey: string,
  fromNumber: number,
  toNumber: number
): Promise<number> {
  // 呼出し中番号が発券済(または自分の番号)に追いついている場合は範囲が存在しないため、
  // クエリを発行するまでもなく0件
  if (fromNumber > toNumber) {
    return 0;
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_TICKETS,
      KeyConditionExpression:
        "dateKey = :dateKey AND ticketNumber BETWEEN :from AND :to",
      FilterExpression: "#status <> :cancelled",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":dateKey": dateKey,
        ":from": padTicketNumber(fromNumber),
        ":to": padTicketNumber(toNumber),
        ":cancelled": "cancelled",
      },
      Select: "COUNT",
    })
  );

  return result.Count ?? 0;
}
