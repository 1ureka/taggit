import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { isValidFilename, isValidTags, isValidRating } from "$lib/server/validation.js";

interface CommitEntry {
  filename: string;
  tags: string[];
  rating: number;
  width?: number;
  height?: number;
}

/**
 * POST /api/staged/commit-batch
 * Body: { files: CommitEntry[] }
 * Commits all entries; fails fast on validation error (does not partially commit).
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { files } = body as { files?: unknown };
  if (!Array.isArray(files) || files.length === 0) {
    return json({ ok: false, error: "files must be a non-empty array" }, { status: 400 });
  }

  // Validate all entries before committing any
  for (let i = 0; i < files.length; i++) {
    const entry = files[i] as Record<string, unknown>;
    if (!isValidFilename(entry.filename)) {
      return json({ ok: false, error: `files[${i}].filename is invalid` }, { status: 400 });
    }
    if (!isValidTags(entry.tags)) {
      return json({ ok: false, error: `files[${i}].tags is invalid` }, { status: 400 });
    }
    if (!isValidRating(entry.rating)) {
      return json({ ok: false, error: `files[${i}].rating is invalid` }, { status: 400 });
    }
  }

  const results = [];
  for (const entry of files as CommitEntry[]) {
    try {
      const result = db.commitImage(entry.filename, entry.tags, entry.rating, entry.width ?? 0, entry.height ?? 0);
      results.push({ ok: true, ...result });
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      results.push({ ok: false, filename: entry.filename, error: err.message });
    }
  }

  return json({ ok: true, data: { results } }, { status: 201 });
};
