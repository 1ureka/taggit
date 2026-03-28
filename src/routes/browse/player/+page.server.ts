import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { queryImages } from "$lib/server/db-query.js";
import { parseQueryParams } from "$lib/utils.js";
import { requireDatabase } from "$lib/server/db-instance.js";

export const load: PageServerLoad = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const result = queryImages(loaded.db, parseQueryParams(url));

  if (result.total === 0) {
    const newUrl = new URL(url);
    newUrl.pathname = "/scroll";
    throw redirect(302, newUrl);
  }

  return { images: result.items, total: result.total };
};
