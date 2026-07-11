import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { ImageQuery } from "$lib/query-spec";

export const load: PageServerLoad = ({ url }) => {
  if (!Database.isLoaded()) throw redirect(303, "/settings?alert=error");
  const query = new Query(Database.requireLoaded());

  const result = query.images(ImageQuery.fromSearchParams(url.searchParams));

  if (result.total === 0) {
    const newUrl = new URL(url);
    newUrl.pathname = "/";
    throw redirect(302, newUrl);
  }

  return { images: result.items, total: result.total };
};
