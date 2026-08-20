"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConflictError = exports.RouteNotFoundError = exports.NotFoundError = exports.ForbiddenError = exports.UnauthorizedError = exports.ValidationError = exports.AppError = void 0;
// 全てのカスタムエラーの基底クラス。
// httpStatus と errorCode を持たせ、共通のレスポンス生成処理(response.ts)で
// そのままHTTPレスポンスに変換できるようにする。
class AppError extends Error {
}
exports.AppError = AppError;
// 入力値が不正なとき(400)
class ValidationError extends AppError {
    httpStatus = 400;
    errorCode = "VALIDATION_ERROR";
}
exports.ValidationError = ValidationError;
// 管理者トークンが不正・未指定のとき(401)
class UnauthorizedError extends AppError {
    httpStatus = 401;
    errorCode = "UNAUTHORIZED";
}
exports.UnauthorizedError = UnauthorizedError;
// ticketTokenが一致しないとき(403)
class ForbiddenError extends AppError {
    httpStatus = 403;
    errorCode = "FORBIDDEN";
}
exports.ForbiddenError = ForbiddenError;
// 該当する整理券が存在しないとき(404)
class NotFoundError extends AppError {
    httpStatus = 404;
    errorCode = "TICKET_NOT_FOUND";
}
exports.NotFoundError = NotFoundError;
// リクエストされたパス・メソッドの組み合わせがどのルートにも一致しないとき(404)
class RouteNotFoundError extends AppError {
    httpStatus = 404;
    errorCode = "NOT_FOUND";
}
exports.RouteNotFoundError = RouteNotFoundError;
// 状態不整合のとき(409) 例: 既にキャンセル済み、呼び出せる番号が残っていない
class ConflictError extends AppError {
    httpStatus = 409;
    errorCode = "CONFLICT";
}
exports.ConflictError = ConflictError;
