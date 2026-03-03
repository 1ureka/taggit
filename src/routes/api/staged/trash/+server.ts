import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { getCollectionPaths } from "$lib/server/config.js";
import { isValidFilename } from "$lib/server/validation.js";

/**
 * POST /api/staged/trash
 * Body: { filename }
 * Moves a staged file directly to trash (without committing).
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
  const src = path.join(paths.staged, filename as string);
  const dest = path.join(paths.trash, `staged_${Date.now()}_${filename}`);

  if (!fs.existsSync(src)) return json({ ok: false, error: "Staged file not found" }, { status: 404 });

  fs.renameSync(src, dest);
  return json({ ok: true });
};
