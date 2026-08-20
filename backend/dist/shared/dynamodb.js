"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TICKET_TOKEN_INDEX = exports.TABLE_TICKETS = exports.TABLE_COUNTERS = exports.docClient = void 0;
exports.countActiveTicketsInRange = countActiveTicketsInRange;
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dateKey_1 = require("./dateKey");
// クライアントはLambdaの実行コンテキスト間で使い回すため、モジュールスコープで1度だけ生成する
// (コールドスタート後のウォームな呼び出しでは再利用され、初期化コストを節約できる)。
const ddbClient = new client_dynamodb_1.DynamoDBClient({});
exports.docClient = lib_dynamodb_1.DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: { removeUndefinedValues: true },
});
// テーブル名・インデックス名は環境変数から取得(未設定時は開発用のデフォルト名にフォールバック)
exports.TABLE_COUNTERS = process.env.COUNTERS_TABLE_NAME ?? "Counters";
exports.TABLE_TICKETS = process.env.TICKETS_TABLE_NAME ?? "Tickets";
exports.TICKET_TOKEN_INDEX = process.env.TICKET_TOKEN_INDEX_NAME ?? "ticketToken-index";
// 指定範囲(fromNumber 〜 toNumber、両端含む)にある未キャンセルの整理券数を数える。
// GET /status と POST /status/me の両方で使う共通ロジック(範囲が異なるだけ)。
// data-design.md の Query 仕様に対応する。
async function countActiveTicketsInRange(dateKey, fromNumber, toNumber) {
    // 呼出し中番号が発券済(または自分の番号)に追いついている場合は範囲が存在しないため、
    // クエリを発行するまでもなく0件
    if (fromNumber > toNumber) {
        return 0;
    }
    const result = await exports.docClient.send(new lib_dynamodb_1.QueryCommand({
        TableName: exports.TABLE_TICKETS,
        KeyConditionExpression: "dateKey = :dateKey AND ticketNumber BETWEEN :from AND :to",
        FilterExpression: "#status <> :cancelled",
        ExpressionAttributeNames: {
            "#status": "status",
        },
        ExpressionAttributeValues: {
            ":dateKey": dateKey,
            ":from": (0, dateKey_1.padTicketNumber)(fromNumber),
            ":to": (0, dateKey_1.padTicketNumber)(toNumber),
            ":cancelled": "cancelled",
        },
        Select: "COUNT",
    }));
    return result.Count ?? 0;
}
