/**
 * @file db-instance.ts
 * 資料庫單例管理與型別安全的資源存取。
 *
 * 本模組的職責：
 *   - 透過 `globalThis.__db` 維護 HMR 安全的 {@link JSONDatabase} 單例。
 *   - 提供 {@link requireDatabase} 作為取得資料庫的唯一公開介面，預設僅在集合已載入時回傳，避免意外操作未載入的資料庫。
 *   - 提供 {@link requirePaths} 取得目前集合的相關路徑。
 */

import { JSONDatabase } from "./db.js";
import { getCollectionPaths } from "./config.js";
import type { CollectionPaths } from "$lib/types.js";

// ---

declare global {
  /** HMR 保護：在熱重載之間重用現有的 {@link JSONDatabase} 實例。 */
  var __db: JSONDatabase | undefined;
}

/**
 * 回傳模組層級的 {@link JSONDatabase} 單例，首次存取時建立。
 * 實例儲存於 `globalThis`，使 Vite HMR 不會在重載間重設它。
 */
function getDatabase(): JSONDatabase {
  if (!globalThis.__db) {
    globalThis.__db = new JSONDatabase();
  }
  return globalThis.__db;
}

// ---

/**
 * 若集合已知路徑，回傳 CollectionPaths；否則回傳 null。
 * 已知路徑不代表集合已載入（DB 可能尚未載入或載入失敗）。
 */
export function requirePaths(): CollectionPaths | null {
  const db = getDatabase();
  const root = db.getCurrentRoot();
  if (!root) return null;
  return getCollectionPaths(root);
}

// ---

/** {@link requireDatabase} 的選項。 */
interface RequireDatabaseOptions {
  /**
   * 若為 `true`，即使集合尚未載入也會回傳資料庫實例。
   * 僅限基礎設施層使用（hooks、layout load、setup endpoint）。
   * 預設 `false`。
   */
  allowUnload?: boolean;
}

/**
 * 取得資料庫實例與集合路徑的唯一公開介面。
 *
 * - 預設行為：集合已載入時回傳 `{ db, paths }`，否則回傳 `null`。
 * - `allowUnload: true`：無論是否已載入，皆回傳資料庫實例（paths 可能為 null）。
 *   僅限基礎設施層（hooks flush、layout loadCollection、setup endpoint）使用。
 */
export function requireDatabase(): { db: JSONDatabase; paths: CollectionPaths } | null;
export function requireDatabase(opts: { allowUnload: true }): { db: JSONDatabase; paths: CollectionPaths | null };
export function requireDatabase(
  opts?: RequireDatabaseOptions,
): { db: JSONDatabase; paths: CollectionPaths | null } | null {
  const db = getDatabase();

  if (opts?.allowUnload) {
    const root = db.getCurrentRoot();
    const paths = root ? getCollectionPaths(root) : null;
    return { db, paths };
  }

  if (!db.isLoaded()) return null;
  const root = db.getCurrentRoot();
  if (!root) return null;
  return { db, paths: getCollectionPaths(root) };
}
