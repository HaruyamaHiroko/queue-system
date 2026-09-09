// フロントエンドはAWS外の別オリジンでホスティングするため、全レスポンスにCORSヘッダーを付与する。
// 許可オリジンは環境変数 FRONTEND_ORIGIN にカンマ区切りで複数指定できる
// (例: "https://example.github.io,http://localhost:5173")。
// これにより、本番URLとローカル開発サーバーを同時に許可できる。
//
// リクエストのOriginヘッダー(requestOrigin)が許可リストに含まれていれば、
// そのオリジンをそのまま Access-Control-Allow-Origin として返す。
// 含まれていない場合は許可リストの先頭を返す(未許可オリジンからの実際のデータ取得は
// いずれにせよブラウザ側でブロックされるため、実害はない)。
export function buildCorsHeaders(requestOrigin?: string): Record<string, string> {
  const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "*")
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);

  const origin =
    requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0] ?? "*";

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
}
