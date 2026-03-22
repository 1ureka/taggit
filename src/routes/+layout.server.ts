import type { LayoutServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { requireDatabase } from "$lib/server/db-instance.js";
import { getCollectionRoot } from "$lib/server/config.js";
import { isCollectionValid } from "$lib/server/config.js";

export const load: LayoutServerLoad = ({ url }) => {
  if (url.pathname.startsWith("/settings")) return;

  // DB 記憶體優先；只有尚未載入 (通常代表首次載入) 時才讀 server.json (避免每次請求都做 I/O)
  const { db: jsonDB } = requireDatabase({ allowUnload: true });
  const root = jsonDB.getCurrentRoot() ?? getCollectionRoot();

  if (!root) {
    throw redirect(303, "/settings?alert=default");
  }

  if (!isCollectionValid(root)) {
    throw redirect(303, "/settings?alert=error");
  }

  if (!jsonDB.isLoaded() || jsonDB.getCurrentRoot() !== root) {
    jsonDB.loadCollection(root);
  }
};
