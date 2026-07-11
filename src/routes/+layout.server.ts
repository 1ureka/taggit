import type { LayoutServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import * as collection from "$lib/collection/server.js";
import * as image from "$lib/image/server.js";
import { Database } from "$lib/database";
import { Query } from "$lib/query";

const loadSettings = () => {
  const root = collection.getActiveRoot() ?? collection.getCollectionRoot();
  const collectionName = collection.getCollectionName(root);

  if (root && collection.isCollectionValid(root) && Database.isLoaded()) {
    const query = new Query(Database.requireLoaded());
    const paths = collection.getCollectionPaths(root);
    const committedCount = query.getImageCount();
    const stagedCount = image.listImageFiles(paths.images).filter((f) => !query.hasImage(f)).length;

    return { collectionName, committedCount, stagedCount };
  }

  return { collectionName };
};

const loadOther = () => {
  const root = collection.getActiveRoot() ?? collection.getCollectionRoot();
  const collectionName = collection.getCollectionName(root);

  if (!root) {
    throw redirect(303, "/settings?alert=default");
  }

  if (!collection.isCollectionValid(root)) {
    throw redirect(303, "/settings?alert=error");
  }

  collection.setActiveRoot(root);
  Database.ensureLoaded(collection.getCollectionPaths(root).db);

  const query = new Query(Database.requireLoaded());
  const paths = collection.getCollectionPaths(root);
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
