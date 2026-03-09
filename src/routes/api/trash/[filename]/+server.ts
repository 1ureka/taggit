import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";
import { requirePaths, uniqueFilename } from "$lib/server/helpers.js";

/**
 * POST /api/trash/[filename] — restore file from trash back to staged/.
 */
export const POST: RequestHandler = ({ params }) => {
  const paths = requirePaths();
  if (!paths) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const filename = params.filename!;
  const src = path.join(paths.trash, filename);

  if (!fs.existsSync(src)) return json({ ok: false, error: "Trash file not found" }, { status: 404 });

  const stagedName = uniqueFilename(paths.staged, filename);
  fs.renameSync(src, path.join(paths.staged, stagedName));

  return json({ ok: true, data: { stagedName } });
};

/**
 * DELETE /api/trash/[filename] — permanently delete a single file from trash/.
 */
export const DELETE: RequestHandler = ({ params }) => {
  const paths = requirePaths();
  if (!paths) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const filename = params.filename!;
  const fp = path.join(paths.trash, filename);

  if (!fs.existsSync(fp)) return json({ ok: false, error: "Trash file not found" }, { status: 404 });

  try {
    fs.unlinkSync(fp);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
};
