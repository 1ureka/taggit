/**
 * @file request.ts
 * 前端統一的 HTTP 請求工具。
 *
 * 後端的回應契約很窄，所以這裡幾乎沒有轉換邏輯可寫：
 * - 成功時 body 就是資源本身，沒有 `{ ok, data }` 封包要拆。
 * - 失敗時 body 恆為 `{ message }`（與 SvelteKit 自己的 404 / 500 同形），訊息在伺服器端就
 *   已經是人類可讀的中文，這裡不需要認得任何錯誤種類。
 */

import { hasKey } from "$lib/utils/shared";

/**
 * 所有 API 呼叫的統一結果。
 * 以 `ok` 為判別欄位，呼叫端在 `if (!res.ok)` 分支後即可直接取得 `data` 或 `error`。
 */
export type ApiResult<T = unknown> = { ok: true; data: T } | { ok: false; error: string };

/**
 * 集合層批次端點的回應：以請求送出的那組鍵逐筆回報成敗。
 * 鍵與請求完全對齊，因此呼叫端不需要自己想辦法把結果對回請求。
 */
export type BatchResults = Record<string, { ok: true } | { ok: false; message: string }>;

/** 讀出回應的錯誤訊息；body 不是預期形狀時退回 HTTP 狀態文字。 */
function errorOf(json: unknown, res: Response): string {
  return hasKey(json, "message") ? String(json.message) : res.statusText;
}

/** 內部共用的請求函式。 */
async function request<T>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  const init: RequestInit = { method };

  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init);
  const json: unknown = await res.json().catch(() => null);

  return res.ok ? { ok: true, data: json as T } : { ok: false, error: errorOf(json, res) };
}

/**
 * 以 SSE (Server-Sent Events) 呼叫端點，逐一 yield 解析後的事件。
 * 非 2xx 回應或串流未建立直接 throw；呼叫端只需要在意事件本身，不必處理傳輸細節。
 */
async function* stream<T>(method: string, url: string, body?: unknown): AsyncGenerator<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const json: unknown = await res.json().catch(() => null);
    throw new Error(errorOf(json, res));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n\n");
    buffer = lines.pop()!;

    for (const line of lines) {
      const match = line.match(/^data: (.+)$/m);
      if (!match) continue;
      yield JSON.parse(match[1]) as T;
    }
  }
}

/**
 * 統一的 HTTP 請求工具，對應 SvelteKit API 路由。
 *
 * @example
 * ```ts
 * const res = await api.get<Paginated<ImageWithId>>("/api/records?limit=20");
 * if (res.ok) console.log(res.data.items);
 * ```
 */
export const api = {
  /** 發送 GET 請求。 */
  get: <T>(url: string) => request<T>("GET", url),

  /** 發送 POST 請求，可附帶 JSON 或 FormData。 */
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),

  /** 發送 PUT 請求，可附帶 JSON body。 */
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body),

  /** 發送 PATCH 請求，可附帶 JSON body。 */
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body),

  /** 發送 DELETE 請求，可附帶 JSON body。 */
  del: <T>(url: string, body?: unknown) => request<T>("DELETE", url, body),

  /** 以 SSE 呼叫端點，回傳逐一 yield 事件的 async generator。 */
  stream: <T>(method: string, url: string, body?: unknown) => stream<T>(method, url, body),
};
