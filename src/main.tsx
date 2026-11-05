import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { I18nProvider } from "./lib/i18n.tsx";
import { clearHandoffWindow } from "./lib/handoff.ts";
import "./index.css";

// 联动快照只在「点考点链接的那一次跳转」里有意义：进场先清掉标签页名字，
// 从 StarQuiz 返回或刷新时都不会把上一场考试的资料留在浏览器标签页上。
clearHandoffWindow();

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const msg = typeof reason === "string" ? reason : reason?.message || "";
  if (msg.includes("WebSocket") || msg.includes("websocket")) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>
);
