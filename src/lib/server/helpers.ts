/**
 * @file helpers.ts
 * API 路由共用的伺服器端輔助函式。
 */

import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import { getDB, type JSONDatabase } from "./db.js";
import { getCollectionPaths, IMG_EXTS } from "./config.js";
import { sortCollator } from "$lib/utils.js";
import type { CollectionPaths } from "$lib/types.js";

/**
 * 若集合已知路徑，回傳 CollectionPaths；否則回傳 null。
 * 已知路徑不代表集合已載入 (DB 可能尚未載入或載入失敗)
 */
export function requirePaths(): CollectionPaths | null {
  const db = getDB();
  const root = db.getCurrentRoot();
  if (!root) return null;
  return getCollectionPaths(root);
}

/**
 * 若集合已載入，回傳 JSONDatabase 實例；否則回傳 null。
 * 呼叫端需自行回傳 503。
 */
export function requireDatabase(): { db: JSONDatabase; paths: CollectionPaths } | null {
  const db = getDB();
  if (!db.isLoaded()) return null;
  const paths = requirePaths();
  if (!paths) return null;
  return { db, paths };
}

// ---

/** 列出 staged/ 目錄中的圖片檔名，依字母排序。 */
export function getStagedFiles({ staged }: CollectionPaths): string[] {
  try {
    return fs
      .readdirSync(staged)
      .filter((f) => IMG_EXTS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => sortCollator.compare(a, b));
  } catch {
    return [];
  }
}

/** 列出 trash/ 目錄中的圖片檔名，依字母排序。 */
export function getTrashFiles({ trash }: CollectionPaths): string[] {
  try {
    return fs
      .readdirSync(trash)
      .filter((f) => IMG_EXTS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => sortCollator.compare(a, b));
  } catch {
    return [];
  }
}

/**
 * 在 `dir` 中為 `name` 找出不重複的檔名。
 * 若 `name` 已存在，會在副檔名前附加 `_1`、`_2`、……
 *
 * 範例：`photo.png` → `photo_1.png` → `photo_2.png` → …
 *
 * 只回傳檔名（不含完整路徑）。
 */
export function uniqueFilename(dir: string, name: string): string {
  const ext = path.extname(name);
  const raw = path.basename(name, ext);
  // Strip any existing _N suffix so we don't produce _1_1
  const match = raw.match(/^(.+?)_(\d+)$/);
  const stem = match ? match[1] : raw;

  if (!fs.existsSync(path.join(dir, name))) return name;

  let i = match ? Number(match[2]) + 1 : 1;
  while (true) {
    const candidate = `${stem}_${i}${ext}`;
    if (!fs.existsSync(path.join(dir, candidate))) return candidate;
    i++;
  }
}

// ---

/**
 * 從 Request 解析 JSON body。
 * 成功時回傳 `[body, null]`，失敗時回傳 `[null, errorResponse]`。
 */
export async function parseBody<T = Record<string, unknown>>(request: Request): Promise<[T, null] | [null, Response]> {
  try {
    const body = (await request.json()) as T;
    return [body, null];
  } catch {
    return [null, json({ ok: false, error: "Invalid JSON body" }, { status: 400 })];
  }
}
