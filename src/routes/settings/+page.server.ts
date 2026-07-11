import type { PageServerLoad } from "./$types.js";

import { Collection } from "$lib/collection";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { TagQuery, TagWhere } from "$lib/query-spec";
import { getCacheStats } from "$lib/image/server";

const loadAuthoringTags = () => {
  if (!Database.isLoaded()) return [];
  const query = new Query(Database.requireLoaded());
  return query.tags(new TagQuery(new TagWhere({ universe: "all" }))).items;
};

export const load: PageServerLoad = () => {
  return {
    collectionRoot: Collection.getPersistedRoot() ?? "",
    cacheStats: getCacheStats(),
    databaseLoaded: Database.isLoaded(),
    authoringTags: loadAuthoringTags(),
  };
};
