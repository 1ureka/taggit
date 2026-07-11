import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { Database } from "$lib/poc/database";
import { Query } from "$lib/poc/query";
import { ImageQuery, TagFacetQuery } from "$lib/poc/query-spec";

export const load: PageServerLoad = ({ url }) => {
  if (!Database.isLoaded()) throw redirect(303, "/settings?alert=error");
  const query = new Query(Database.requireLoaded());

  const result = query.images(ImageQuery.fromSearchParams(url.searchParams));
  const facets = query.facets(TagFacetQuery.fromSearchParams(url.searchParams));

  return { items: result.items, total: result.total, facets: facets.items };
};
