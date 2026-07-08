import type { LayoutServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import * as collection from "$lib/collection/server.js";
import * as database from "$lib/database/server.js";
import * as image from "$lib/image/server.js";

export const load: LayoutServerLoad = ({ url }) => {
  // 記憶體優先；只有尚未有作用中 collection（通常代表首次載入）才讀 server.json（避免每次請求都做 I/O）
  const root = collection.getActiveRoot() ?? collection.getCollectionRoot();
  const collectionName = collection.getCollectionName(root);

  if (url.pathname.startsWith("/settings")) return { collectionName };

  if (!root) {
    throw redirect(303, "/settings?alert=default");
  }

  if (!collection.isCollectionValid(root)) {
    throw redirect(303, "/settings?alert=error");
  }

  collection.setActiveRoot(root);
  database.ensureLoaded(collection.getCollectionPaths(root).db);

  // 導航 dialog 用：committed 為 db 全部紀錄數，staged 為 images/ 中尚無 db 紀錄的檔案數
  const paths = collection.getCollectionPaths(root);
  const committedCount = database.getImageCount();
  const stagedCount = image.listImageFiles(paths.images).filter((f) => !database.hasImage(f)).length;

  return { collectionName, committedCount, stagedCount };
};
