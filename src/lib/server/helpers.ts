/**
 * Shared route helpers — eliminate boilerplate across API routes.
 *
 * Provides:
 * - guardLoaded()   — returns 503 Response if DB not loaded, otherwise null
 * - getPaths()      — shorthand for getCollectionPaths(getCurrentRoot()!)
 * - getStagedFiles() — reads staged/ directory and returns sorted image filenames
 * - parseBody<T>()  — parses JSON body or returns [null, 400 Response]
 */

import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import * as db from "./db.js";
import { getCollectionPaths, IMG_EXTS } from "./config.js";
import type { CollectionPaths } from "$lib/types.js";

/**
 * Returns an error Response (503) if the DB is not loaded, null otherwise.
 * Usage: `const err = guardLoaded(); if (err) return err;`
 */
export function guardLoaded(): Response | null {
  if (!db.isLoaded()) {
    return json({ ok: false, error: "No collection loaded" }, { status: 503 });
  }
  return null;
}

/** Shorthand for `getCollectionPaths(db.getCurrentRoot()!)`. */
export function getPaths(): CollectionPaths {
  return getCollectionPaths(db.getCurrentRoot()!);
}

/**
 * List image filenames in the staged/ directory, sorted alphabetically.
 * Returns an empty array if the directory doesn't exist or can't be read.
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
 * Parse JSON body from a Request.
 * Returns `[body, null]` on success, or `[null, errorResponse]` on failure.
 *
 * Usage:
 * ```
 * const [body, err] = await parseBody<{ filename: string }>(request);
 * if (err) return err;
 * // body is typed as { filename: string }
 * ```
 */
export async function parseBody<T = Record<string, unknown>>(request: Request): Promise<[T, null] | [null, Response]> {
  try {
    const body = (await request.json()) as T;
    return [body, null];
  } catch {
    return [null, json({ ok: false, error: "Invalid JSON body" }, { status: 400 })];
  }
}
