// 全画面共通のヘッダー。施設名を環境変数(VITE_FACILITY_NAME)から表示する。
export default function FacilityHeader() {
  const facilityName = import.meta.env.VITE_FACILITY_NAME || "窓口混雑解消システム";

  return (
    <header className="facility-header">
      <p className="facility-header__name">{facilityName}</p>
    </header>
  );
}
