import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { queryImages } from "$lib/server/db-query.js";
import { parseQueryParams } from "$lib/utils.js";
import { requireDatabase } from "$lib/server/helpers.js";

/**
 * GET /api/images — query images with optional filters + pagination
 * (sort random + limit = 2 is used by the /compare page)
 */
export const GET: RequestHandler = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });
  return json({ ok: true, data: queryImages(loaded.db, parseQueryParams(url)) });
};
