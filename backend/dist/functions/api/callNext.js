"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callNext = callNext;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamodb_1 = require("../../shared/dynamodb");
const dateKey_1 = require("../../shared/dateKey");
const response_1 = require("../../shared/response");
const request_1 = require("../../shared/request");
const errors_1 = require("../../shared/errors");
// POST /admin/call-next — 次の人を呼ぶ(管理者操作画面向け)
// detail-design.md 3.5 の処理フローに対応。
async function callNext(event) {
    const expectedToken = process.env.ADMIN_TOKEN;
    const authHeader = (0, request_1.getHeader)(event, "Authorization");
    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
        throw new errors_1.UnauthorizedError("認証情報が不正、または未指定です");
    }
    const now = new Date();
    const dateKey = (0, dateKey_1.getDateKey)(now);
    const counterId = (0, dateKey_1.getCounterId)(now);
    const getResult = await dynamodb_1.docClient.send(new lib_dynamodb_1.GetCommand({
        TableName: dynamodb_1.TABLE_COUNTERS,
        Key: { counterId },
    }));
    const counter = getResult.Item;
    const issuedNumber = counter?.issuedNumber ?? 0;
    const initialCalledNumber = counter?.calledNumber ?? 0;
    if (initialCalledNumber >= issuedNumber) {
        throw new errors_1.ConflictError("呼び出せる番号が残っていません");
    }
    // キャンセル済みの番号は自動的にスキップして次の番号へ進める。
    // 繰り返し回数の上限は「残り件数」に制限する(これを超えて進めることは原理上ない)。
    const maxIterations = issuedNumber - initialCalledNumber;
    let calledNumber = initialCalledNumber;
    for (let i = 0; i < maxIterations; i++) {
        const updateResult = await dynamodb_1.docClient.send(new lib_dynamodb_1.UpdateCommand({
            TableName: dynamodb_1.TABLE_COUNTERS,
            Key: { counterId },
            UpdateExpression: "ADD calledNumber :inc",
            ExpressionAttributeValues: { ":inc": 1 },
            ReturnValues: "UPDATED_NEW",
        }));
        calledNumber = updateResult.Attributes?.calledNumber;
        const ticketResult = await dynamodb_1.docClient.send(new lib_dynamodb_1.GetCommand({
            TableName: dynamodb_1.TABLE_TICKETS,
            Key: { dateKey, ticketNumber: (0, dateKey_1.padTicketNumber)(calledNumber) },
        }));
        const ticketItem = ticketResult.Item;
        if (ticketItem?.status === "cancelled") {
            // キャンセル済みならこの番号はスキップし、ループを続けてさらに1つ進める
            continue;
        }
        // ticketItemが存在しない場合(データ不整合)は、issued相当として扱い
        // ステータス更新はスキップしてそのまま呼び出し確定とする(安全側のフォールバック)
        if (ticketItem) {
            await dynamodb_1.docClient.send(new lib_dynamodb_1.UpdateCommand({
                TableName: dynamodb_1.TABLE_TICKETS,
                Key: { dateKey, ticketNumber: (0, dateKey_1.padTicketNumber)(calledNumber) },
                UpdateExpression: "SET #status = :called",
                ExpressionAttributeNames: { "#status": "status" },
                ExpressionAttributeValues: { ":called": "called" },
            }));
        }
        const responseBody = { calledNumber };
        return (0, response_1.buildSuccessResponse)(200, responseBody);
    }
    // 上限まで繰り返しても確定しなかった(=残り全てキャンセル済みだった)場合
    throw new errors_1.ConflictError("呼び出せる番号が残っていません");
}
