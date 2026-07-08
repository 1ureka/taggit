/**
 * @file config.ts
 * server.json 的讀寫 —— collection 根目錄設定的持久化。
 */

import fs from "fs";
import path from "path";
import { log } from "$lib/server/helpers.js";

/**
 * 伺服器組態。
 * 持久化於專案根目錄的 server.json，記錄使用者指定的收藏庫路徑。
 */
export interface ServerConfig {
  /** 收藏庫根目錄的絕對路徑；`undefined` 表示尚未設定 */
  collectionRoot?: string;
}

/** server.json 的絕對路徑（專案根目錄） */
const SERVER_JSON_PATH = path.resolve("server.json");

/**
 * 讀取 server.json 的內容，若檔案不存在則建立空的 `{}`。
 */
export function readServerJson(): ServerConfig {
  log({ level: "info", module: "collection", message: "正在讀取 server.json…" });

  if (!fs.existsSync(SERVER_JSON_PATH)) {
    writeServerJson({});
    log({ level: "info", module: "collection", message: "已建立 server.json" });
  }

  try {
    const raw = fs.readFileSync(SERVER_JSON_PATH, "utf8");
    return JSON.parse(raw) as ServerConfig;
  } catch {
    log({ level: "error", module: "collection", message: "解析 server.json 失敗，將視為空配置" });
    return {};
  }
}

/**
 * 將 server.json 寫入磁碟。
 */
export function writeServerJson(data: ServerConfig): void {
  log({ level: "info", module: "collection", message: "正在寫入 server.json…" });
  fs.writeFileSync(SERVER_JSON_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}
