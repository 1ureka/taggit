import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { ImageQuery } from "$lib/query-spec";

export const load: PageServerLoad = ({ url }) => {
  if (!Database.isLoaded()) throw redirect(303, "/settings?alert=error");
  const query = new Query(Database.requireLoaded());

  const result = query.images(ImageQuery.fromSearchParams(url.searchParams));

  // 空結果時退回主頁，保留當下的篩選查詢
  if (result.total === 0) {
    const home = new URL(url);
    home.pathname = "/";
    throw redirect(302, home);
  }

  return { images: result.items, total: result.total };
};
