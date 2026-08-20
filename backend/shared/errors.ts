import { ErrorCode } from "./types";

// 全てのカスタムエラーの基底クラス。
// httpStatus と errorCode を持たせ、共通のレスポンス生成処理(response.ts)で
// そのままHTTPレスポンスに変換できるようにする。
export abstract class AppError extends Error {
  abstract readonly httpStatus: number;
  abstract readonly errorCode: ErrorCode;
}

// 入力値が不正なとき(400)
export class ValidationError extends AppError {
  readonly httpStatus = 400;
  readonly errorCode: ErrorCode = "VALIDATION_ERROR";
}

// 管理者トークンが不正・未指定のとき(401)
export class UnauthorizedError extends AppError {
  readonly httpStatus = 401;
  readonly errorCode: ErrorCode = "UNAUTHORIZED";
}

// ticketTokenが一致しないとき(403)
export class ForbiddenError extends AppError {
  readonly httpStatus = 403;
  readonly errorCode: ErrorCode = "FORBIDDEN";
}

// 該当する整理券が存在しないとき(404)
export class NotFoundError extends AppError {
  readonly httpStatus = 404;
  readonly errorCode: ErrorCode = "TICKET_NOT_FOUND";
}

// リクエストされたパス・メソッドの組み合わせがどのルートにも一致しないとき(404)
export class RouteNotFoundError extends AppError {
  readonly httpStatus = 404;
  readonly errorCode: ErrorCode = "NOT_FOUND";
}

// 状態不整合のとき(409) 例: 既にキャンセル済み、呼び出せる番号が残っていない
export class ConflictError extends AppError {
  readonly httpStatus = 409;
  readonly errorCode: ErrorCode = "CONFLICT";
}
