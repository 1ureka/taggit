import type { PageServerLoad } from "./$types";

import { Collection } from "$lib/collection";
import { Database } from "$lib/database";
import { ImageLibrary } from "$lib/image/server";

export const load: PageServerLoad = () => {
  return {
    collectionRoot: Collection.getPersistedRoot() ?? "",
    cacheStats: ImageLibrary.stats(),
    databaseLoaded: Database.isLoaded(),
    databaseFileStats: Database.fileStats(),
  };
};
