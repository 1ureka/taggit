import type { PageServerLoad } from "./$types.js";
import { redirect, error } from "@sveltejs/kit";
import { getImageRecord } from "$lib/server/db-query.js";
import { requireDatabase } from "$lib/server/db-instance.js";

export const load: PageServerLoad = ({ params }) => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const image = getImageRecord(loaded.db, params.id);
  if (!image) throw error(404, "找不到此圖片");

  return { image };
};
