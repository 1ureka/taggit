import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { getTrashFiles, requireDatabase } from "$lib/server/helpers.js";

const PAGE_SIZE = 30;

export const load: PageServerLoad = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  let allFiles = getTrashFiles(loaded.paths);

  const search = url.searchParams.get("search")?.trim().toLowerCase();
  if (search) {
    allFiles = allFiles.filter((f) => f.toLowerCase().includes(search));
  }

  const total = allFiles.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1), pages);
  const files = allFiles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return { files, total, page, pages };
};
