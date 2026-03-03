import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { isValidId } from "$lib/server/validation.js";

/**
 * POST /api/maintenance/remove-missing
 * Body: { id }
 * Removes a DB record for an image whose file no longer exists on disk.
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { id } = body as Record<string, unknown>;
  if (!isValidId(id)) {
    return json({ ok: false, error: "Invalid image ID" }, { status: 400 });
  }

  try {
    db.removeMissing(id as string);
    return json({ ok: true });
  } catch (e) {
    const err = e as Error;
    if (err.message?.includes("not found")) {
      return json({ ok: false, error: "Image not found" }, { status: 404 });
    }
    throw e;
  }
};
