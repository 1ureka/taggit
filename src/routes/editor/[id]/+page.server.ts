import type { PageServerLoad } from "./$types.js";
import { redirect, error } from "@sveltejs/kit";
import { getImage } from "$lib/server/db-query.js";
import { requireDatabase } from "$lib/server/helpers.js";

export const load: PageServerLoad = ({ params }) => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const image = getImage(loaded.db, params.id);
  if (!image) throw error(404, "找不到此圖片");

  return { image };
};
