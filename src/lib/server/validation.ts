/**
 * Input validation helpers for API routes.
 * All functions are pure (no I/O) and can be used server-side only.
 */

/** 16-character lowercase hex string */
export function isValidId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{16}$/.test(value);
}

/**
 * Tags must be a non-empty array of trimmed, non-empty, unique strings (max 50 chars each).
 * An empty array [ ] is valid (clearing all tags).
 */
export function isValidTags(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  if (value.some((t) => typeof t !== "string" || t.trim() === "" || t.length > 50)) return false;
  // Check uniqueness
  const seen = new Set<string>();
  for (const t of value as string[]) {
    if (seen.has(t)) return false;
    seen.add(t);
  }
  return true;
}

/** Rating must be an integer in [0, 5] */
export function isValidRating(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 5;
}

/**
 * Filename must not contain path separators or special shell characters,
 * and must not start with a dot.
 */
export function isValidFilename(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.startsWith(".")) return false;
  // Reject path traversal and shell metacharacters
  return !/[/\\<>:"|?*\x00-\x1f]/.test(value);
}

/** Absolute path looks reasonable (non-empty string) */
export function isValidAbsPath(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
