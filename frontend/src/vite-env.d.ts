/// <reference types="vite/client" />

// 単一のLambda関数(ルーター方式)を1つのURLで呼び出す構成。
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_FACILITY_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
