import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  countActiveTicketsInRange,
  docClient,
  TABLE_COUNTERS,
} from "../../shared/dynamodb";
import { getCounterId, getDateKey } from "../../shared/dateKey";
import { buildSuccessResponse } from "../../shared/response";
import { getHeader } from "../../shared/request";
import { CounterItem, StatusResponse } from "../../shared/types";

// GET /status — 公開情報取得(共有ディスプレイ画面・管理者画面向け)
// detail-design.md 3.3 の処理フローに対応。パラメータなし・認証不要。
export async function getStatus(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  const requestOrigin = getHeader(event, "Origin");
  const now = new Date();
  const counterId = getCounterId(now);
  const dateKey = getDateKey(now);

  const getResult = await docClient.send(
    new GetCommand({
      TableName: TABLE_COUNTERS,
      Key: { counterId },
    })
  );

  // 当日まだ誰も発券していない場合、Countersアイテム自体が存在しない
  const counter = getResult.Item as CounterItem | undefined;
  const issuedNumber = counter?.issuedNumber ?? 0;
  const calledNumber = counter?.calledNumber ?? 0;

  const waitingCount = await countActiveTicketsInRange(
    dateKey,
    calledNumber + 1,
    issuedNumber
  );

  const responseBody: StatusResponse = {
    calledNumber,
    issuedNumber,
    waitingCount,
  };

  return buildSuccessResponse(200, responseBody, requestOrigin);
}
