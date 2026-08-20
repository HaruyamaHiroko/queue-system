"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCorsHeaders = buildCorsHeaders;
// フロントエンドはAWS外の別オリジンでホスティングするため、全レスポンスにCORSヘッダーを付与する。
// 許可オリジンは環境変数 FRONTEND_ORIGIN で指定する(例: "https://example.github.io")。
// Lambda Function URLs自体のCORS設定機能と併用してもよいが、
// 関数側でも明示しておくことで動作をコード上で追いやすくする。
function buildCorsHeaders() {
    const origin = process.env.FRONTEND_ORIGIN ?? "*";
    return {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
    };
}
