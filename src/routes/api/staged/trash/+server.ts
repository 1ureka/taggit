import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { isValidFilename } from "$lib/server/validation.js";
import { guardLoaded, getPaths, parseBody } from "$lib/server/helpers.js";

/**
 * POST /api/staged/trash
 * Body: { filename }
 * Moves a staged file directly to trash (without committing).
 */
export const POST: RequestHandler = async ({ request }) => {
  const err = guardLoaded();
  if (err) return err;

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const { filename } = body;
  if (!isValidFilename(filename)) return json({ ok: false, error: "Invalid filename" }, { status: 400 });

  const paths = getPaths();
  const src = path.join(paths.staged, filename as string);
  const dest = path.join(paths.trash, `staged_${Date.now()}_${filename}`);

  if (!fs.existsSync(src)) return json({ ok: false, error: "Staged file not found" }, { status: 404 });

  fs.renameSync(src, dest);
  return json({ ok: true });
};
