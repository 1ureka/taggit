import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { isValidFilename } from "$lib/server/validation.js";
import { guardLoaded, getPaths, parseBody } from "$lib/server/helpers.js";

/**
 * POST /api/trash/delete
 * Body: { filename }
 *
 * Permanently delete a single file from trash/.
 */
export const POST: RequestHandler = async ({ request }) => {
  const err = guardLoaded();
  if (err) return err;

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const { filename } = body;
  if (!isValidFilename(filename)) return json({ ok: false, error: "Invalid filename" }, { status: 400 });

  const paths = getPaths();
  const fp = path.join(paths.trash, filename as string);

  if (!fs.existsSync(fp)) return json({ ok: false, error: "Trash file not found" }, { status: 404 });

  try {
    fs.unlinkSync(fp);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
};
