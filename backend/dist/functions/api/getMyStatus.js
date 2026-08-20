"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyStatus = getMyStatus;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamodb_1 = require("../../shared/dynamodb");
const dateKey_1 = require("../../shared/dateKey");
const response_1 = require("../../shared/response");
const request_1 = require("../../shared/request");
const errors_1 = require("../../shared/errors");
// POST /status/me — 自分の状況取得(利用者向け画面・発券後)
// detail-design.md 3.4 の処理フローに対応。
async function getMyStatus(event) {
    const body = (0, request_1.parseJsonBody)(event);
    if (!body.ticketToken) {
        throw new errors_1.ValidationError("ticketTokenは必須です");
    }
    const now = new Date();
    const dateKey = (0, dateKey_1.getDateKey)(now);
    const counterId = (0, dateKey_1.getCounterId)(now);
    // ticketToken-index(GSI)を dateKey + ticketToken で検索し、自分の整理券を逆引きする。
    // パーティションキーを当日のdateKeyに限定しているため、過去日のトークンは自動的に0件になる。
    const queryResult = await dynamodb_1.docClient.send(new lib_dynamodb_1.QueryCommand({
        TableName: dynamodb_1.TABLE_TICKETS,
        IndexName: dynamodb_1.TICKET_TOKEN_INDEX,
        KeyConditionExpression: "dateKey = :dateKey AND ticketToken = :token",
        ExpressionAttributeValues: {
            ":dateKey": dateKey,
            ":token": body.ticketToken,
        },
        Limit: 1,
    }));
    const ticketItem = queryResult.Items?.[0];
    if (!ticketItem) {
        throw new errors_1.NotFoundError("指定されたticketTokenに該当する整理券が見つかりません");
    }
    const myTicketNumber = Number(ticketItem.ticketNumber);
    const getResult = await dynamodb_1.docClient.send(new lib_dynamodb_1.GetCommand({
        TableName: dynamodb_1.TABLE_COUNTERS,
        Key: { counterId },
    }));
    const counter = getResult.Item;
    const issuedNumber = counter?.issuedNumber ?? 0;
    const calledNumber = counter?.calledNumber ?? 0;
    // 自分より前の待ち人数 = 呼出し中番号より後ろ、自分の番号の1つ前までの未キャンセル件数
    const waitingCount = await (0, dynamodb_1.countActiveTicketsInRange)(dateKey, calledNumber + 1, myTicketNumber - 1);
    const responseBody = {
        calledNumber,
        issuedNumber,
        waitingCount,
    };
    return (0, response_1.buildSuccessResponse)(200, responseBody);
}
