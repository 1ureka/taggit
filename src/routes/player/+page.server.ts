import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import * as database from "$lib/database/server.js";

export const load: PageServerLoad = ({ url }) => {
  if (!database.isLoaded()) throw redirect(303, "/settings?alert=error");

  const result = database.queryImages(url.searchParams);

  if (result.total === 0) {
    const newUrl = new URL(url);
    newUrl.pathname = "/";
    throw redirect(302, newUrl);
  }

  return { images: result.items, total: result.total };
};
