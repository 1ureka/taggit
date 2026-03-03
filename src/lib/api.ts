/**
 * Client-side fetch wrappers.
 * Used by client-heavy pages (tagger, editor, browse, scroll, compare).
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

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body),
  del: <T>(url: string, body?: unknown) => request<T>("DELETE", url, body),
};
