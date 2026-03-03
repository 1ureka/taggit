import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { isValidId } from "$lib/server/validation.js";

/** DELETE /api/trash/[id] — permanently delete a single trashed image */
export const DELETE: RequestHandler = ({ params }) => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { id } = params;
  if (!isValidId(id)) return json({ ok: false, error: "Invalid image ID" }, { status: 400 });

  try {
    db.deleteTrashedImage(id);
    return json({ ok: true });
  } catch (e) {
    const err = e as Error;
    if (err.message?.includes("not found")) {
      return json({ ok: false, error: "Trashed image not found" }, { status: 404 });
    }
    throw e;
  }
};
