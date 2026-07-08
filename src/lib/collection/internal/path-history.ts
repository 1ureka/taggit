/**
 * @file path-history.ts
 * collection 路徑歷史 —— localStorage 持久化（前端）。
 *
 * 所有存取皆為 SSR 安全（`localStorage` 不存在時降級為空值 / no-op），
 * 並吞掉隱私模式、配額不足等例外。
 */

/** 安全地讀取並解析 localStorage 中的 JSON 值；不可用或解析失敗時回傳 `fallback`。 */
function readJson<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 安全地將值序列化並寫入 localStorage；不可用時靜默略過。 */
function writeJson(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 隱私模式 / 配額不足等情況，靜默降級。
  }
}

/** 安全地移除 localStorage 中的鍵；不可用時靜默略過。 */
function removeKey(key: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // 靜默降級。
  }
}

// ---

const COLLECTION_PATH_HISTORY_KEY = "taggit:collection-path-history";
const COLLECTION_PATH_HISTORY_MAX = 15;

/** 讀取集合路徑歷史，最近使用者優先（index 0 為最新）。 */
export function getCollectionPathHistory(): string[] {
  const list = readJson<unknown>(COLLECTION_PATH_HISTORY_KEY, []);
  if (!Array.isArray(list)) return [];
  return list.filter((x): x is string => typeof x === "string");
}

/**
 * 將路徑加入歷史：去重後置頂，最多保留 {@link COLLECTION_PATH_HISTORY_MAX} 筆。
 * 空字串會被忽略。回傳更新後的完整歷史陣列。
 */
export function pushCollectionPathHistory(path: string): string[] {
  const trimmed = path.trim();
  if (trimmed === "") return getCollectionPathHistory();

  const rest = getCollectionPathHistory().filter((p) => p !== trimmed);
  const next = [trimmed, ...rest].slice(0, COLLECTION_PATH_HISTORY_MAX);
  writeJson(COLLECTION_PATH_HISTORY_KEY, next);
  return next;
}

/** 清空集合路徑歷史。 */
export function clearCollectionPathHistory(): void {
  removeKey(COLLECTION_PATH_HISTORY_KEY);
}
