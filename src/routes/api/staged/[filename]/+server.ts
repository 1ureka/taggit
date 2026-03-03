import fs from "fs";
import path from "path";
import crypto from "crypto";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { IMG_EXTS } from "$lib/server/config.js";
import { isValidTags, isValidRating } from "$lib/server/validation.js";
import { guardLoaded, getPaths, parseBody, uniqueFilename } from "$lib/server/helpers.js";
import type { ImageRecord } from "$lib/types.js";

/**
 * POST /api/staged/[filename] — commit a staged file.
 * Body: { tags, rating, width?, height? }
 * filename comes from URL param.
 */
export const POST: RequestHandler = async ({ params, request }) => {
  const err = guardLoaded();
  if (err) return err;

  const filename = params.filename!;

  if (!IMG_EXTS.has(path.extname(filename).toLowerCase()))
    return json({ ok: false, error: "Not an image file" }, { status: 400 });

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const { tags, rating, width, height } = body;

  if (!isValidTags(tags)) return json({ ok: false, error: "Invalid tags" }, { status: 400 });
  if (!isValidRating(rating))
    return json({ ok: false, error: "Invalid rating (must be integer 0–5)" }, { status: 400 });

  const trimmedTags = (tags as string[]).map((t) => t.trim());
  if (trimmedTags.length === 0) return json({ ok: false, error: "At least one tag is required" }, { status: 400 });

  const paths = getPaths();
  const ext = path.extname(filename).toLowerCase();
  const srcPath = path.join(paths.staged, filename);

  let id: string;
  do {
    id = crypto.randomBytes(8).toString("hex");
  } while (db.hasImage(id));

  const destPath = path.join(paths.committed, id + ext);

  try {
    const stat = fs.statSync(srcPath);
    fs.renameSync(srcPath, destPath);

    const now = Date.now();
    const record: ImageRecord = {
      ext,
      originalName: filename,
      tags: trimmedTags,
      rating: rating as number,
      committedAt: now,
      updatedAt: now,
      fileSize: stat.size,
      width: typeof width === "number" && width > 0 ? width : 0,
      height: typeof height === "number" && height > 0 ? height : 0,
    };

    db.addImage(id, record);
    return json({ ok: true, data: { id, record } }, { status: 201 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      return json({ ok: false, error: "Staged file not found" }, { status: 404 });
    throw e;
  }
};

/**
 * DELETE /api/staged/[filename] — move staged file to trash (no body needed).
 */
export const DELETE: RequestHandler = ({ params }) => {
  const err = guardLoaded();
  if (err) return err;

  const filename = params.filename!;
  const paths = getPaths();
  const src = path.join(paths.staged, filename);

  if (!fs.existsSync(src)) return json({ ok: false, error: "Staged file not found" }, { status: 404 });

  const trashName = uniqueFilename(paths.trash, filename);
  fs.renameSync(src, path.join(paths.trash, trashName));

  return json({ ok: true, data: { trashName } });
};
