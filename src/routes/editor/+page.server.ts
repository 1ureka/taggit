import type { PageServerLoad } from "./$types.js";
import { getDB } from "$lib/server/db.js";
import { getAllTags, getImage, queryImages } from "$lib/server/db-query.js";

export const load: PageServerLoad = ({ url }) => {
  const db = getDB();
  const id = url.searchParams.get("id");

  if (id) {
    const image = getImage(db, id);
    return {
      mode: "edit" as const,
      image,
      allTags: getAllTags(db),
    };
  }

  // Search mode — preload recent images
  const recent = queryImages(db, { limit: 60, sort: "committedAt", order: "desc" });
  return {
    mode: "search" as const,
    recent,
    allTags: getAllTags(db),
  };
};
