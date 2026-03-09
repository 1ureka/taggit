import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { getStagedFiles } from "$lib/server/helpers.js";
import { requireDatabase } from "$lib/server/helpers.js";

export const load: PageServerLoad = () => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  return { stagedFiles: getStagedFiles(loaded.paths) };
};
