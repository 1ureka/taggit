import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";

import { Collection } from "$lib/collection";
import { ImageLibrary } from "$lib/image/server";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { TagQuery, TagWhere } from "$lib/query-spec";

export const load: PageServerLoad = () => {
  const root = Collection.getActiveRoot();
  if (!root || !Database.isLoaded() || !ImageLibrary.isActive()) throw redirect(303, "/settings?alert=error");
  const query = new Query(Database.requireLoaded());

  const stagedFiles = ImageLibrary.list().filter((f) => !query.hasImage(f));
  const authoringTags = query.tags(new TagQuery(new TagWhere({ universe: "all" })));

  return { stagedFiles, authoringTags: authoringTags.items };
};
