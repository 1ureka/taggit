/**
 * @file collection/server.ts
 * collection 模組的 server 端入口。
 *
 * 職責：管理「當前是哪個 collection」與其目錄結構 ——
 * server.json 的讀寫、根目錄驗證與初始化、路徑衍生、當前作用中根目錄的記憶。
 * 它不在意 db.json 的內容是否合法（那是 database 模組的事）。
 *
 * 模組外部只能 import 本檔與 {@link ./client.ts}。
 */

import { readServerJson, writeServerJson } from "./internal/config.js";
import { log } from "$lib/utils/server.js";

export { isCollectionValid, getCollectionPaths } from "./internal/structure.js";
export type { CollectionPaths } from "./internal/structure.js";
export type { ServerConfig } from "./internal/config.js";

// ---

declare global {
  /** HMR 保護：在熱重載之間保留當前作用中的 collection 根目錄。 */
  var __activeCollectionRoot: string | null | undefined;
}

/**
 * 回傳當前作用中的 collection 根目錄（純記憶體，不做磁碟 I/O）。
 * 伺服器啟動後尚未經過 layout 啟動流程時為 `null`。
 */
export function getActiveRoot(): string | null {
  return globalThis.__activeCollectionRoot ?? null;
}

/**
 * 設定當前作用中的 collection 根目錄（純記憶體）。
 * 不觸發任何持久化與資料庫載入；呼叫端須自行處理。
 */
export function setActiveRoot(root: string): void {
  globalThis.__activeCollectionRoot = root;
}

// ---

/**
 * 從 server.json 回傳持久化的 collectionRoot，若未設定則回傳 null。
 */
export function getCollectionRoot(): string | null {
  const cfg = readServerJson();
  return cfg.collectionRoot ?? null;
}

/**
 * 將 collectionRoot 寫入 server.json。
 * 不會觸發資料庫載入；呼叫端須自行處理。
 */
export function setCollectionRoot(root: string): void {
  const cfg = readServerJson();
  cfg.collectionRoot = root;
  writeServerJson(cfg);
  log({ level: "info", module: "collection", message: `已設定集合根目錄為：${root}` });
}
