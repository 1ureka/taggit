/**
 * @file result.ts
 * 錯誤模型，純物件可辨識聯集 + 工廠。
 */

export type NotFound = { kind: "not_found" };
export type Forbidden = { kind: "forbidden" };
export type ImageError = NotFound | Forbidden;
export type Result<T, E = ImageError> = { ok: true; data: T } | { ok: false; error: E };

export const ok = <T>(data: T): Result<T, never> => ({
  ok: true,
  data,
});
export const notFound = (): Result<never, NotFound> => ({
  ok: false,
  error: { kind: "not_found" },
});
export const forbidden = (): Result<never, Forbidden> => ({
  ok: false,
  error: { kind: "forbidden" },
});

// ---

/** `ImageLibrary.payload()` 的回傳資料：xl 走串流、sm/md 走 webp buffer。 */
export type ImagePayload =
  | { kind: "stream"; body: ReadableStream; contentType: string; length: number }
  | { kind: "buffer"; body: Uint8Array<ArrayBuffer>; contentType: string };
