import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { TagQuery, TagWhere } from "$lib/query-spec";
import { buildTagCleanupSuggestions } from "./suggestions";

export const load: PageServerLoad = async () => {
  if (!Database.isLoaded()) throw redirect(303, "/settings?alert=error");
  const query = new Query(Database.requireLoaded());

  const { items: tags } = query.tags(new TagQuery(new TagWhere({ universe: "all" })));
  const suggestions = await buildTagCleanupSuggestions(tags, query.getAllImages());

  return { suggestions };
};
