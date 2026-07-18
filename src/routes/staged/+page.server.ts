import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { ImageLibrary } from "$lib/image/server";
import { TagQuery, TagWhere } from "$lib/query-spec";

export const load: PageServerLoad = () => {
  if (!Database.isLoaded() || !ImageLibrary.isActive()) throw redirect(303, "/settings?alert=error");
  const query = new Query(Database.requireLoaded());

  const stagedFiles = ImageLibrary.list().filter((f) => !query.hasImage(f));
  /** `universe: "all"` 含尚未使用或僅有元資料的標籤，用於判斷這次提交會不會產生新標籤 */
  const existingTagNames = query.tags(new TagQuery(new TagWhere({ universe: "all" }))).items.map((t) => t.name);

  return { stagedFiles, existingTagNames };
};
