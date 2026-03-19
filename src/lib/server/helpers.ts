/**
 * @file helpers.ts
 * API 路由共用的伺服器端輔助函式。
 */

import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { JSONDatabase } from "./db.js";
import { IMG_EXTS } from "./config.js";
import { sortCollator } from "$lib/utils.js";
import type { CollectionPaths } from "$lib/types.js";

// ---

/** 列出 images/ 目錄中不在 db.json 中的圖片檔名（即 staged），依字母排序。 */
export function getStagedFiles(db: JSONDatabase, paths: CollectionPaths): string[] {
  try {
    const dbImages = db.data.images;
    return fs
      .readdirSync(paths.images)
      .filter((f) => IMG_EXTS.has(path.extname(f).toLowerCase()) && !(f in dbImages))
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
