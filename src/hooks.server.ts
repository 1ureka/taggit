import { requireDatabase } from "$lib/server/db-instance.js";
import { log } from "$lib/server/helpers";

declare global {
  /** 是否已註冊 SIGINT 處理程序 */
  var __sigintRegistered: boolean | undefined;
}

if (!globalThis.__sigintRegistered) {
  globalThis.__sigintRegistered = true;

  const onExit = (signal: string) => {
    log({ level: "info", module: "hooks", message: `接收到 ${signal} 訊號，正在寫入資料庫…` });
    requireDatabase({ allowUnload: true }).db.flush();
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
