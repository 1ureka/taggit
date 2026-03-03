import fs from "fs";
import path from "path";
import crypto from "crypto";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { getCollectionPaths } from "$lib/server/config.js";
import { isValidFilename } from "$lib/server/validation.js";
import type { ImageRecord } from "$lib/types.js";

/**
 * POST /api/maintenance/import-orphan
 * Body: { filename }
 * Creates a DB record for an orphaned file in committed/.
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { filename } = body;
  if (!isValidFilename(filename)) return json({ ok: false, error: "Invalid filename" }, { status: 400 });

  const paths = getCollectionPaths(db.getCurrentRoot()!);
  const ext = path.extname(filename as string).toLowerCase();
  const base = path.basename(filename as string, ext);

  // Reuse hex ID from filename if valid, otherwise generate new
  let id: string;
  if (/^[0-9a-f]{16}$/.test(base) && !db.hasImage(base)) {
    id = base;
  } else {
    do {
      id = crypto.randomBytes(8).toString("hex");
    } while (db.hasImage(id));
    fs.renameSync(path.join(paths.committed, filename as string), path.join(paths.committed, id + ext));
  }

  try {
    const filePath = path.join(paths.committed, id + ext);
    const stat = fs.statSync(filePath);
    const now = Date.now();
    const record: ImageRecord = {
      ext,
      originalName: filename as string,
      tags: [],
      rating: 0,
      committedAt: now,
      updatedAt: now,
      fileSize: stat.size,
      width: 0,
      height: 0,
    };

    db.addImage(id, record);
    return json({ ok: true, data: { id, record } }, { status: 201 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      return json({ ok: false, error: "File not found in committed/" }, { status: 404 });
    throw e;
  }
};
