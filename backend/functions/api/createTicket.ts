import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import {
  docClient,
  TABLE_COUNTERS,
  TABLE_TICKETS,
} from "../../shared/dynamodb";
import {
  calcExpiresAt,
  getCounterId,
  getDateKey,
  padTicketNumber,
} from "../../shared/dateKey";
import { buildSuccessResponse } from "../../shared/response";
import { getHeader } from "../../shared/request";
import { CreateTicketResponse, TicketItem } from "../../shared/types";

// POST /tickets — 発券
// detail-design.md 3.1 の処理フローに対応。
// エラーはthrowするのみとし、catchはルーター(index.ts)に一本化する。
export async function createTicket(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  const requestOrigin = getHeader(event, "Origin");
  const now = new Date();
  const dateKey = getDateKey(now);
  const counterId = getCounterId(now);

  // Countersアイテムに対しアトミックにissuedNumberを+1する。
  // アイテムが存在しない場合はUpsert動作でissuedNumber=1として新規作成される。
  const updateResult = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_COUNTERS,
      Key: { counterId },
      UpdateExpression: "ADD issuedNumber :inc, calledNumber :zero",
      ExpressionAttributeValues: { ":inc": 1, ":zero": 0 },
      ReturnValues: "UPDATED_NEW",
    })
  );

  const issuedNumber = updateResult.Attributes?.issuedNumber as number;

  const ticketToken = uuidv4();
  const expiresAt = calcExpiresAt(now);

  const ticketItem: TicketItem = {
    dateKey,
    ticketNumber: padTicketNumber(issuedNumber),
    ticketToken,
    status: "issued",
    createdAt: now.toISOString(),
    expiresAt,
  };

  await docClient.send(
    new PutCommand({ TableName: TABLE_TICKETS, Item: ticketItem })
  );

  const responseBody: CreateTicketResponse = {
    ticketNumber: issuedNumber,
    ticketToken,
  };

  return buildSuccessResponse(201, responseBody, requestOrigin);
}
