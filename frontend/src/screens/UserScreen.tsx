import { useCallback, useEffect, useState } from "react";
import FacilityHeader from "../components/FacilityHeader";
import RefreshButton from "../components/RefreshButton";
import ConfirmModal from "../components/ConfirmModal";
import { usePolling } from "../hooks/usePolling";
import {
  ApiError,
  cancelTicket,
  createTicket,
  getMyStatus,
  getStatus,
} from "../api/client";
import { MyTicket } from "../types";

const STORAGE_KEY = "queue-system:myTicket";

function loadMyTicket(): MyTicket | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as MyTicket) : null;
  } catch {
    return null;
  }
}

function saveMyTicket(ticket: MyTicket) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ticket));
}

function clearMyTicket() {
  window.localStorage.removeItem(STORAGE_KEY);
}

// B. 利用者向け画面(個人のスマートフォン等)
// 発券前(B-1)/確認ポップアップ(B-2)/発券後(B-3) の3状態を、
// 画面遷移なしで1画面内に持つ。状態判定はlocalStorage(MyTicket)に基づく。
export default function UserScreen() {
  const [myTicket, setMyTicket] = useState<MyTicket | null>(() =>
    loadMyTicket()
  );
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);

  // myTicketの有無で呼び出すAPIを切り替える(発券前: 公開情報 / 発券後: 自分の状況)
  const fetcher = useCallback(() => {
    return myTicket ? getMyStatus(myTicket.ticketToken) : getStatus();
  }, [myTicket]);

  const { data, error, isLoading, refresh } = usePolling(fetcher, 60_000);

  // 発券後の照会が404(=既に呼び出し済み・データ整理等で見つからない)になった場合は、
  // 端末側の情報が古くなっているとみなし、発券前の状態に戻す。
  useEffect(() => {
    if (myTicket && error instanceof ApiError && error.status === 404) {
      clearMyTicket();
      setMyTicket(null);
    }
  }, [error, myTicket]);

  const handleTakeNumberClick = () => {
    setActionError(null);
    setConfirmOpen(true);
  };

  const handleConfirmCancel = () => {
    setConfirmOpen(false);
  };

  const handleConfirmSubmit = async () => {
    if (isSubmitting) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const result = await createTicket();
      const ticket: MyTicket = {
        ticketNumber: result.ticketNumber,
        ticketToken: result.ticketToken,
      };
      saveMyTicket(ticket);
      setMyTicket(ticket);
      setConfirmOpen(false);
      refresh();
    } catch (e) {
      setActionError(
        e instanceof ApiError
          ? e.message
          : "発券に失敗しました。もう一度お試しください。"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelTicket = async () => {
    if (!myTicket || isSubmitting) return;
    setSubmitting(true);
    setActionError(null);
    try {
      await cancelTicket(myTicket.ticketNumber, myTicket.ticketToken);
      clearMyTicket();
      setMyTicket(null);
    } catch (e) {
      setActionError(
        e instanceof ApiError
          ? e.message
          : "キャンセルに失敗しました。もう一度お試しください。"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="screen">
      <FacilityHeader />
      <div className="screen__body">
        <div className="user-card">
          <div className="user-card__refresh">
            <RefreshButton onClick={refresh} isLoading={isLoading} />
          </div>

          {!myTicket ? (
            // B-1. 発券前
            <>
              <p className="user-card__label">ただいまの呼出し番号</p>
              <p className="user-card__number">
                {data ? String(data.calledNumber).padStart(3, "0") : "---"}
              </p>
              <div className="user-card__inline-stat">
                <p className="user-card__inline-stat-label">現在の待機人数</p>
                <p className="user-card__inline-stat-value">
                  {data ? data.waitingCount : "-"}
                </p>
              </div>
              <button
                type="button"
                className="user-card__primary-button"
                onClick={handleTakeNumberClick}
              >
                番号を取る
              </button>
            </>
          ) : (
            // B-3. 発券後
            <>
              <p className="user-card__sub-label">あなたの番号</p>
              <p className="user-card__number user-card__number--accent">
                {String(myTicket.ticketNumber).padStart(3, "0")}
              </p>
              <div className="user-card__stats">
                <div className="user-card__stat">
                  <p className="user-card__stat-label">呼出し中</p>
                  <p className="user-card__stat-value">
                    {data
                      ? String(data.calledNumber).padStart(3, "0")
                      : "---"}
                  </p>
                </div>
                <div className="user-card__stat">
                  <p className="user-card__stat-label">あなたより前</p>
                  <p className="user-card__stat-value">
                    {data ? data.waitingCount : "-"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="user-card__cancel-button"
                onClick={handleCancelTicket}
                disabled={isSubmitting}
              >
                キャンセルする
              </button>
            </>
          )}

          {actionError && <p className="user-card__error">{actionError}</p>}
        </div>
      </div>

      {/* B-2. 確認ポップアップ */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        title="番号を取りますか"
        message="発券後のキャンセルも可能です"
        confirmLabel={isSubmitting ? "処理中..." : "取得する"}
        cancelLabel="やめる"
        onConfirm={handleConfirmSubmit}
        onCancel={handleConfirmCancel}
      />
    </div>
  );
}
