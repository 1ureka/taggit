import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";

/** GET /api/maintenance/orphans — list files in committed/ that have no DB record */
export const GET: RequestHandler = () => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const orphans = db.findOrphans();
  return json({ ok: true, data: { orphans } });
};
