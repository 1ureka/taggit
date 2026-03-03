import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { guardLoaded } from "$lib/server/helpers.js";

/** GET /api/tags — list all tags with counts, sorted by count desc */
export const GET: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;
  return json({ ok: true, data: { tags: db.getAllTags() } });
};
