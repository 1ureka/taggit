import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { isValidId } from "$lib/server/validation.js";
import { guardLoaded, parseBody } from "$lib/server/helpers.js";

/**
 * POST /api/maintenance/remove-missing
 * Body: { id }
 * Removes a DB record for an image whose file no longer exists on disk.
 */
export const POST: RequestHandler = async ({ request }) => {
  const err = guardLoaded();
  if (err) return err;

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const { id } = body;
  if (!isValidId(id)) return json({ ok: false, error: "Invalid image ID" }, { status: 400 });

  try {
    db.removeImage(id);
    return json({ ok: true });
  } catch (e) {
    if ((e as Error).message?.includes("not found"))
      return json({ ok: false, error: "Image not found" }, { status: 404 });
    throw e;
  }
};
