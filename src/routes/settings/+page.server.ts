import type { PageServerLoad } from "./$types.js";
import { getCollectionRoot } from "$lib/server/config.js";
import { getCacheStats } from "$lib/server/thumbnail.js";

export const load: PageServerLoad = () => {
  return {
    collectionRoot: getCollectionRoot() ?? "",
    cacheStats: getCacheStats(),
  };
};
