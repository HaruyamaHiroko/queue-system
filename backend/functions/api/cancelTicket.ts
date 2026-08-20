import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLE_TICKETS } from "../../shared/dynamodb";
import { getDateKey, padTicketNumber } from "../../shared/dateKey";
import { buildSuccessResponse } from "../../shared/response";
import { getPathSegment, parseJsonBody } from "../../shared/request";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../shared/errors";
import { CancelTicketResponse, TicketItem } from "../../shared/types";

interface CancelTicketRequestBody {
  ticketToken?: string;
}

// POST /tickets/{ticketNumber}/cancel — キャンセル
// detail-design.md 3.2 の処理フローに対応。
export async function cancelTicket(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  // パスは "/tickets/{ticketNumber}/cancel" の形式。
  // セグメント: [0]="tickets" [1]=ticketNumber [2]="cancel"
  const rawTicketNumber = getPathSegment(event, 1);
  if (!rawTicketNumber || !/^\d+$/.test(rawTicketNumber)) {
    throw new ValidationError("ticketNumberは数値で指定してください");
  }
  const ticketNumber = Number(rawTicketNumber);

  const body = parseJsonBody<CancelTicketRequestBody>(event);
  if (!body.ticketToken) {
    throw new ValidationError("ticketTokenは必須です");
  }

  const dateKey = getDateKey();
  const ticketNumberKey = padTicketNumber(ticketNumber);

  const getResult = await docClient.send(
    new GetCommand({
      TableName: TABLE_TICKETS,
      Key: { dateKey, ticketNumber: ticketNumberKey },
    })
  );

  const item = getResult.Item as TicketItem | undefined;
  if (!item) {
    throw new NotFoundError("指定された整理券が見つかりません");
  }

  if (item.ticketToken !== body.ticketToken) {
    throw new ForbiddenError("ticketTokenが一致しません");
  }

  if (item.status !== "issued") {
    throw new ConflictError(
      "この整理券は既にキャンセル済み、または呼び出し済みです"
    );
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_TICKETS,
      Key: { dateKey, ticketNumber: ticketNumberKey },
      UpdateExpression: "SET #status = :cancelled",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":cancelled": "cancelled" },
    })
  );

  const responseBody: CancelTicketResponse = {
    ticketNumber,
    status: "cancelled",
  };

  return buildSuccessResponse(200, responseBody);
}
