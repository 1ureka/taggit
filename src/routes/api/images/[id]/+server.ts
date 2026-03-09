import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getDB } from "$lib/server/db.js";
import { getImage } from "$lib/server/db-query.js";
import { updateImage, removeImage } from "$lib/server/db-mutation.js";
import { isValidId, isValidTags, isValidRating, isValidName } from "$lib/server/validation.js";
import { guardLoaded, getPaths, parseBody, uniqueFilename } from "$lib/server/helpers.js";

/** GET /api/images/[id] */
export const GET: RequestHandler = ({ params }) => {
  const err = guardLoaded();
  if (err) return err;

  const { id } = params;
  if (!isValidId(id)) return json({ ok: false, error: "Invalid image ID" }, { status: 400 });

  const image = getImage(getDB(), id);
  if (!image) return json({ ok: false, error: "Image not found" }, { status: 404 });

  return json({ ok: true, data: image });
};

/** PATCH /api/images/[id] — update tags and/or rating (conflict-safe) */
export const PATCH: RequestHandler = async ({ params, request }) => {
  const err = guardLoaded();
  if (err) return err;

  const { id } = params;
  if (!isValidId(id)) return json({ ok: false, error: "Invalid image ID" }, { status: 400 });

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const { tags, rating, name, expectedUpdatedAt } = body;

  if (typeof expectedUpdatedAt !== "number") {
    return json({ ok: false, error: "expectedUpdatedAt is required (number)" }, { status: 400 });
  }

  if (tags !== undefined && !isValidTags(tags)) {
    return json(
      { ok: false, error: "Invalid tags (must be a non-empty array of unique, non-empty strings)" },
      { status: 400 },
    );
  }

  if (rating !== undefined && !isValidRating(rating)) {
    return json({ ok: false, error: "Invalid rating (must be integer 0–5)" }, { status: 400 });
  }

  if (name !== undefined && !isValidName(name)) {
    return json({ ok: false, error: "Invalid name (must be non-empty string, max 200 chars)" }, { status: 400 });
  }

  const trimmedTags = tags !== undefined ? tags.map((t) => t.trim()) : undefined;

  try {
    const updated = updateImage(getDB(), id, { expectedUpdatedAt, tags: trimmedTags, rating, name });

    return json({ ok: true, data: updated });
  } catch (e) {
    if ((e as any).status === 409) {
      return json({ ok: false, error: "Conflict", data: (e as any).record }, { status: 409 });
    }

    if ((e as Error).message?.includes("not found")) {
      return json({ ok: false, error: "Image not found" }, { status: 404 });
    }

    throw e;
  }
};

/**
 * DELETE /api/images/[id] — delete committed image.
 */
export const DELETE: RequestHandler = ({ params }) => {
  const err = guardLoaded();
  if (err) return err;

  const { id } = params;
  if (!isValidId(id)) return json({ ok: false, error: "Invalid image ID" }, { status: 400 });

  const image = getImage(getDB(), id);
  if (!image) return json({ ok: false, error: "Image not found" }, { status: 404 });

  const paths = getPaths();
  const src = path.join(paths.committed, id + image.ext);

  // Move file to trash with id-based name (auto-rename on collision)
  if (fs.existsSync(src)) {
    const trashName = uniqueFilename(paths.trash, id + image.ext);
    const dest = path.join(paths.trash, trashName);
    fs.renameSync(src, dest);
  }

  // Remove DB record — metadata is lost after this point
  removeImage(getDB(), id);

  return json({ ok: true });
};
