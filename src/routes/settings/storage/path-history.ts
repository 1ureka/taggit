/**
 * @file path-history.ts
 * collection 路徑歷史 —— localStorage 持久化，僅供 /settings 使用。
 */

import { readJson, writeJson, removeKey } from "$lib/utils/storage";

const PATH_HISTORY_KEY = "taggit:collection-path-history";
const PATH_HISTORY_MAX = 15;

/** 讀取集合路徑歷史，最近使用者優先（index 0 為最新）。 */
export function getPathHistory(): string[] {
  const list = readJson<unknown>(PATH_HISTORY_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.filter((x): x is string => typeof x === "string");
}

/**
 * 將路徑加入歷史：去重後置頂，最多保留 {@link PATH_HISTORY_MAX} 筆。
 * 空字串會被忽略。回傳更新後的完整歷史陣列。
 */
export function pushPathHistory(path: string): string[] {
  const trimmed = path.trim();
  if (trimmed === "") return getPathHistory();

  const rest = getPathHistory().filter((p) => p !== trimmed);
  const next = [trimmed, ...rest].slice(0, PATH_HISTORY_MAX);
  writeJson(PATH_HISTORY_KEY, next);
  return next;
}

/** 清空集合路徑歷史。 */
export function clearPathHistory(): void {
  removeKey(PATH_HISTORY_KEY);
}
