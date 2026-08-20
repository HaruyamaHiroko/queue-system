import { APIGatewayProxyEventV2 } from "aws-lambda";
import { ValidationError } from "./errors";

// Lambda Function URLsはAPI Gatewayと異なり、{ticketNumber}等のパスパラメータを
// 自動的にはevent.pathParametersへ格納してくれない。
// rawPath(例: "/tickets/42/cancel")をスラッシュで分割し、
// 指定インデックスのセグメントを取り出すための共通処理。
export function getPathSegment(
  event: APIGatewayProxyEventV2,
  index: number
): string | undefined {
  const segments = event.rawPath.split("/").filter((s) => s.length > 0);
  return segments[index];
}

// JSONボディをパースする。Lambda Function URLs経由のリクエストは
// Base64エンコードされている場合があるため、isBase64Encodedを見てデコードする。
export function parseJsonBody<T>(event: APIGatewayProxyEventV2): T {
  if (!event.body) {
    throw new ValidationError("リクエストボディが必要です");
  }
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf-8")
    : event.body;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ValidationError("リクエストボディがJSON形式ではありません");
  }
}

// HTTPヘッダーを大文字小文字を区別せずに取得する。
// (Authorizationヘッダーはクライアントによって"Authorization"/"authorization"等
// 表記が揺れることがあるため)
export function getHeader(
  event: APIGatewayProxyEventV2,
  name: string
): string | undefined {
  const headers = event.headers ?? {};
  const lowerName = name.toLowerCase();
  const key = Object.keys(headers).find((k) => k.toLowerCase() === lowerName);
  return key ? headers[key] : undefined;
}
