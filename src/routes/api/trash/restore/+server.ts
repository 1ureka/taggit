import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { isValidFilename } from "$lib/server/validation.js";
import { guardLoaded, getPaths, parseBody, uniqueFilename } from "$lib/server/helpers.js";

/**
 * POST /api/trash/restore
 * Body: { filename }
 *
 */
export const POST: RequestHandler = async ({ request }) => {
  const err = guardLoaded();
  if (err) return err;

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const { filename } = body;
  if (!isValidFilename(filename)) return json({ ok: false, error: "Invalid filename" }, { status: 400 });

  const paths = getPaths();
  const src = path.join(paths.trash, filename as string);

  if (!fs.existsSync(src)) return json({ ok: false, error: "Trash file not found" }, { status: 404 });

  const stagedName = uniqueFilename(paths.staged, filename as string);
  const dest = path.join(paths.staged, stagedName);
  fs.renameSync(src, dest);

  return json({ ok: true, data: { stagedName } });
};
