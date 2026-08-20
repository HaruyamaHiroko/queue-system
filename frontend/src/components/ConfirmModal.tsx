interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// 利用者向け画面(B-1)で「番号を取る」ボタン押下時に表示する確認ポップアップ。
// 誤操作による発券を防ぐ目的(requirements.md 4.1)。
export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = "取得する",
  cancelLabel = "やめる",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-box">
        <p className="modal-title">{title}</p>
        {message && <p className="modal-message">{message}</p>}
        <div className="modal-actions">
          <button type="button" className="modal-cancel" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="modal-confirm" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
