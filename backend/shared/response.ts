import { APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { buildCorsHeaders } from "./cors";
import { AppError } from "./errors";
import { ErrorCode } from "./types";

// 成功レスポンスを生成する。
// Lambda Function URLsは API Gateway HTTP API (payload format 2.0) と同じ
// レスポンス形式を使うため、APIGatewayProxyStructuredResultV2型を利用する。
// requestOrigin はリクエストの Origin ヘッダー。複数許可オリジンのうち
// どれを Access-Control-Allow-Origin として返すか判定するために使う(shared/cors.ts参照)。
export function buildSuccessResponse(
  statusCode: number,
  body: unknown,
  requestOrigin?: string
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...buildCorsHeaders(requestOrigin),
    },
    body: JSON.stringify(body),
  };
}

// エラーレスポンスを生成する(api-design.md / detail-design.md のフォーマットに準拠)。
function buildErrorBody(code: ErrorCode, message: string) {
  return { error: { code, message } };
}

// ルーター(functions/api/index.ts)のcatch節から呼び出す想定。
// AppErrorのサブクラスであればそのステータス・codeを使い、
// それ以外(想定外の例外)は500 INTERNAL_ERRORとして扱う。
export function handleError(
  error: unknown,
  requestOrigin?: string
): APIGatewayProxyStructuredResultV2 {
  if (error instanceof AppError) {
    return {
      statusCode: error.httpStatus,
      headers: {
        "Content-Type": "application/json",
        ...buildCorsHeaders(requestOrigin),
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
      ...buildCorsHeaders(requestOrigin),
    },
    body: JSON.stringify(
      buildErrorBody("INTERNAL_ERROR", "サーバー内部でエラーが発生しました")
    ),
  };
}
