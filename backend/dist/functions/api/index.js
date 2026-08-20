"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const createTicket_1 = require("./createTicket");
const cancelTicket_1 = require("./cancelTicket");
const getStatus_1 = require("./getStatus");
const getMyStatus_1 = require("./getMyStatus");
const callNext_1 = require("./callNext");
const cors_1 = require("../../shared/cors");
const response_1 = require("../../shared/response");
const errors_1 = require("../../shared/errors");
// 単一のLambda関数で全エンドポイントを処理するルーター。
// api-design.md のエンドポイント一覧(メソッド+パス)にそのまま対応する。
// Lambda Function URLsはAPI Gatewayのような自動ルーティングを行わないため、
// event.rawPath と event.requestContext.http.method を見て手動で振り分ける。
const handler = async (event) => {
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    // ブラウザが送るCORSプリフライトリクエスト(OPTIONS)に対応。
    // Authorizationヘッダーを送るcall-next呼び出し等でブラウザが自動的に送信する。
    if (method === "OPTIONS") {
        return {
            statusCode: 204,
            headers: (0, cors_1.buildCorsHeaders)(),
            body: "",
        };
    }
    try {
        if (method === "POST" && path === "/tickets") {
            return await (0, createTicket_1.createTicket)(event);
        }
        if (method === "POST" && /^\/tickets\/\d+\/cancel$/.test(path)) {
            return await (0, cancelTicket_1.cancelTicket)(event);
        }
        if (method === "GET" && path === "/status") {
            return await (0, getStatus_1.getStatus)(event);
        }
        if (method === "POST" && path === "/status/me") {
            return await (0, getMyStatus_1.getMyStatus)(event);
        }
        if (method === "POST" && path === "/admin/call-next") {
            return await (0, callNext_1.callNext)(event);
        }
        throw new errors_1.RouteNotFoundError(`指定されたパスが見つかりません: ${method} ${path}`);
    }
    catch (error) {
        return (0, response_1.handleError)(error);
    }
};
exports.handler = handler;
