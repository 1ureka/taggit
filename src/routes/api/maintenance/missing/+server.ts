import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";

/** GET /api/maintenance/missing — list DB records whose committed file is missing from disk */
export const GET: RequestHandler = () => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const missing = db.findMissing();
  return json({ ok: true, data: { missing } });
};
