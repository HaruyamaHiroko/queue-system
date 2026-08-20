import {
  ApiErrorBody,
  CallNextResponse,
  CancelTicketResponse,
  CreateTicketResponse,
  StatusResponse,
} from "../types";

// 単一のLambda関数(ルーター方式)のベースURL。
// api-design.mdのパスをこの末尾に付与して呼び出す。
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

// APIエラーをアプリ内で扱いやすくするためのカスタムエラークラス。
// backend/shared/errors.ts の errorCode 一覧と対応する。
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// fetchの共通ラッパー。エラーレスポンス(api-design.mdの統一フォーマット)を
// ApiErrorに変換してthrowする。
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let code = "UNKNOWN_ERROR";
    let message = `リクエストに失敗しました(status: ${res.status})`;
    try {
      const body = (await res.json()) as ApiErrorBody;
      code = body.error.code;
      message = body.error.message;
    } catch {
      // レスポンスボディがJSONでない場合はデフォルトメッセージのまま
    }
    throw new ApiError(res.status, code, message);
  }

  return res.json() as Promise<T>;
}

// POST /tickets — 発券
export function createTicket(): Promise<CreateTicketResponse> {
  return request<CreateTicketResponse>("/tickets", { method: "POST" });
}

// POST /tickets/{ticketNumber}/cancel — キャンセル
export function cancelTicket(
  ticketNumber: number,
  ticketToken: string
): Promise<CancelTicketResponse> {
  return request<CancelTicketResponse>(`/tickets/${ticketNumber}/cancel`, {
    method: "POST",
    body: JSON.stringify({ ticketToken }),
  });
}

// GET /status — 公開情報取得(共有ディスプレイ・管理者画面用)
export function getStatus(): Promise<StatusResponse> {
  return request<StatusResponse>("/status", { method: "GET" });
}

// POST /status/me — 自分の状況取得(利用者向け画面・発券後)
export function getMyStatus(ticketToken: string): Promise<StatusResponse> {
  return request<StatusResponse>("/status/me", {
    method: "POST",
    body: JSON.stringify({ ticketToken }),
  });
}

// POST /admin/call-next — 次の人を呼ぶ(管理者操作画面用)
export function callNext(adminToken: string): Promise<CallNextResponse> {
  return request<CallNextResponse>("/admin/call-next", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
}
