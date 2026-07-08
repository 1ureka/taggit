import type { LayoutServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import * as collection from "$lib/collection/server.js";
import * as database from "$lib/database/server.js";
import * as image from "$lib/image/server.js";

const loadSettings = () => {
  const root = collection.getActiveRoot() ?? collection.getCollectionRoot();
  const collectionName = collection.getCollectionName(root);

  if (root && collection.isCollectionValid(root) && database.isLoaded()) {
    const paths = collection.getCollectionPaths(root);
    const committedCount = database.getImageCount();
    const stagedCount = image.listImageFiles(paths.images).filter((f) => !database.hasImage(f)).length;

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
  database.ensureLoaded(collection.getCollectionPaths(root).db);

  const paths = collection.getCollectionPaths(root);
  const committedCount = database.getImageCount();
  const stagedCount = image.listImageFiles(paths.images).filter((f) => !database.hasImage(f)).length;

  return { collectionName, committedCount, stagedCount };
};

export const load: LayoutServerLoad = ({ url }) => {
  if (url.pathname.startsWith("/settings")) {
    return loadSettings();
  } else {
    return loadOther();
  }
};
