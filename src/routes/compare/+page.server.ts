import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import * as database from "$lib/database/server.js";

export const load: PageServerLoad = ({ url }) => {
  if (!database.isLoaded()) throw redirect(303, "/settings?alert=error");

  const result = database.queryImages(url.searchParams, { sort: "random", limit: 2 });
  return { pairs: result.items, total: result.total, facets: result.facets };
};
