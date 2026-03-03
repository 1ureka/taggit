import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";

/** GET /api/random-pair — return two random images for comparison */
export const GET: RequestHandler = () => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const pair = db.getRandomPair();
  if (!pair) {
    return json({ ok: false, error: "Not enough images for comparison (need ≥ 2)" }, { status: 404 });
  }

  return json({ ok: true, data: { pair } });
};
