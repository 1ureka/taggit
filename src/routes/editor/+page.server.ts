import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { Database } from "$lib/poc/database";
import { Query } from "$lib/poc/query";
import { ImageQuery, TagFacetQuery, TagQuery, TagWhere } from "$lib/poc/query-spec";

export const load: PageServerLoad = ({ url }) => {
  if (!Database.isLoaded()) throw redirect(303, "/settings?alert=error");

  const query = new Query(Database.requireLoaded());
  const base = ImageQuery.fromSearchParams(url.searchParams);

  const { items: committedFiles } = query.images(base.with({ list: base.list.with({ limit: 0 }) }));
  const { items: facets } = query.facets(TagFacetQuery.fromSearchParams(url.searchParams));
  const { items: authoringTags } = query.tags(new TagQuery(new TagWhere({ universe: "all" })));

  const requestedId = url.searchParams.get("currentId");
  let resolvedId: string | null = null; // fallback: URL 指定 → 篩選結果第一張 → null

  for (const item of committedFiles) {
    if (item.id === requestedId) resolvedId = item.id;
  }

  if (!resolvedId && committedFiles.length > 0) {
    resolvedId = committedFiles[0].id;
  }

  const currentRecord = resolvedId ? query.getImage(resolvedId) : null;
  return { committedFiles, currentRecord, facets, authoringTags };
};
