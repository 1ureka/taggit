import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { parseListParams } from "$lib/server/params.js";

/** GET /api/images — list images with optional filters */
export const GET: RequestHandler = ({ url }) => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });
  return json({ ok: true, data: db.listImages(parseListParams(url)) });
};
