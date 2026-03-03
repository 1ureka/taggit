import fs from "fs";
import path from "path";
import crypto from "crypto";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { IMG_EXTS } from "$lib/server/config.js";
import { isValidFilename, isValidTags, isValidRating } from "$lib/server/validation.js";
import { guardLoaded, getPaths, parseBody } from "$lib/server/helpers.js";
import type { ImageRecord } from "$lib/types.js";

/**
 * POST /api/staged/commit
 * Body: { filename, tags, rating, width?, height? }
 */
export const POST: RequestHandler = async ({ request }) => {
  const err = guardLoaded();
  if (err) return err;

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const { filename, tags, rating, width, height } = body;

  if (!isValidFilename(filename)) return json({ ok: false, error: "Invalid filename" }, { status: 400 });
  if (!IMG_EXTS.has(path.extname(filename as string).toLowerCase()))
    return json({ ok: false, error: "Not an image file" }, { status: 400 });
  if (!isValidTags(tags)) return json({ ok: false, error: "Invalid tags" }, { status: 400 });
  if (!isValidRating(rating))
    return json({ ok: false, error: "Invalid rating (must be integer 0–5)" }, { status: 400 });

  const trimmedTags = (tags as string[]).map((t) => t.trim());
  if (trimmedTags.length === 0) return json({ ok: false, error: "At least one tag is required" }, { status: 400 });

  const paths = getPaths();
  const ext = path.extname(filename as string).toLowerCase();
  const srcPath = path.join(paths.staged, filename as string);

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
      originalName: filename as string,
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
