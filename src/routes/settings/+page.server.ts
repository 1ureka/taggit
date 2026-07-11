import type { PageServerLoad } from "./$types.js";
import * as collection from "$lib/collection/server.js";
import { Database } from "$lib/poc/database";
import { Query } from "$lib/poc/query";
import { TagQuery, TagWhere } from "$lib/poc/query-spec";
import { getCacheStats } from "$lib/image/server.js";

const loadAuthoringTags = () => {
  if (!Database.isLoaded()) return [];
  const query = new Query(Database.requireLoaded());
  return query.tags(new TagQuery(new TagWhere({ universe: "all" }))).items;
};

export const load: PageServerLoad = () => {
  return {
    collectionRoot: collection.getCollectionRoot() ?? "",
    cacheStats: getCacheStats(),
    databaseLoaded: Database.isLoaded(),
    authoringTags: loadAuthoringTags(),
  };
};
