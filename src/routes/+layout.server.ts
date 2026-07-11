import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types.js";

import * as image from "$lib/image/server.js";
import { Collection } from "$lib/collection";
import { Database } from "$lib/database";
import { Query } from "$lib/query";

const loadSettings = () => {
  const root = Collection.getActiveRoot() ?? Collection.getPersistedRoot();
  const collectionName = Collection.nameOf(root);

  if (root && Collection.isValid(root) && Database.isLoaded()) {
    const query = new Query(Database.requireLoaded());
    const paths = Collection.paths(root);
    const committedCount = query.getImageCount();
    const stagedCount = image.listImageFiles(paths.images).filter((f) => !query.hasImage(f)).length;

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

  const query = new Query(Database.requireLoaded());
  const paths = Collection.paths(root);
  const committedCount = query.getImageCount();
  const stagedCount = image.listImageFiles(paths.images).filter((f) => !query.hasImage(f)).length;

  return { collectionName, committedCount, stagedCount };
};

export const load: LayoutServerLoad = ({ url }) => {
  if (url.pathname.startsWith("/settings")) {
    return loadSettings();
  } else {
    return loadOther();
  }
};
