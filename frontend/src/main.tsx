import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// GitHub Pages(静的ホスティング)ではサーバー側のルーティングができないため、
// BrowserRouterではなくHashRouterを使う(URLは "/#/me" のような形になる)。
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
