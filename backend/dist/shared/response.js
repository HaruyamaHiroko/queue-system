"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSuccessResponse = buildSuccessResponse;
exports.handleError = handleError;
const cors_1 = require("./cors");
const errors_1 = require("./errors");
// 成功レスポンスを生成する。
// Lambda Function URLsは API Gateway HTTP API (payload format 2.0) と同じ
// レスポンス形式を使うため、APIGatewayProxyStructuredResultV2型を利用する。
function buildSuccessResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json",
            ...(0, cors_1.buildCorsHeaders)(),
        },
        body: JSON.stringify(body),
    };
}
// エラーレスポンスを生成する(api-design.md / detail-design.md のフォーマットに準拠)。
function buildErrorBody(code, message) {
    return { error: { code, message } };
}
// 各Lambda関数のエントリポイントのcatch節から呼び出す想定。
// AppErrorのサブクラスであればそのステータス・codeを使い、
// それ以外(想定外の例外)は500 INTERNAL_ERRORとして扱う。
function handleError(error) {
    if (error instanceof errors_1.AppError) {
        return {
            statusCode: error.httpStatus,
            headers: {
                "Content-Type": "application/json",
                ...(0, cors_1.buildCorsHeaders)(),
            },
            body: JSON.stringify(buildErrorBody(error.errorCode, error.message)),
        };
    }
    // 想定外のエラーはログに残し、詳細はクライアントに返さない
    console.error("Unexpected error:", error);
    return {
        statusCode: 500,
        headers: {
            "Content-Type": "application/json",
            ...(0, cors_1.buildCorsHeaders)(),
        },
        body: JSON.stringify(buildErrorBody("INTERNAL_ERROR", "サーバー内部でエラーが発生しました")),
    };
}
