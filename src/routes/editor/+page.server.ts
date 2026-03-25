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
  const imageIds = result.items.map((item) => item.id);

  // currentFile fallback: URL 指定 → 篩選結果第一張 → null
  const requestedFile = url.searchParams.get("currentFile");
  const resolvedFile = requestedFile && imageIds.includes(requestedFile) ? requestedFile : (imageIds[0] ?? null);

  const currentRecord = resolvedFile ? getImageRecord(loaded.db, resolvedFile) : null;

  return { imageIds, currentRecord };
};
