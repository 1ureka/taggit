import { json, type RequestHandler } from "@sveltejs/kit";
import { getImage } from "$lib/server/db-query.js";
import { updateImage, removeImage } from "$lib/server/db-mutation.js";
import { isValidFilename, isValidTags, isValidRating, isValidName } from "$lib/server/validation.js";
import { parseBody } from "$lib/server/helpers.js";
import { requireDatabase } from "$lib/server/db-instance.js";

/** GET /api/images/[filename] */
export const GET: RequestHandler = ({ params }) => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { filename } = params;
  if (!isValidFilename(filename)) return json({ ok: false, error: "Invalid filename" }, { status: 400 });

  const { db } = loaded;
  const image = getImage(db, filename);
  if (!image) return json({ ok: false, error: "Image not found" }, { status: 404 });

  return json({ ok: true, data: image });
};

/** PATCH /api/images/[filename] — update tags and/or rating (conflict-safe) */
export const PATCH: RequestHandler = async ({ params, request }) => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { filename } = params;
  if (!isValidFilename(filename)) return json({ ok: false, error: "Invalid filename" }, { status: 400 });

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
    const { db } = loaded;
    const updated = updateImage(db, filename, { expectedUpdatedAt, tags: trimmedTags, rating, name });

    return json({ ok: true, data: updated });
  } catch (e) {
    if (e instanceof Error && "status" in e && typeof e.status === "number") {
      return json({ ok: false, error: e.message }, { status: e.status });
    }
    throw e;
  }
};

/**
 * DELETE /api/images/[filename] — 取消提交，僅移除 DB 記錄，檔案保留於 images/ 並回到 staged 狀態。
 */
export const DELETE: RequestHandler = ({ params }) => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { filename } = params;
  if (!isValidFilename(filename)) return json({ ok: false, error: "Invalid filename" }, { status: 400 });

  const { db } = loaded;
  const image = getImage(db, filename);
  if (!image) return json({ ok: false, error: "Image not found" }, { status: 404 });

  removeImage(db, filename);

  return json({ ok: true, data: { filename } });
};
