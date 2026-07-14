/**
 * @file collection/index.ts
 * collection 模組的公開入口
 */

import path from "path";
import { log } from "$lib/utils/server";

import { readServerJson, writeServerJson } from "./config";
import { isCollectionValid, getCollectionPaths } from "./structure";
import type { CollectionPaths } from "./structure";

export type { CollectionPaths } from "./structure";

declare global {
  /** HMR 保護：在熱重載之間保留當前作用中的 collection 根目錄與名稱快取。 */
  var __activeCollectionRoot: string | null | undefined;
  var __collectionNameCache: { root: string; name: string } | undefined;
}

export class Collection {
  /**
   * 回傳當前作用中的 collection 根目錄（純記憶體，不做磁碟 I/O）。
   * 伺服器啟動後尚未經過 layout 啟動流程時為 `null`。
   */
  static getActiveRoot(): string | null {
    return globalThis.__activeCollectionRoot ?? null;
  }

  /**
   * 設定當前作用中的 collection 根目錄（純記憶體）。
   * 不觸發任何持久化與資料庫載入；呼叫端須自行處理。
   */
  static setActiveRoot(root: string): void {
    globalThis.__activeCollectionRoot = root;
  }

  /**
   * 由 root 推導 collection 顯示名稱。root 不變時直接回傳快取，
   * 只有實際切換到新的 root 時才會重新計算一次。
   */
  static nameOf(root: string | null): string {
    if (!root) return "";

    const cache = globalThis.__collectionNameCache;
    if (cache && cache.root === root) return cache.name;

    const name = path.basename(path.normalize(root));
    globalThis.__collectionNameCache = { root, name };
    return name;
  }

  // ---

  /**
   * 從 server.json 回傳持久化的 collectionRoot，若未設定則回傳 `null`。
   */
  static getPersistedRoot(): string | null {
    return readServerJson().collectionRoot ?? null;
  }

  /**
   * 將 collectionRoot 寫入 server.json。
   * 不會觸發資料庫載入；呼叫端須自行處理。
   */
  static setPersistedRoot(root: string): void {
    const cfg = readServerJson();
    cfg.collectionRoot = root;
    writeServerJson(cfg);
    log({ level: "info", module: "collection", message: `已設定集合根目錄為：${root}` });
  }

  // ---

  /**
   * 驗證集合根路徑：必須是已存在的目錄，且 images/ 子目錄不存在時會自動建立。
   * 當集合可使用時回傳 `true`。
   */
  static isValid(root: string): boolean {
    return isCollectionValid(root);
  }

  /**
   * 從集合根路徑衍生所有相關路徑（images 目錄、db.json）。
   */
  static paths(root: string): CollectionPaths {
    return getCollectionPaths(root);
  }
}
