import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { ImageQuery } from "$lib/query-spec";

export const load: PageServerLoad = ({ url }) => {
  if (!Database.isLoaded()) throw redirect(303, "/settings?alert=error");
  const query = new Query(Database.requireLoaded());

  const base = ImageQuery.fromSearchParams(url.searchParams);
  const { items, total } = query.images(base.with({ list: base.list.with({ limit: 0 }) }));

  return { items, total };
};
