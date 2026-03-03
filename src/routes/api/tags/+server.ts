import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";

/** GET /api/tags — list all tags with counts, sorted by count desc */
export const GET: RequestHandler = () => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const tags = db.getAllTags();
  return json({ ok: true, data: { tags } });
};
