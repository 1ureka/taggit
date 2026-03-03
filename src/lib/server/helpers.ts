/**
 * Shared route helpers — eliminate boilerplate across API routes.
 *
 * Provides:
 * - guardLoaded()    — returns 503 Response if DB not loaded, otherwise null
 * - getPaths()       — shorthand for getCollectionPaths(getDB().getCurrentRoot()!)
 * - getStagedFiles() — reads staged/ directory and returns sorted image filenames
 * - getTrashFiles()  — reads trash/ directory and returns sorted image filenames
 * - uniqueFilename() — find a unique filename in a directory (auto-append _1, _2, …)
 * - parseBody<T>()   — parses JSON body or returns [null, 400 Response]
 */

import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import { getDB } from "./db.js";
import { getCollectionPaths, IMG_EXTS } from "./config.js";
import type { CollectionPaths } from "$lib/types.js";

/**
 * Returns an error Response (503) if the DB is not loaded, null otherwise.
 * Usage: `const err = guardLoaded(); if (err) return err;`
 */
export function guardLoaded(): Response | null {
  if (!getDB().isLoaded()) {
    return json({ ok: false, error: "No collection loaded" }, { status: 503 });
  }
  return null;
}

/** Shorthand for `getCollectionPaths(getDB().getCurrentRoot()!)`. */
export function getPaths(): CollectionPaths {
  return getCollectionPaths(getDB().getCurrentRoot()!);
}

/**
 * List image filenames in the staged/ directory, sorted alphabetically.
 */
export function getStagedFiles(): string[] {
  try {
    const staged = getPaths().staged;
    return fs
      .readdirSync(staged)
      .filter((f) => IMG_EXTS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/**
 * List image filenames in the trash/ directory, sorted alphabetically.
 * Trash is purely file-based — no DB records involved.
 */
export function getTrashFiles(): string[] {
  try {
    const trash = getPaths().trash;
    return fs
      .readdirSync(trash)
      .filter((f) => IMG_EXTS.has(path.extname(f).toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
}

/**
 * Find a unique filename in `dir` for the desired `name`.
 * If `name` already exists, appends `_1`, `_2`, … before the extension.
 *
 * Example: `photo.png` → `photo_1.png` → `photo_2.png` → …
 *
 * Returns only the filename (not the full path).
 */
export function uniqueFilename(dir: string, name: string): string {
  const ext = path.extname(name);
  const stem = path.basename(name, ext);

  if (!fs.existsSync(path.join(dir, name))) return name;

  let i = 1;
  while (true) {
    const candidate = `${stem}_${i}${ext}`;
    if (!fs.existsSync(path.join(dir, candidate))) return candidate;
    i++;
  }
}

/**
 * Parse JSON body from a Request.
 * Returns `[body, null]` on success, or `[null, errorResponse]` on failure.
 */
export async function parseBody<T = Record<string, unknown>>(request: Request): Promise<[T, null] | [null, Response]> {
  try {
    const body = (await request.json()) as T;
    return [body, null];
  } catch {
    return [null, json({ ok: false, error: "Invalid JSON body" }, { status: 400 })];
  }
}
