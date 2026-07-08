import type { PageServerLoad } from "./$types.js";
import * as collection from "$lib/collection/server.js";
import * as database from "$lib/database/server.js";
import { getCacheStats } from "$lib/image/server.js";

export const load: PageServerLoad = () => {
  return {
    collectionRoot: collection.getCollectionRoot() ?? "",
    cacheStats: getCacheStats(),
    databaseLoaded: database.isLoaded(),
    authoringTags: database.isLoaded() ? database.queryTags(undefined, { hidden: "ignore", universe: "all" }) : [],
  };
};
