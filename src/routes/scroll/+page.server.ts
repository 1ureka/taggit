import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { queryImages } from "$lib/server/db-query.js";
import { requireDatabase } from "$lib/server/helpers.js";

export const load: PageServerLoad = () => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const result = queryImages(loaded.db, { sort: "committedAt", order: "desc" });
  return { items: result.items, total: result.total };
};
