import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import type { ListOptions } from "$lib/types.js";

/** GET /api/images — list images with optional filters */
export const GET: RequestHandler = ({ url }) => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const p = url.searchParams;
  const tagsParam = p.get("tags");
  const opts: ListOptions = {
    tags: tagsParam
      ? tagsParam
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [],
    rating: p.has("rating") ? Number(p.get("rating")) : undefined,
    ratingOp: (p.get("ratingOp") as ListOptions["ratingOp"]) ?? "gte",
    sort: (p.get("sort") as ListOptions["sort"]) ?? "committedAt",
    order: (p.get("order") as ListOptions["order"]) ?? "desc",
    page: p.has("page") ? Number(p.get("page")) : 1,
    limit: p.has("limit") ? Number(p.get("limit")) : 50,
  };

  const result = db.listImages(opts);
  return json({ ok: true, data: result });
};
