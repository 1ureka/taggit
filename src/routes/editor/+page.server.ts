import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import * as database from "$lib/database/server.js";

export const load: PageServerLoad = ({ url }) => {
  if (!database.isLoaded()) throw redirect(303, "/settings?alert=error");

  const result = database.queryImages(url.searchParams, { limit: 0 });

  const requestedId = url.searchParams.get("currentId");
  let resolvedId: string | null = null; // fallback: URL 指定 → 篩選結果第一張 → null

  for (const item of result.items) {
    if (item.id === requestedId) {
      resolvedId = item.id;
    }
  }

  if (!resolvedId && result.items.length > 0) {
    resolvedId = result.items[0].id;
  }

  const currentRecord = resolvedId ? database.getImage(resolvedId) : null;
  return { committedFiles: result.items, currentRecord, facets: result.facets };
};
