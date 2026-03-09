/**
 * @file helpers.ts
 * API 路由共用的伺服器端輔助函式。
 */

import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import { getDB } from "./db.js";
import { getCollectionPaths, IMG_EXTS } from "./config.js";
import { sortCollator } from "$lib/utils.js";
import type { CollectionPaths } from "$lib/types.js";

/**
 * 若資料庫未載入，回傳 503 錯誤回應；否則回傳 `null`。
 * 用法：`const err = guardLoaded(); if (err) return err;`
 */
export function guardLoaded(): Response | null {
  if (!getDB().isLoaded()) {
    return json({ ok: false, error: "No collection loaded" }, { status: 503 });
  }
  return null;
}

/** `getCollectionPaths(getDB().getCurrentRoot()!)` 的簡寫。 */
export function getPaths(): CollectionPaths {
  return getCollectionPaths(getDB().getCurrentRoot()!);
}

// ---

/** 列出 staged/ 目錄中的圖片檔名，依字母排序。 */
export function getStagedFiles(): string[] {
  try {
    const staged = getPaths().staged;
    return fs
      .readdirSync(staged)
      .filter((f) => IMG_EXTS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => sortCollator.compare(a, b));
  } catch {
    return [];
  }
}

/** 列出 trash/ 目錄中的圖片檔名，依字母排序。 */
export function getTrashFiles(): string[] {
  try {
    const trash = getPaths().trash;
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
