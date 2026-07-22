import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { ImageLibrary } from "$lib/image/server";

export const load: PageServerLoad = () => {
  if (!Database.isLoaded() || !ImageLibrary.isActive()) throw redirect(303, "/settings?alert=error");
  const query = new Query(Database.requireLoaded());

  const stagedFiles = ImageLibrary.list().filter((f) => !query.hasImage(f));

  return { stagedFiles };
};
