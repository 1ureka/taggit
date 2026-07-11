import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types.js";

import { ImageLibrary } from "$lib/image/server";
import { Collection } from "$lib/collection";
import { Database } from "$lib/database";
import { Query } from "$lib/query";

const loadSettings = () => {
  const root = Collection.getActiveRoot() ?? Collection.getPersistedRoot();
  const collectionName = Collection.nameOf(root);

  if (root && Collection.isValid(root) && Database.isLoaded() && ImageLibrary.isActive()) {
    const query = new Query(Database.requireLoaded());
    const committedCount = query.getImageCount();
    const stagedCount = ImageLibrary.list().filter((f) => !query.hasImage(f)).length;

    return { collectionName, committedCount, stagedCount };
  }

  return { collectionName };
};

const loadOther = () => {
  const root = Collection.getActiveRoot() ?? Collection.getPersistedRoot();
  const collectionName = Collection.nameOf(root);

  if (!root) {
    throw redirect(303, "/settings?alert=default");
  }

  if (!Collection.isValid(root)) {
    throw redirect(303, "/settings?alert=error");
  }

  Collection.setActiveRoot(root);
  Database.ensureLoaded(Collection.paths(root).db);
  ImageLibrary.ensureActive(Collection.paths(root).images);

  const query = new Query(Database.requireLoaded());
  const committedCount = query.getImageCount();
  const stagedCount = ImageLibrary.list().filter((f) => !query.hasImage(f)).length;

  return { collectionName, committedCount, stagedCount };
};

export const load: LayoutServerLoad = ({ url }) => {
  if (url.pathname.startsWith("/settings")) {
    return loadSettings();
  } else {
    return loadOther();
  }
};
