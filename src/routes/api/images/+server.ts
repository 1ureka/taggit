import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { parseQueryParams } from "$lib/server/params.js";
import { guardLoaded } from "$lib/server/helpers.js";

/** GET /api/images — query images with optional filters + pagination */
export const GET: RequestHandler = ({ url }) => {
  const err = guardLoaded();
  if (err) return err;
  return json({ ok: true, data: db.queryImages(parseQueryParams(url)) });
};
