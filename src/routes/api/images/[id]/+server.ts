import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";
import { getImage } from "$lib/server/db-query.js";
import { updateImage, removeImage } from "$lib/server/db-mutation.js";
import { isValidId, isValidTags, isValidRating, isValidName } from "$lib/server/validation.js";
import { parseBody, requireDatabase, uniqueFilename } from "$lib/server/helpers.js";

/** GET /api/images/[id] */
export const GET: RequestHandler = ({ params }) => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { id } = params;
  if (!isValidId(id)) return json({ ok: false, error: "Invalid image ID" }, { status: 400 });

  const { db } = loaded;
  const image = getImage(db, id);
  if (!image) return json({ ok: false, error: "Image not found" }, { status: 404 });

  return json({ ok: true, data: image });
};

/** PATCH /api/images/[id] — update tags and/or rating (conflict-safe) */
export const PATCH: RequestHandler = async ({ params, request }) => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

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
    const { db } = loaded;
    const updated = updateImage(db, id, { expectedUpdatedAt, tags: trimmedTags, rating, name });

    return json({ ok: true, data: updated });
  } catch (e) {
    if (e instanceof Error && "status" in e && typeof e.status === "number") {
      return json({ ok: false, error: e.message }, { status: e.status });
    }
    throw e;
  }
};

/**
 * DELETE /api/images/[id] — delete committed image.
 */
export const DELETE: RequestHandler = ({ params }) => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { id } = params;
  if (!isValidId(id)) return json({ ok: false, error: "Invalid image ID" }, { status: 400 });

  const { db, paths } = loaded;
  const image = getImage(db, id);
  if (!image) return json({ ok: false, error: "Image not found" }, { status: 404 });

  const src = path.join(paths.committed, id + image.ext);

  // 先移動檔案至垃圾桶，再刪除 DB 記錄。兩步驟非原子操作，理論上可能不一致：
  // - 檔案已移走但 DB 記錄殘留 → 「設定 → 缺失檔案檢查」可偵測並清除
  // - DB 已刪但檔案殘留 → 「設定 → 孤立檔案檢查」可偵測並清除
  // removeImage 僅操作記憶體物件，實務上幾乎不會失敗，風險可控。
  if (fs.existsSync(src)) {
    const trashName = uniqueFilename(paths.trash, id + image.ext);
    const dest = path.join(paths.trash, trashName);
    fs.renameSync(src, dest);
  }

  removeImage(db, id);

  return json({ ok: true, data: { id } });
};
