import { Route, Routes } from "react-router-dom";
import DisplayScreen from "./screens/DisplayScreen";
import UserScreen from "./screens/UserScreen";
import AdminScreen from "./screens/AdminScreen";

// ルーティング方針:
//   "/"      … A. 共有ディスプレイ画面(待合室設置用、個人情報なし)
//   "/me"    … B. 利用者向け画面(個人のスマートフォン等)
//   "/admin" … C. 管理者操作画面
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DisplayScreen />} />
      <Route path="/me" element={<UserScreen />} />
      <Route path="/admin" element={<AdminScreen />} />
    </Routes>
  );
}
