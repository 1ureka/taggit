import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { getTrashFiles } from "$lib/server/helpers.js";
import { requireDatabase } from "$lib/server/helpers.js";

const PAGE_SIZE = 30;

export const load: PageServerLoad = () => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const allFiles = getTrashFiles(loaded.paths);
  const total = allFiles.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const files = allFiles.slice(0, PAGE_SIZE);

  return { files, total, pages };
};
