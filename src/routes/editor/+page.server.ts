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

  const requestedFile = url.searchParams.get("currentFile");
  const committedFiles: { id: string; name: string }[] = [];
  let resolvedFile: string | null = null; // fallback: URL 指定 → 篩選結果第一張 → null

  for (const item of result.items) {
    committedFiles.push({ id: item.id, name: item.name });
    if (item.id === requestedFile) {
      resolvedFile = item.id;
    }
  }

  if (!resolvedFile && committedFiles.length > 0) {
    resolvedFile = committedFiles[0].id;
  }

  const currentRecord = resolvedFile ? getImageRecord(loaded.db, resolvedFile) : null;
  return { committedFiles, currentRecord };
};
