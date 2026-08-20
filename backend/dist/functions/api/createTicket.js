"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTicket = createTicket;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const uuid_1 = require("uuid");
const dynamodb_1 = require("../../shared/dynamodb");
const dateKey_1 = require("../../shared/dateKey");
const response_1 = require("../../shared/response");
// POST /tickets — 発券
// detail-design.md 3.1 の処理フローに対応。
// エラーはthrowするのみとし、catchはルーター(index.ts)に一本化する。
async function createTicket(_event) {
    const now = new Date();
    const dateKey = (0, dateKey_1.getDateKey)(now);
    const counterId = (0, dateKey_1.getCounterId)(now);
    // Countersアイテムに対しアトミックにissuedNumberを+1する。
    // アイテムが存在しない場合はUpsert動作でissuedNumber=1として新規作成される。
    const updateResult = await dynamodb_1.docClient.send(new lib_dynamodb_1.UpdateCommand({
        TableName: dynamodb_1.TABLE_COUNTERS,
        Key: { counterId },
        UpdateExpression: "ADD issuedNumber :inc, calledNumber :zero",
        ExpressionAttributeValues: { ":inc": 1, ":zero": 0 },
        ReturnValues: "UPDATED_NEW",
    }));
    const issuedNumber = updateResult.Attributes?.issuedNumber;
    const ticketToken = (0, uuid_1.v4)();
    const expiresAt = (0, dateKey_1.calcExpiresAt)(now);
    const ticketItem = {
        dateKey,
        ticketNumber: (0, dateKey_1.padTicketNumber)(issuedNumber),
        ticketToken,
        status: "issued",
        createdAt: now.toISOString(),
        expiresAt,
    };
    await dynamodb_1.docClient.send(new lib_dynamodb_1.PutCommand({ TableName: dynamodb_1.TABLE_TICKETS, Item: ticketItem }));
    const responseBody = {
        ticketNumber: issuedNumber,
        ticketToken,
    };
    return (0, response_1.buildSuccessResponse)(201, responseBody);
}
