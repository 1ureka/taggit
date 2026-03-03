import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { isValidFilename, isValidTags, isValidRating } from "$lib/server/validation.js";
import { IMG_EXTS } from "$lib/server/config.js";
import path from "path";

/**
 * POST /api/staged/commit
 * Body: { filename, tags, rating, width?, height? }
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { filename, tags, rating, width, height } = body as Record<string, unknown>;

  if (!isValidFilename(filename)) {
    return json({ ok: false, error: "Invalid filename" }, { status: 400 });
  }
  const ext = path.extname(filename as string).toLowerCase();
  if (!IMG_EXTS.has(ext)) {
    return json({ ok: false, error: "Not an image file" }, { status: 400 });
  }
  if (!isValidTags(tags)) {
    return json({ ok: false, error: "Invalid tags" }, { status: 400 });
  }
  if (!isValidRating(rating)) {
    return json({ ok: false, error: "Invalid rating (must be integer 0–5)" }, { status: 400 });
  }

  // Trim tags (defensive: UI should already trim, but guard server-side)
  const trimmedTags = tags.map((t) => t.trim());
  if (trimmedTags.length === 0) {
    return json({ ok: false, error: "At least one tag is required" }, { status: 400 });
  }

  try {
    const result = db.commitImage(
      filename as string,
      trimmedTags,
      rating as number,
      typeof width === "number" ? width : 0,
      typeof height === "number" ? height : 0,
    );
    return json({ ok: true, data: result }, { status: 201 });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return json({ ok: false, error: "Staged file not found" }, { status: 404 });
    }
    throw e;
  }
};
