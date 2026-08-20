"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelTicket = cancelTicket;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamodb_1 = require("../../shared/dynamodb");
const dateKey_1 = require("../../shared/dateKey");
const response_1 = require("../../shared/response");
const request_1 = require("../../shared/request");
const errors_1 = require("../../shared/errors");
// POST /tickets/{ticketNumber}/cancel — キャンセル
// detail-design.md 3.2 の処理フローに対応。
async function cancelTicket(event) {
    // パスは "/tickets/{ticketNumber}/cancel" の形式。
    // セグメント: [0]="tickets" [1]=ticketNumber [2]="cancel"
    const rawTicketNumber = (0, request_1.getPathSegment)(event, 1);
    if (!rawTicketNumber || !/^\d+$/.test(rawTicketNumber)) {
        throw new errors_1.ValidationError("ticketNumberは数値で指定してください");
    }
    const ticketNumber = Number(rawTicketNumber);
    const body = (0, request_1.parseJsonBody)(event);
    if (!body.ticketToken) {
        throw new errors_1.ValidationError("ticketTokenは必須です");
    }
    const dateKey = (0, dateKey_1.getDateKey)();
    const ticketNumberKey = (0, dateKey_1.padTicketNumber)(ticketNumber);
    const getResult = await dynamodb_1.docClient.send(new lib_dynamodb_1.GetCommand({
        TableName: dynamodb_1.TABLE_TICKETS,
        Key: { dateKey, ticketNumber: ticketNumberKey },
    }));
    const item = getResult.Item;
    if (!item) {
        throw new errors_1.NotFoundError("指定された整理券が見つかりません");
    }
    if (item.ticketToken !== body.ticketToken) {
        throw new errors_1.ForbiddenError("ticketTokenが一致しません");
    }
    if (item.status !== "issued") {
        throw new errors_1.ConflictError("この整理券は既にキャンセル済み、または呼び出し済みです");
    }
    await dynamodb_1.docClient.send(new lib_dynamodb_1.UpdateCommand({
        TableName: dynamodb_1.TABLE_TICKETS,
        Key: { dateKey, ticketNumber: ticketNumberKey },
        UpdateExpression: "SET #status = :cancelled",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":cancelled": "cancelled" },
    }));
    const responseBody = {
        ticketNumber,
        status: "cancelled",
    };
    return (0, response_1.buildSuccessResponse)(200, responseBody);
}
