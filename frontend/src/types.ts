// backend/shared/types.ts のレスポンス型と対応(DynamoDB内部の型は含めない)

export interface StatusResponse {
  calledNumber: number;
  issuedNumber: number;
  waitingCount: number;
}

export interface CreateTicketResponse {
  ticketNumber: number;
  ticketToken: string;
}

export interface CancelTicketResponse {
  ticketNumber: number;
  status: "cancelled";
}

export interface CallNextResponse {
  calledNumber: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

// 利用者向け画面でlocalStorageに保存する情報
export interface MyTicket {
  ticketNumber: number;
  ticketToken: string;
}
