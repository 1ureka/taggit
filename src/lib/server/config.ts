/**
 * @file config.ts
 * 伺服器組態管理 —— 讀寫 `server.json` 與集合路徑。
 *
 * 本模組的職責：
 *   - 確保 `server.json` 存在並提供讀寫介面。
 *   - 管理 `collectionRoot` 設定。
 *   - 驗證集合根目錄並自動建立 `images/` 子目錄。
 *   - 從集合根路徑衍生所有相關路徑（{@link getCollectionPaths}）。
 */

import fs from "fs";
import path from "path";
import type { ServerConfig, CollectionPaths } from "$lib/types.js";

/** 支援的圖片副檔名 */
export const IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"]);

/** MIME 類型對應表 */
export const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

/** server.json 的絕對路徑（專案根目錄） */
const SERVER_JSON_PATH = path.resolve("server.json");

// ---

/**
 * 確保 server.json 存在。若檔案不存在則建立空的 `{}`。
 * 在首次讀取時呼叫，確保所有程式路徑都是安全的。
 */
export function ensureServerJson(): void {
  if (!fs.existsSync(SERVER_JSON_PATH)) {
    fs.writeFileSync(SERVER_JSON_PATH, "{}\n", "utf8");
    console.log("[config] Created server.json");
  }
}

function readServerJson(): ServerConfig {
  ensureServerJson();
  try {
    const raw = fs.readFileSync(SERVER_JSON_PATH, "utf8");
    return JSON.parse(raw) as ServerConfig;
  } catch {
    console.error("[config] Failed to parse server.json, treating as empty");
    return {};
  }
}

function writeServerJson(data: ServerConfig): void {
  fs.writeFileSync(SERVER_JSON_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// ---

/**
 * 從 server.json 回傳目前的 collectionRoot，若未設定則回傳 null。
 */
export function getCollectionRoot(): string | null {
  const cfg = readServerJson();
  return cfg.collectionRoot ?? null;
}

/**
 * 將 collectionRoot 寫入 server.json。
 * 不會觸發 db.loadCollection()；呼叫端（API 或 hooks）須自行處理。
 */
export function setCollectionRoot(root: string): void {
  const cfg = readServerJson();
  cfg.collectionRoot = root;
  writeServerJson(cfg);
  console.log(`[config] collectionRoot set to: ${root}`);
}

/**
 * 驗證集合根路徑：
 * - 必須是已存在的目錄
 * - 若 images/ 不存在則自動建立
 * 當集合可使用時回傳 true。
 */
export function isCollectionValid(root: string): boolean {
  try {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return false;

    const imagesDir = path.join(root, "images");
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      console.log(`[config] Created directory: ${imagesDir}`);
    }
    return true;
  } catch (e) {
    console.error("[config] isCollectionValid error:", (e as Error).message);
    return false;
  }
}

/**
 * 從集合根路徑衍生所有相關路徑。
 */
export function getCollectionPaths(root: string): CollectionPaths {
  return {
    root,
    images: path.join(root, "images"),
    db: path.join(root, "db.json"),
  };
}
