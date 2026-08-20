import { useCallback, useState } from "react";
import FacilityHeader from "../components/FacilityHeader";
import { usePolling } from "../hooks/usePolling";
import { ApiError, callNext, getStatus } from "../api/client";

// タブを閉じると消える sessionStorage に保持する(localStorageより短命)
const STORAGE_KEY = "queue-system:adminToken";

// C. 管理者操作画面
// 「発券済番号が更新された場合に表示を更新する」という要件のみのため、
// 手動更新ボタンは設けず、60秒間隔の自動ポーリングのみで対応する。
export default function AdminScreen() {
  const [adminToken, setAdminToken] = useState<string | null>(() =>
    window.sessionStorage.getItem(STORAGE_KEY)
  );
  const [tokenInput, setTokenInput] = useState("");

  const [callError, setCallError] = useState<string | null>(null);
  const [callInfo, setCallInfo] = useState<string | null>(null);
  const [isCalling, setIsCalling] = useState(false);

  const fetcher = useCallback(() => getStatus(), []);
  const { data, refresh } = usePolling(fetcher, 60_000);

  const handleLogin = () => {
    if (!tokenInput) return;
    window.sessionStorage.setItem(STORAGE_KEY, tokenInput);
    setAdminToken(tokenInput);
  };

  const handleCallNext = async () => {
    if (!adminToken || isCalling) return;
    setIsCalling(true);
    setCallError(null);
    setCallInfo(null);
    try {
      await callNext(adminToken);
      refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // トークンが無効(誤入力・変更後など)な場合は再ログインさせる
        window.sessionStorage.removeItem(STORAGE_KEY);
        setAdminToken(null);
        setCallError("認証情報が無効です。再度ログインしてください。");
      } else if (e instanceof ApiError && e.status === 409) {
        setCallInfo("呼び出せる番号がありません。");
      } else {
        setCallError(
          e instanceof ApiError
            ? e.message
            : "処理に失敗しました。もう一度お試しください。"
        );
      }
    } finally {
      setIsCalling(false);
    }
  };

  if (!adminToken) {
    return (
      <div className="screen">
        <FacilityHeader />
        <div className="screen__body">
          <div className="admin-login-card">
            <p className="admin-login-card__label">
              管理者トークンを入力してください
            </p>
            <input
              type="password"
              className="admin-login-card__input"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <button
              type="button"
              className="admin-login-card__button"
              onClick={handleLogin}
              disabled={!tokenInput}
            >
              ログイン
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <FacilityHeader />
      <div className="screen__body">
        <div className="admin-card">
          <p className="admin-card__title">窓口管理</p>

          <div className="admin-card__stats">
            <div className="admin-card__stat">
              <p className="admin-card__stat-label">呼出し中</p>
              <p className="admin-card__stat-value">
                {data ? String(data.calledNumber).padStart(3, "0") : "---"}
              </p>
            </div>
            <div className="admin-card__stat">
              <p className="admin-card__stat-label">発券済</p>
              <p className="admin-card__stat-value">
                {data ? String(data.issuedNumber).padStart(3, "0") : "---"}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="admin-card__call-button"
            onClick={handleCallNext}
            disabled={isCalling}
          >
            次の人を呼ぶ
          </button>

          {callInfo && <p className="admin-card__info">{callInfo}</p>}
          {callError && <p className="admin-card__error">{callError}</p>}
        </div>
      </div>
    </div>
  );
}
