import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";

/** GET /api/trash — list all trashed images */
export const GET: RequestHandler = () => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const items = db.getTrash();
  return json({ ok: true, data: { items } });
};

/** DELETE /api/trash — empty the trash (delete all trashed images permanently) */
export const DELETE: RequestHandler = () => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const count = db.emptyTrash();
  return json({ ok: true, data: { deleted: count } });
};
