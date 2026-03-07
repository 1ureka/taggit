import fs from "fs";
import path from "path";
import type { ServerConfig, CollectionPaths } from "$lib/types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Supported image extensions */
export const IMG_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp", ".avif"]);

/** MIME type map */
export const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

/** Absolute path to server.json (project root) */
const SERVER_JSON_PATH = path.resolve("server.json");

// ─── server.json I/O ─────────────────────────────────────────────────────────

/**
 * Ensure server.json exists. Creates `{}` if the file is missing.
 * Called on first read so every code path is safe.
 */
export function ensureServerJson(): void {
  if (!fs.existsSync(SERVER_JSON_PATH)) {
    fs.writeFileSync(SERVER_JSON_PATH, "{}\n", "utf8");
    console.log("[config] Created server.json");
  }
}

function readServerJson(): ServerConfig {
  ensureServerJson();
  try {
    const raw = fs.readFileSync(SERVER_JSON_PATH, "utf8");
    return JSON.parse(raw) as ServerConfig;
  } catch {
    console.error("[config] Failed to parse server.json, treating as empty");
    return {};
  }
}

function writeServerJson(data: ServerConfig): void {
  fs.writeFileSync(SERVER_JSON_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the current collectionRoot from server.json, or null if not set.
 */
export function getCollectionRoot(): string | null {
  const cfg = readServerJson();
  return cfg.collectionRoot ?? null;
}

/**
 * Writes collectionRoot to server.json.
 * Does NOT trigger db.loadCollection(); the caller (API or hooks) must do that.
 */
export function setCollectionRoot(root: string): void {
  const cfg = readServerJson();
  cfg.collectionRoot = root;
  writeServerJson(cfg);
  console.log(`[config] collectionRoot set to: ${root}`);
}

/**
 * Validates a collection root path:
 * - Must exist as a directory
 * - Automatically creates staged/, committed/, trash/ if missing
 * Returns true when the collection is ready to use.
 */
export function isCollectionValid(root: string): boolean {
  try {
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) return false;

    const subdirs = ["staged", "committed", "trash"];
    for (const sub of subdirs) {
      const dir = path.join(root, sub);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[config] Created directory: ${dir}`);
      }
    }
    return true;
  } catch (e) {
    console.error("[config] isCollectionValid error:", (e as Error).message);
    return false;
  }
}

/**
 * Returns the current defaultBlurhash from server.json, or empty string if not set.
 */
export function getDefaultBlurhash(): string {
  const cfg = readServerJson();
  return cfg.defaultBlurhash ?? "";
}

/**
 * Writes defaultBlurhash to server.json.
 */
export function setDefaultBlurhash(hash: string): void {
  const cfg = readServerJson();
  cfg.defaultBlurhash = hash;
  writeServerJson(cfg);
}

/**
 * Derives all relevant paths from a collection root.
 */
export function getCollectionPaths(root: string): CollectionPaths {
  return {
    root,
    staged: path.join(root, "staged"),
    committed: path.join(root, "committed"),
    trash: path.join(root, "trash"),
    db: path.join(root, "db.json"),
  };
}
