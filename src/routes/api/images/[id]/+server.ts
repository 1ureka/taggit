import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { getCollectionPaths } from "$lib/server/config.js";
import { isValidId, isValidTags, isValidRating } from "$lib/server/validation.js";

/** GET /api/images/[id] */
export const GET: RequestHandler = ({ params }) => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { id } = params;
  if (!isValidId(id)) return json({ ok: false, error: "Invalid image ID" }, { status: 400 });

  const image = db.getImage(id);
  if (!image) return json({ ok: false, error: "Image not found" }, { status: 404 });

  return json({ ok: true, data: image });
};

/** PATCH /api/images/[id] — update tags and/or rating (conflict-safe) */
export const PATCH: RequestHandler = async ({ params, request }) => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { id } = params;
  if (!isValidId(id)) return json({ ok: false, error: "Invalid image ID" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { tags, rating, expectedUpdatedAt } = body;

  if (typeof expectedUpdatedAt !== "number")
    return json({ ok: false, error: "expectedUpdatedAt is required (number)" }, { status: 400 });
  if (tags !== undefined && !isValidTags(tags)) return json({ ok: false, error: "Invalid tags" }, { status: 400 });
  if (rating !== undefined && !isValidRating(rating))
    return json({ ok: false, error: "Invalid rating (must be integer 0–5)" }, { status: 400 });

  try {
    const updated = db.updateImage(id, { tags: tags as string[], rating: rating as number }, expectedUpdatedAt);
    return json({ ok: true, data: updated });
  } catch (e) {
    if ((e as any).status === 409)
      return json({ ok: false, error: "Conflict", data: (e as any).record }, { status: 409 });
    if ((e as Error).message?.includes("not found"))
      return json({ ok: false, error: "Image not found" }, { status: 404 });
    throw e;
  }
};

/** DELETE /api/images/[id] — move image to trash */
export const DELETE: RequestHandler = ({ params }) => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { id } = params;
  if (!isValidId(id)) return json({ ok: false, error: "Invalid image ID" }, { status: 400 });

  const image = db.getImage(id);
  if (!image) return json({ ok: false, error: "Image not found" }, { status: 404 });

  // Move file from committed → trash
  const paths = getCollectionPaths(db.getCurrentRoot()!);
  const src = path.join(paths.committed, id + image.ext);
  const dest = path.join(paths.trash, id + image.ext);
  if (fs.existsSync(src)) fs.renameSync(src, dest);

  db.moveToTrash(id);
  return json({ ok: true });
};
