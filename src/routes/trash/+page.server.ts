import type { PageServerLoad } from "./$types.js";
import { getTrashFiles } from "$lib/server/helpers.js";

const PAGE_SIZE = 30;

export const load: PageServerLoad = () => {
  const allFiles = getTrashFiles();
  const total = allFiles.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const files = allFiles.slice(0, PAGE_SIZE);

  return {
    files,
    total,
    page: 1,
    pages,
  };
};
