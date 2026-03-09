/**
 * @file helpers.ts
 * API 路由共用的伺服器端輔助函式。
 *
 * 本模組的職責：
 *   - {@link guardLoaded}：確認資料庫已載入，否則回傳 503。
 *   - {@link getPaths}：快速取得目前集合的所有路徑。
 *   - {@link getStagedFiles} / {@link getTrashFiles}：列出暫存區與垃圾桶中的檔案。
 *   - {@link uniqueFilename}：產生不衝突的檔案名稱。
 *   - {@link parseBody}：安全解析 JSON 請求本體。
 */

import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import { getDB } from "./db.js";
import { getCollectionPaths, IMG_EXTS } from "./config.js";
import { sortCollator } from "$lib/utils.js";
import type { CollectionPaths } from "$lib/types.js";

/**
 * Returns an error Response (503) if the DB is not loaded, null otherwise.
 * Usage: `const err = guardLoaded(); if (err) return err;`
 */
export function guardLoaded(): Response | null {
  if (!getDB().isLoaded()) {
    return json({ ok: false, error: "No collection loaded" }, { status: 503 });
  }
  return null;
}

/** Shorthand for `getCollectionPaths(getDB().getCurrentRoot()!)`. */
export function getPaths(): CollectionPaths {
  return getCollectionPaths(getDB().getCurrentRoot()!);
}

/**
 * List image filenames in the staged/ directory, sorted alphabetically.
 */
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

/**
 * List image filenames in the trash/ directory, sorted alphabetically.
 * Trash is purely file-based — no DB records involved.
 */
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
 * Find a unique filename in `dir` for the desired `name`.
 * If `name` already exists, appends `_1`, `_2`, … before the extension.
 *
 * Example: `photo.png` → `photo_1.png` → `photo_2.png` → …
 *
 * Returns only the filename (not the full path).
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

/**
 * Parse JSON body from a Request.
 * Returns `[body, null]` on success, or `[null, errorResponse]` on failure.
 */
export async function parseBody<T = Record<string, unknown>>(request: Request): Promise<[T, null] | [null, Response]> {
  try {
    const body = (await request.json()) as T;
    return [body, null];
  } catch {
    return [null, json({ ok: false, error: "Invalid JSON body" }, { status: 400 })];
  }
}
