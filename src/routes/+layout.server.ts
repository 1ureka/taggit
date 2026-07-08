import type { LayoutServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import * as collection from "$lib/collection/server.js";
import * as database from "$lib/database/server.js";

export const load: LayoutServerLoad = ({ url }) => {
  if (url.pathname.startsWith("/settings")) return;

  // 記憶體優先；只有尚未有作用中 collection（通常代表首次載入）才讀 server.json（避免每次請求都做 I/O）
  const root = collection.getActiveRoot() ?? collection.getCollectionRoot();

  if (!root) {
    throw redirect(303, "/settings?alert=default");
  }

  if (!collection.isCollectionValid(root)) {
    throw redirect(303, "/settings?alert=error");
  }

  collection.setActiveRoot(root);
  database.ensureLoaded(collection.getCollectionPaths(root).db);
};
