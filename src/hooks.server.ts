import { Database } from "$lib/poc/database";
import { log } from "$lib/utils/server.js";

declare global {
  /** 是否已註冊 SIGINT 處理程序 */
  var __sigintRegistered: boolean | undefined;
}

if (!globalThis.__sigintRegistered) {
  globalThis.__sigintRegistered = true;

  const onExit = (signal: string) => {
    log({ level: "info", module: "hooks", message: `接收到 ${signal} 訊號，正在寫入資料庫…` });
    Database.flush();
    log({ level: "info", module: "hooks", message: "資料庫寫入完成，正在退出…" });
    process.exit(0);
  };

  process.on("SIGINT", () => {
    onExit("SIGINT");
  });

  process.on("SIGTERM", () => {
    onExit("SIGTERM");
  });
}
