import type { PageServerLoad } from "./$types.js";
import * as collection from "$lib/collection/server.js";
import * as database from "$lib/database/server.js";
import { getCacheStats } from "$lib/image/server.js";

export const load: PageServerLoad = () => {
  return {
    collectionRoot: collection.getCollectionRoot() ?? "",
    cacheStats: getCacheStats(),
    // settings 頁必須在 collection 未載入時可用；已載入時提供全庫標籤給標籤管理的自動完成
    facets: database.isLoaded() ? database.queryTags() : [],
  };
};
