import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { createTicket } from "./createTicket";
import { cancelTicket } from "./cancelTicket";
import { getStatus } from "./getStatus";
import { getMyStatus } from "./getMyStatus";
import { callNext } from "./callNext";
import { buildCorsHeaders } from "../../shared/cors";
import { handleError } from "../../shared/response";
import { RouteNotFoundError } from "../../shared/errors";

// 単一のLambda関数で全エンドポイントを処理するルーター。
// api-design.md のエンドポイント一覧(メソッド+パス)にそのまま対応する。
// Lambda Function URLsはAPI Gatewayのような自動ルーティングを行わないため、
// event.rawPath と event.requestContext.http.method を見て手動で振り分ける。
export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const method = event.requestContext.http.method;
  const path = event.rawPath;

  // ブラウザが送るCORSプリフライトリクエスト(OPTIONS)に対応。
  // Authorizationヘッダーを送るcall-next呼び出し等でブラウザが自動的に送信する。
  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: buildCorsHeaders(),
      body: "",
    };
  }

  try {
    if (method === "POST" && path === "/tickets") {
      return await createTicket(event);
    }
    if (method === "POST" && /^\/tickets\/\d+\/cancel$/.test(path)) {
      return await cancelTicket(event);
    }
    if (method === "GET" && path === "/status") {
      return await getStatus(event);
    }
    if (method === "POST" && path === "/status/me") {
      return await getMyStatus(event);
    }
    if (method === "POST" && path === "/admin/call-next") {
      return await callNext(event);
    }

    throw new RouteNotFoundError(
      `指定されたパスが見つかりません: ${method} ${path}`
    );
  } catch (error) {
    return handleError(error);
  }
};
