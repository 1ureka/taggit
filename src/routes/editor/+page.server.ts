import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";

import { requireDatabase } from "$lib/server/db-instance.js";
import { queryImages, getImageRecord } from "$lib/server/db-query.js";
import { parseQueryParams } from "$lib/utils.js";

export const load: PageServerLoad = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const opts = parseQueryParams(url);
  const result = queryImages(loaded.db, { ...opts, limit: 0 });

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

  const currentRecord = resolvedId ? getImageRecord(loaded.db, resolvedId) : null;
  return { committedFiles: result.items, currentRecord };
};
