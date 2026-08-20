"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPathSegment = getPathSegment;
exports.parseJsonBody = parseJsonBody;
exports.getHeader = getHeader;
const errors_1 = require("./errors");
// Lambda Function URLsはAPI Gatewayと異なり、{ticketNumber}等のパスパラメータを
// 自動的にはevent.pathParametersへ格納してくれない。
// rawPath(例: "/tickets/42/cancel")をスラッシュで分割し、
// 指定インデックスのセグメントを取り出すための共通処理。
function getPathSegment(event, index) {
    const segments = event.rawPath.split("/").filter((s) => s.length > 0);
    return segments[index];
}
// JSONボディをパースする。Lambda Function URLs経由のリクエストは
// Base64エンコードされている場合があるため、isBase64Encodedを見てデコードする。
function parseJsonBody(event) {
    if (!event.body) {
        throw new errors_1.ValidationError("リクエストボディが必要です");
    }
    const raw = event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString("utf-8")
        : event.body;
    try {
        return JSON.parse(raw);
    }
    catch {
        throw new errors_1.ValidationError("リクエストボディがJSON形式ではありません");
    }
}
// HTTPヘッダーを大文字小文字を区別せずに取得する。
// (Authorizationヘッダーはクライアントによって"Authorization"/"authorization"等
// 表記が揺れることがあるため)
function getHeader(event, name) {
    const headers = event.headers ?? {};
    const lowerName = name.toLowerCase();
    const key = Object.keys(headers).find((k) => k.toLowerCase() === lowerName);
    return key ? headers[key] : undefined;
}
