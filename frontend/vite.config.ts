import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages(プロジェクトページ)は https://<ユーザー名>.github.io/queue-system/
// のようなサブパス配下で公開されるため、base をリポジトリ名に合わせる。
export default defineConfig({
  base: "/queue-system/",
  plugins: [react()],
});
