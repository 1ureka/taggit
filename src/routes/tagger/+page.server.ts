import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";

import * as collection from "$lib/collection/server.js";
import { listImageFiles } from "$lib/image/server.js";

import { Database } from "$lib/poc/database";
import { Query } from "$lib/poc/query";
import { TagQuery, TagWhere } from "$lib/poc/query-spec";

export const load: PageServerLoad = () => {
  const root = collection.getActiveRoot();
  if (!root || !Database.isLoaded()) throw redirect(303, "/settings?alert=error");
  const query = new Query(Database.requireLoaded());

  const paths = collection.getCollectionPaths(root);
  const stagedFiles = listImageFiles(paths.images).filter((f) => !query.hasImage(f));
  const authoringTags = query.tags(new TagQuery(new TagWhere({ universe: "all" })));

  return { stagedFiles, authoringTags: authoringTags.items };
};
