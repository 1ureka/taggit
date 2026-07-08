/**
 * @file structure.ts
 * collection 目錄結構的驗證、初始化與路徑衍生。
 */

import fs from "fs";
import path from "path";
import { log } from "$lib/server/helpers.js";
import { formatError } from "$lib/utils.js";

/**
 * 由收藏庫根目錄衍生的完整路徑集合。
 */
export interface CollectionPaths {
  /** 收藏庫根目錄 */
  root: string;
  /** 圖片目錄（`<root>/images`） */
  images: string;
  /** 資料庫檔案路徑（`<root>/db.json`） */
  db: string;
}

/**
 * 驗證集合根路徑：
 * - 必須是已存在的目錄
 * - 若 images/ 不存在則自動建立
 *
 * 當集合可使用時回傳 `true`
 */
export function isCollectionValid(root: string): boolean {
  try {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return false;

    const imagesDir = path.join(root, "images");
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
      log({ level: "info", module: "collection", message: `已建立目錄：${imagesDir}` });
    }

    return true;
  } catch (e) {
    log({ level: "error", module: "collection", message: `驗證集合路徑失敗: ${formatError(e)}` });
    return false;
  }
}

/**
 * 從集合根路徑衍生所有相關路徑。
 */
export function getCollectionPaths(root: string): CollectionPaths {
  return { root, images: path.join(root, "images"), db: path.join(root, "db.json") };
}
