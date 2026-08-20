import { useCallback } from "react";
import FacilityHeader from "../components/FacilityHeader";
import RefreshButton from "../components/RefreshButton";
import { usePolling } from "../hooks/usePolling";
import { getStatus } from "../api/client";

// A. 共有ディスプレイ画面(待合室設置用)
// 個人情報は含めず、呼出し中番号・発券済番号・待機人数のみを表示する。
// 60秒間隔の自動更新+手動更新ボタン(usePollingフックで共通化)。
export default function DisplayScreen() {
  const fetcher = useCallback(() => getStatus(), []);
  const { data, error, isLoading, refresh } = usePolling(fetcher, 60_000);

  return (
    <div className="screen">
      <FacilityHeader />
      <div className="screen__body">
        <div className="display-card">
          <div className="display-card__refresh">
            <RefreshButton onClick={refresh} isLoading={isLoading} />
          </div>

          <p className="display-card__label">ただいまの呼出し番号</p>
          <p className="display-card__number">
            {data ? String(data.calledNumber).padStart(3, "0") : "---"}
          </p>

          <div className="display-card__stats">
            <div className="display-card__stat">
              <p className="display-card__stat-label">発券済</p>
              <p className="display-card__stat-value">
                {data ? String(data.issuedNumber).padStart(3, "0") : "---"}
              </p>
            </div>
            <div className="display-card__stat">
              <p className="display-card__stat-label">待機人数</p>
              <p className="display-card__stat-value">
                {data ? data.waitingCount : "-"}
              </p>
            </div>
          </div>

          {error && (
            <p className="display-card__error">
              情報の取得に失敗しました。しばらくしてから更新してください。
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
