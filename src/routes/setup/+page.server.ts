import type { PageServerLoad } from "./$types.js";
import { getCollectionRoot } from "$lib/server/config.js";

export const load: PageServerLoad = () => {
  return {
    collectionRoot: getCollectionRoot(),
  };
};
