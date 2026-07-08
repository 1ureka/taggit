/**
 * @file client.ts
 * 前端統一的 HTTP 請求工具。
 */

import { hasKey } from "./shared.js";

// ---

/** 所有 API 端點的統一回應格式。 */
interface ApiResponse<T = unknown> {
  /** 請求是否成功 */
  ok: boolean;
  /** 回應資料（僅在成功時存在） */
  data?: T;
  /** 錯誤訊息（僅在失敗時存在） */
  error?: string;
  /** HTTP 狀態碼 */
  status: number;
}

/** 內部共用的請求函式，統一處理回應格式。 */
async function request<T>(method: string, url: string, body?: unknown): Promise<ApiResponse<T>> {
  const opts: RequestInit = { method };

  if (body instanceof FormData) {
    opts.body = body;
  } else if (body !== undefined && body !== null) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (!res.ok) {
    const error = hasKey(json, "error") ? String(json.error) : res.statusText;
    return { ok: false, error, status: res.status };
  }

  // 拆開伺服器的 { ok, data } 封包，讓呼叫端直接取得內層資料
  if (hasKey(json, "data")) {
    return { ok: true, data: json.data as T, status: res.status };
  } else {
    return { ok: true, data: json as T, status: res.status };
  }
}

// ---

/**
 * 統一的 HTTP 請求工具，對應 SvelteKit API 路由。
 *
 * @example
 * ```ts
 * const res = await api.get<{ images: ImageWithId[] }>("/api/committed?limit=20");
 * if (res.ok) console.log(res.data);
 * ```
 */
export const api = {
  /** 發送 GET 請求。 */
  get: <T>(url: string) => request<T>("GET", url),

  /** 發送 POST 請求，可附帶 JSON 或 FormData。 */
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),

  /** 發送 PATCH 請求，可附帶 JSON body。 */
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body),

  /** 發送 DELETE 請求，可附帶 JSON body。 */
  del: <T>(url: string, body?: unknown) => request<T>("DELETE", url, body),
};
