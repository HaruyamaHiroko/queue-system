"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStatus = getStatus;
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const dynamodb_1 = require("../../shared/dynamodb");
const dateKey_1 = require("../../shared/dateKey");
const response_1 = require("../../shared/response");
// GET /status — 公開情報取得(共有ディスプレイ画面・管理者画面向け)
// detail-design.md 3.3 の処理フローに対応。パラメータなし・認証不要。
async function getStatus(_event) {
    const now = new Date();
    const counterId = (0, dateKey_1.getCounterId)(now);
    const dateKey = (0, dateKey_1.getDateKey)(now);
    const getResult = await dynamodb_1.docClient.send(new lib_dynamodb_1.GetCommand({
        TableName: dynamodb_1.TABLE_COUNTERS,
        Key: { counterId },
    }));
    // 当日まだ誰も発券していない場合、Countersアイテム自体が存在しない
    const counter = getResult.Item;
    const issuedNumber = counter?.issuedNumber ?? 0;
    const calledNumber = counter?.calledNumber ?? 0;
    const waitingCount = await (0, dynamodb_1.countActiveTicketsInRange)(dateKey, calledNumber + 1, issuedNumber);
    const responseBody = {
        calledNumber,
        issuedNumber,
        waitingCount,
    };
    return (0, response_1.buildSuccessResponse)(200, responseBody);
}
