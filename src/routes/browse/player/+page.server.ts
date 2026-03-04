import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types.js";
import { getDB } from "$lib/server/db.js";
import { queryImages } from "$lib/server/db-query.js";
import { parseQueryParams } from "$lib/utils.js";

const MAX_IMAGES = 200;

export const load: PageServerLoad = ({ url }) => {
  const db = getDB();
  const opts = parseQueryParams(url);

  // Force limit to MAX_IMAGES and ratingOp to gte
  opts.limit = MAX_IMAGES;
  opts.ratingOp = "gte";

  const result = queryImages(db, opts);

  // If no images match, redirect back to filter
  if (result.total === 0) {
    redirect(302, "/browse");
  }

  return {
    images: result.items,
    total: result.total,
  };
};
