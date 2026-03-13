import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { queryImages } from "$lib/server/db-query.js";
import { requireDatabase } from "$lib/server/helpers.js";
import { parseQueryParams } from "$lib/utils.js";

export const load: PageServerLoad = async ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const params = parseQueryParams(url);
  const result = queryImages(loaded.db, {
    tags: params.tags,
    rating: params.rating,
    ratingOp: params.rating !== undefined ? "gte" : undefined,
    sort: "random",
    limit: 2,
  });

  return {
    pairA: result.items[0] ?? null,
    pairB: result.items[1] ?? null,
    total: result.total,
  };
};
