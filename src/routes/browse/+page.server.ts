import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { queryImages } from "$lib/server/db-query.js";
import { requireDatabase } from "$lib/server/helpers.js";

/** SSR: 以預設篩選條件（無標籤、無評等限制）預查總數，免去頁面載入後的第一次 client 查詢。 */
export const load: PageServerLoad = () => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const result = queryImages(loaded.db, { limit: 1 });
  return { matchCount: result.total };
};
