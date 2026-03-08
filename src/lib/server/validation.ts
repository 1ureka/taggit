import type { ImageArea, ImageSize } from "$lib/types.js";

/** 16-character lowercase hex string */
export function isValidId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{16}$/.test(value);
}

/**
 * Tags must be a non-empty array of trimmed, non-empty, unique strings (max 50 chars each).
 * An empty array is NOT valid — every committed image must have at least one tag.
 */
export function isValidTags(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return false;
  if (value.some((t) => typeof t !== "string" || t.trim() === "" || t.length > 50)) return false;
  // Check uniqueness on trimmed strings
  const seen = new Set<string>();
  for (const t of value as string[]) {
    const trimmed = t.trim();
    if (seen.has(trimmed)) return false;
    seen.add(trimmed);
  }
  return true;
}

/** Rating must be an integer in [0, 5] */
export function isValidRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5;
}

/** Absolute path looks reasonable (non-empty string) */
export function isValidAbsPath(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Check area param is one of committed / staged / trash */
export function isValidArea(value: unknown): value is ImageArea {
  return value === "committed" || value === "staged" || value === "trash";
}

/** Filename must be non-empty and free of path-traversal characters */
export function isValidFilename(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("..") &&
    !value.startsWith(".")
  );
}

/** Check size query param is sm / md / xl */
export function isValidSize(value: unknown): value is ImageSize {
  return value === "sm" || value === "md" || value === "xl";
}

/** name 必須為非空字串，長度 ≤ 200 */
export function isValidName(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 200;
}
