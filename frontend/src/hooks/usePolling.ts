import { useCallback, useEffect, useRef, useState } from "react";

interface UsePollingResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  refresh: () => void;
}

// 指定した間隔(デフォルト60秒)で自動的にfetcherを呼び出し、結果をstateに保持するフック。
// 手動更新ボタンから呼び出すための refresh 関数もあわせて返す。
// 共有ディスプレイ画面(A)・利用者向け画面(B-1/B-3)の3箇所で共通利用する。
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs = 60_000
): UsePollingResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 実行中に更新ボタン連打やタイマーの重複実行でリクエストが二重に飛ばないようにする
  const isFetchingRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(() => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    fetcherRef
      .current()
      .then((result) => {
        setData(result);
        setError(null);
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e : new Error(String(e)));
      })
      .finally(() => {
        setIsLoading(false);
        isFetchingRef.current = false;
      });
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  return { data, error, isLoading, refresh };
}
