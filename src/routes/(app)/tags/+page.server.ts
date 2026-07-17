import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { TagQuery } from "$lib/query-spec";

export const load: PageServerLoad = ({ url }) => {
  if (!Database.isLoaded()) throw redirect(303, "/settings?alert=error");
  const query = new Query(Database.requireLoaded());

  // 池固定含 count 0 的標籤 `universe: "all"`
  const base = TagQuery.fromSearchParams(url.searchParams);
  const spec = base.with({
    where: base.where.with({ universe: "all" }),
    list: base.list.with({ limit: base.list.limit > 0 ? base.list.limit : 100 }),
  });

  const { items, total } = query.tags(spec);
  return { items, total };
};
