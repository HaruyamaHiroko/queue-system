import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import {
  countActiveTicketsInRange,
  docClient,
  TABLE_COUNTERS,
  TABLE_TICKETS,
  TICKET_TOKEN_INDEX,
} from "../../shared/dynamodb";
import { getCounterId, getDateKey } from "../../shared/dateKey";
import { buildSuccessResponse } from "../../shared/response";
import { parseJsonBody } from "../../shared/request";
import { NotFoundError, ValidationError } from "../../shared/errors";
import { CounterItem, StatusResponse, TicketItem } from "../../shared/types";

interface GetMyStatusRequestBody {
  ticketToken?: string;
}

// POST /status/me — 自分の状況取得(利用者向け画面・発券後)
// detail-design.md 3.4 の処理フローに対応。
export async function getMyStatus(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  const body = parseJsonBody<GetMyStatusRequestBody>(event);
  if (!body.ticketToken) {
    throw new ValidationError("ticketTokenは必須です");
  }

  const now = new Date();
  const dateKey = getDateKey(now);
  const counterId = getCounterId(now);

  // ticketToken-index(GSI)を dateKey + ticketToken で検索し、自分の整理券を逆引きする。
  // パーティションキーを当日のdateKeyに限定しているため、過去日のトークンは自動的に0件になる。
  const queryResult = await docClient.send(
    new QueryCommand({
      TableName: TABLE_TICKETS,
      IndexName: TICKET_TOKEN_INDEX,
      KeyConditionExpression: "dateKey = :dateKey AND ticketToken = :token",
      ExpressionAttributeValues: {
        ":dateKey": dateKey,
        ":token": body.ticketToken,
      },
      Limit: 1,
    })
  );

  const ticketItem = queryResult.Items?.[0] as TicketItem | undefined;
  if (!ticketItem) {
    throw new NotFoundError(
      "指定されたticketTokenに該当する整理券が見つかりません"
    );
  }

  const myTicketNumber = Number(ticketItem.ticketNumber);

  const getResult = await docClient.send(
    new GetCommand({
      TableName: TABLE_COUNTERS,
      Key: { counterId },
    })
  );

  const counter = getResult.Item as CounterItem | undefined;
  const issuedNumber = counter?.issuedNumber ?? 0;
  const calledNumber = counter?.calledNumber ?? 0;

  // 自分より前の待ち人数 = 呼出し中番号より後ろ、自分の番号の1つ前までの未キャンセル件数
  const waitingCount = await countActiveTicketsInRange(
    dateKey,
    calledNumber + 1,
    myTicketNumber - 1
  );

  const responseBody: StatusResponse = {
    calledNumber,
    issuedNumber,
    waitingCount,
  };

  return buildSuccessResponse(200, responseBody);
}
