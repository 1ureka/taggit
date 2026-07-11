import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { ImageQuery } from "$lib/query-spec";

export const load: PageServerLoad = ({ url }) => {
  if (!Database.isLoaded()) throw redirect(303, "/settings?alert=error");
  const query = new Query(Database.requireLoaded());

  // 沿用網址上的篩選條件，但隨機抽兩張
  const base = ImageQuery.fromSearchParams(url.searchParams);
  const q = base.with({ list: base.list.with({ sort: "random", limit: 2, page: 1 }) });

  const result = query.images(q);
  return { pairs: result.items, total: result.total };
};
