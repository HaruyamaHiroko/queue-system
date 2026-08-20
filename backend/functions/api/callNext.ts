import {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  docClient,
  TABLE_COUNTERS,
  TABLE_TICKETS,
} from "../../shared/dynamodb";
import {
  getCounterId,
  getDateKey,
  padTicketNumber,
} from "../../shared/dateKey";
import { buildSuccessResponse } from "../../shared/response";
import { getHeader } from "../../shared/request";
import { ConflictError, UnauthorizedError } from "../../shared/errors";
import { CallNextResponse, CounterItem, TicketItem } from "../../shared/types";

// POST /admin/call-next — 次の人を呼ぶ(管理者操作画面向け)
// detail-design.md 3.5 の処理フローに対応。
export async function callNext(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyStructuredResultV2> {
  const expectedToken = process.env.ADMIN_TOKEN;
  const authHeader = getHeader(event, "Authorization");
  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    throw new UnauthorizedError("認証情報が不正、または未指定です");
  }

  const now = new Date();
  const dateKey = getDateKey(now);
  const counterId = getCounterId(now);

  const getResult = await docClient.send(
    new GetCommand({
      TableName: TABLE_COUNTERS,
      Key: { counterId },
    })
  );

  const counter = getResult.Item as CounterItem | undefined;
  const issuedNumber = counter?.issuedNumber ?? 0;
  const initialCalledNumber = counter?.calledNumber ?? 0;

  if (initialCalledNumber >= issuedNumber) {
    throw new ConflictError("呼び出せる番号が残っていません");
  }

  // キャンセル済みの番号は自動的にスキップして次の番号へ進める。
  // 繰り返し回数の上限は「残り件数」に制限する(これを超えて進めることは原理上ない)。
  const maxIterations = issuedNumber - initialCalledNumber;
  let calledNumber = initialCalledNumber;

  for (let i = 0; i < maxIterations; i++) {
    const updateResult = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_COUNTERS,
        Key: { counterId },
        UpdateExpression: "ADD calledNumber :inc",
        ExpressionAttributeValues: { ":inc": 1 },
        ReturnValues: "UPDATED_NEW",
      })
    );
    calledNumber = updateResult.Attributes?.calledNumber as number;

    const ticketResult = await docClient.send(
      new GetCommand({
        TableName: TABLE_TICKETS,
        Key: { dateKey, ticketNumber: padTicketNumber(calledNumber) },
      })
    );
    const ticketItem = ticketResult.Item as TicketItem | undefined;

    if (ticketItem?.status === "cancelled") {
      // キャンセル済みならこの番号はスキップし、ループを続けてさらに1つ進める
      continue;
    }

    // ticketItemが存在しない場合(データ不整合)は、issued相当として扱い
    // ステータス更新はスキップしてそのまま呼び出し確定とする(安全側のフォールバック)
    if (ticketItem) {
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_TICKETS,
          Key: { dateKey, ticketNumber: padTicketNumber(calledNumber) },
          UpdateExpression: "SET #status = :called",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":called": "called" },
        })
      );
    }

    const responseBody: CallNextResponse = { calledNumber };
    return buildSuccessResponse(200, responseBody);
  }

  // 上限まで繰り返しても確定しなかった(=残り全てキャンセル済みだった)場合
  throw new ConflictError("呼び出せる番号が残っていません");
}
