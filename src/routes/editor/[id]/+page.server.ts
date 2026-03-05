import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types.js";
import { getDB } from "$lib/server/db.js";
import { getImage } from "$lib/server/db-query.js";

export const load: PageServerLoad = ({ params }) => {
  const db = getDB();
  const image = getImage(db, params.id);

  if (!image) {
    error(404, "找不到此圖片");
  }

  return { image };
};
