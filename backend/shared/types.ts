// 整理券の状態
export type TicketStatus = "issued" | "called" | "cancelled";

// DynamoDB Ticketsテーブルのアイテム形状
export interface TicketItem {
  dateKey: string; // 例: "DATE#2026-08-17"
  ticketNumber: string; // ゼロ埋め文字列 例: "00042"
  ticketToken: string;
  status: TicketStatus;
  createdAt: string; // ISO8601
  expiresAt: number; // TTL用 Unixタイムスタンプ(秒)
}

// DynamoDB Countersテーブルのアイテム形状
export interface CounterItem {
  counterId: string; // 例: "COUNTER#2026-08-17"
  issuedNumber: number;
  calledNumber: number;
}

// POST /tickets のレスポンス
export interface CreateTicketResponse {
  ticketNumber: number;
  ticketToken: string;
}

// POST /tickets/{ticketNumber}/cancel のレスポンス
export interface CancelTicketResponse {
  ticketNumber: number;
  status: "cancelled";
}

// GET /status, POST /status/me 共通のレスポンス
export interface StatusResponse {
  calledNumber: number;
  issuedNumber: number;
  waitingCount: number;
}

// POST /admin/call-next のレスポンス
export interface CallNextResponse {
  calledNumber: number;
}

// エラーレスポンスのcode一覧(api-design.md / detail-design.md と対応)
export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "TICKET_NOT_FOUND"
  | "CONFLICT"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";
