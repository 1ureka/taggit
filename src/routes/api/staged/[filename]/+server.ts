import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";

import type { ImageRecord } from "$lib/types.js";
import { hasImage } from "$lib/server/db-query.js";
import { addImage } from "$lib/server/db-mutation.js";

import { IMG_EXTS } from "$lib/server/config.js";
import { isValidFilename, isValidTags, isValidRating } from "$lib/server/validation.js";
import { requireDatabase } from "$lib/server/db-instance.js";
import { parseBody } from "$lib/server/helpers.js";
import { getImageMeta } from "$lib/server/thumbnail.js";

/**
 * `POST /api/staged/[filename]`
 *
 * 將暫存檔案提交至資料庫。
 * Body: `{ tags, rating }`，filename 來自 URL 路徑參數。
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { db, paths } = loaded;
  const { filename } = params;

  if (!isValidFilename(filename)) return json({ ok: false, error: "Invalid filename" }, { status: 400 });

  if (!IMG_EXTS.has(path.extname(filename).toLowerCase()))
    return json({ ok: false, error: "Not an image file" }, { status: 400 });

  if (hasImage(db, filename)) return json({ ok: false, error: "Already committed" }, { status: 409 });

  const filePath = path.join(paths.images, filename);
  if (!fs.existsSync(filePath)) return json({ ok: false, error: "Staged file not found" }, { status: 404 });

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const { tags, rating } = body;

  if (!isValidTags(tags)) return json({ ok: false, error: "Invalid tags" }, { status: 400 });
  if (!isValidRating(rating))
    return json({ ok: false, error: "Invalid rating (must be integer 0–5)" }, { status: 400 });

  const trimmedTags = (tags as string[]).map((t) => t.trim());
  if (trimmedTags.length === 0) return json({ ok: false, error: "At least one tag is required" }, { status: 400 });

  const ext = path.extname(filename).toLowerCase();

  try {
    const stat = fs.statSync(filePath);
    const now = Date.now();
    const meta = await getImageMeta(filePath);
    const record: ImageRecord = {
      name: path.basename(filename, ext),
      tags: trimmedTags,
      rating: rating as number,
      committedAt: now,
      updatedAt: now,
      fileSize: stat.size,
      ...meta,
    };

    addImage(db, filename, record);
    return json({ ok: true, data: { id: filename, ...record } }, { status: 201 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      return json({ ok: false, error: "Staged file not found" }, { status: 404 });
    throw e;
  }
};

// ---

/**
 * `DELETE /api/staged/[filename]`
 *
 * 永久刪除暫存區中的指定檔案。
 */
export const DELETE: RequestHandler = ({ params }) => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { db, paths } = loaded;
  const { filename } = params;

  if (!isValidFilename(filename)) return json({ ok: false, error: "Invalid filename" }, { status: 400 });

  if (hasImage(db, filename))
    return json({ ok: false, error: "Cannot delete committed image via staged endpoint" }, { status: 409 });

  const filePath = path.join(paths.images, filename);

  if (!fs.existsSync(filePath)) return json({ ok: false, error: "Staged file not found" }, { status: 404 });

  fs.unlinkSync(filePath);

  return json({ ok: true, data: { filename } });
};
