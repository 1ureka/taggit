/**
 * @file result.ts
 * 錯誤模型，純物件可辨識聯集 + 工廠。
 */

export type NotFound = { kind: "not_found" };
export type AlreadyExists = { kind: "already_exists" };
export type StaleUpdate = { kind: "stale_update"; expectedUpdatedAt: number; actualUpdatedAt: number };
export type LastTag = { kind: "last_tag"; images: string[] };
export type Validation = { kind: "validation"; fields: string[]; message: string };

export type MutationError = NotFound | AlreadyExists | StaleUpdate | LastTag | Validation;
export type Result<T, E = MutationError> = { ok: true; data: T } | { ok: false; error: E };

// ---

export const ok = <T>(data: T): Result<T, never> => ({
  ok: true,
  data,
});
export const notFound = (): Result<never, NotFound> => ({
  ok: false,
  error: { kind: "not_found" },
});
export const alreadyExists = (): Result<never, AlreadyExists> => ({
  ok: false,
  error: { kind: "already_exists" },
});
export const staleUpdate = (expectedUpdatedAt: number, actualUpdatedAt: number): Result<never, StaleUpdate> => ({
  ok: false,
  error: { kind: "stale_update", expectedUpdatedAt, actualUpdatedAt },
});
export const lastTag = (images: string[]): Result<never, LastTag> => ({
  ok: false,
  error: { kind: "last_tag", images },
});
export const invalid = (fields: string[], message: string): Result<never, Validation> => ({
  ok: false,
  error: { kind: "validation", fields, message },
});
