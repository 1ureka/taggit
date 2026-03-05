import type { PageServerLoad } from "./$types.js";
import { getDB } from "$lib/server/db.js";
import { queryImages } from "$lib/server/db-query.js";

/** SSR: 以預設篩選條件（無標籤、無評等限制）預查總數，免去頁面載入後的第一次 client 查詢。 */
export const load: PageServerLoad = () => {
  const db = getDB();
  const result = queryImages(db, { limit: 1 });
  return { initialCount: result.total };
};
