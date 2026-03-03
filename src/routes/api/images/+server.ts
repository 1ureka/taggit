import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getDB } from "$lib/server/db.js";
import { queryImages } from "$lib/server/db-query.js";
import { parseQueryParams } from "$lib/utils.js";
import { guardLoaded } from "$lib/server/helpers.js";

/**
 * GET /api/images — query images with optional filters + pagination
 * (sort random + limit = 2 can be used for `/random-pair` page)
 */
export const GET: RequestHandler = ({ url }) => {
  const err = guardLoaded();
  if (err) return err;
  return json({ ok: true, data: queryImages(getDB(), parseQueryParams(url)) });
};
