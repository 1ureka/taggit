import type { PageServerLoad } from "./$types.js";
import { getStagedFiles } from "$lib/server/helpers.js";

export const load: PageServerLoad = () => {
  return { stagedFiles: getStagedFiles() };
};
