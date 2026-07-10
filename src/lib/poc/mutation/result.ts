/**
 * @file result.ts
 * 錯誤模型（Q2）：純物件可辨識聯集（非 Error class）+ 工廠。
 *
 * E 是被回傳的值：route 端 `switch (e.kind)` 可窮盡、可序列化（validation 的
 * fields/message 直接進 JSON）。工廠讓命令內 `return notFound();` 一樣短、零 class 包袱。
 * **不含 errorToHttp**（HTTP 映射是 route 政策，屬 $lib/utils/server，非寫入機制）。
 */

export type NotFound = { kind: "not_found" };
export type StaleUpdate = { kind: "stale_update"; expectedUpdatedAt: number; actualUpdatedAt: number };
export type LastTag = { kind: "last_tag"; images: string[] };
export type Validation = { kind: "validation"; fields: string[]; message: string };
export type MutationError = NotFound | StaleUpdate | LastTag | Validation;

export type Result<T, E = MutationError> = { ok: true; data: T } | { ok: false; error: E };

export const ok = <T>(data: T): Result<T, never> => ({ ok: true, data });
export const notFound = (): Result<never, NotFound> => ({ ok: false, error: { kind: "not_found" } });
export const staleUpdate = (expectedUpdatedAt: number, actualUpdatedAt: number): Result<never, StaleUpdate> => ({
  ok: false,
  error: { kind: "stale_update", expectedUpdatedAt, actualUpdatedAt },
});
export const lastTag = (images: string[]): Result<never, LastTag> => ({ ok: false, error: { kind: "last_tag", images } });
export const invalid = (fields: string[], message: string): Result<never, Validation> => ({
  ok: false,
  error: { kind: "validation", fields, message },
});
