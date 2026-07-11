/**
 * @file store.ts
 * 泛用的 localStorage 安全存取層。
 *
 * 所有存取皆為 SSR 安全（`localStorage` 不存在時降級為空值 / no-op），
 * 並吞掉隱私模式、配額不足等例外。
 */

/** 安全地讀取並解析 localStorage 中的 JSON 值；不可用或解析失敗時回傳 `fallback`。 */
export function readJson<T>(key: string, fallback: T): T {
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
export function writeJson(key: string, value: unknown): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 隱私模式 / 配額不足等情況，靜默降級。
  }
}

/** 安全地移除 localStorage 中的鍵；不可用時靜默略過。 */
export function removeKey(key: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // 靜默降級。
  }
}
