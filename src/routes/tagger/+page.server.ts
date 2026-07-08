import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import * as collection from "$lib/collection/server.js";
import * as database from "$lib/database/server.js";
import { listImageFiles } from "$lib/image/server.js";

export const load: PageServerLoad = () => {
  const root = collection.getActiveRoot();
  if (!root || !database.isLoaded()) throw redirect(303, "/settings?alert=error");

  // staged = images/ 中存在、但 db.json 尚無紀錄的圖檔（route 層組合 image × database）
  const paths = collection.getCollectionPaths(root);
  const stagedFiles = listImageFiles(paths.images).filter((f) => !database.hasImage(f));

  return { stagedFiles, facets: database.queryTags() };
};
