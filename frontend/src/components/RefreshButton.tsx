interface RefreshButtonProps {
  onClick: () => void;
  isLoading?: boolean;
}

// 共有ディスプレイ画面・利用者向け画面(発券前/発券後)で共通利用する更新ボタン。
export default function RefreshButton({ onClick, isLoading }: RefreshButtonProps) {
  return (
    <button
      type="button"
      className="refresh-button"
      onClick={onClick}
      disabled={isLoading}
      aria-label="更新"
      title="更新"
    >
      ⟳
    </button>
  );
}
