import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { queryImages } from "$lib/server/db-query.js";
import { parseQueryParams } from "$lib/utils.js";
import { requireDatabase } from "$lib/server/helpers.js";

const MAX_IMAGES = 200;

export const load: PageServerLoad = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  // Force limit to MAX_IMAGES and ratingOp to gte
  const opts = parseQueryParams(url);
  opts.limit = MAX_IMAGES;
  opts.ratingOp = "gte";

  const result = queryImages(loaded.db, opts);

  // If no images match, redirect back to filter
  if (result.total === 0) {
    throw redirect(302, "/browse");
  }

  return {
    images: result.items,
    total: result.total,
  };
};
