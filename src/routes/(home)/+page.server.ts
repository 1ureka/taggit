import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";

import { requireDatabase } from "$lib/server/db-instance.js";
import { queryImages, getImageRecord } from "$lib/server/db-query.js";
import { parseQueryParams } from "$lib/utils.js";

export const load: PageServerLoad = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const result = queryImages(loaded.db, parseQueryParams(url));

  const modalId = url.searchParams.get("modal");
  const modalRecord = modalId ? getImageRecord(loaded.db, modalId) : null;

  return { items: result.items, total: result.total, modalRecord };
};
