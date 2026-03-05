import type { PageServerLoad } from "./$types.js";
import { getDB } from "$lib/server/db.js";
import { getAllTags } from "$lib/server/db-query.js";

// TODO: 改為一開始就根據預設的 filterStore 狀態來查詢，並在 actions 裡面提供一個 resetFilter() 來重置 filterStore 並重新查詢。這樣就不需要在 load 裡面做任何事情了。
export const load: PageServerLoad = () => {
  const db = getDB();
  return { allTags: getAllTags(db) };
};
