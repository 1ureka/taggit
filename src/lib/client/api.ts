/**
 * @file client/api.ts
 * Lightweight fetch wrappers for client-side use.
 *
 * Used by client-heavy pages (tagger, editor, browse, scroll, compare).
 * Must NOT be imported from server-only modules — it relies on the browser
 * `fetch` global and is bundled into the client JavaScript bundle.
 */

/**
 * Internal helper that executes a fetch request and normalises the response
 * into a consistent shape.
 *
 * @param method - HTTP verb (`GET`, `POST`, `PATCH`, `DELETE`, …).
 * @param url - The URL to fetch.
 * @param body - Optional request body; will be JSON-serialised.
 * @returns A promise resolving to `{ ok, data?, error?, status }`.
 */
async function request<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<{ ok: boolean; data?: T; error?: string; status: number }> {
  const opts: RequestInit = { method };

  if (body !== undefined) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(url, opts);
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    const error =
      typeof data === "object" && data !== null && "error" in data
        ? String((data as Record<string, unknown>).error)
        : res.statusText;
    return { ok: false, error, status: res.status };
  }
  return { ok: true, data: data as T, status: res.status };
}

/**
 * Typed HTTP helpers for reaching the SvelteKit API routes.
 *
 * @example
 * ```ts
 * import { api } from "$lib/client/api.js";
 *
 * const res = await api.get<{ images: ImageWithId[] }>("/api/images?limit=20");
 * if (res.ok) console.log(res.data);
 * ```
 */
export const api = {
  /**
   * Sends a GET request.
   *
   * @param url - The endpoint URL.
   */
  get: <T>(url: string) => request<T>("GET", url),

  /**
   * Sends a POST request with an optional JSON body.
   *
   * @param url - The endpoint URL.
   * @param body - Optional payload to JSON-serialise.
   */
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),

  /**
   * Sends a PATCH request with an optional JSON body.
   *
   * @param url - The endpoint URL.
   * @param body - Optional payload to JSON-serialise.
   */
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body),

  /**
   * Sends a DELETE request with an optional JSON body.
   *
   * @param url - The endpoint URL.
   * @param body - Optional payload to JSON-serialise.
   */
  del: <T>(url: string, body?: unknown) => request<T>("DELETE", url, body),
};
