import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { parseFilterParams } from "$lib/server/params.js";

/** GET /api/random-pair — return two random images for comparison */
export const GET: RequestHandler = ({ url }) => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const all = db.listAllMatching(parseFilterParams(url));

  if (all.length < 2) return json({ ok: false, error: "Not enough images for comparison (need ≥ 2)" }, { status: 404 });

  const i = Math.floor(Math.random() * all.length);
  let j: number;
  do {
    j = Math.floor(Math.random() * all.length);
  } while (j === i);

  return json({ ok: true, data: { pair: [all[i], all[j]] } });
};
