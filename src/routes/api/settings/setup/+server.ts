import { json, type RequestHandler } from "@sveltejs/kit";
import * as collection from "$lib/collection/server.js";
import * as database from "$lib/database/server.js";
import { parseBody } from "$lib/server/helpers.js";

/**
 * `GET /api/settings/setup`
 *
 * 取得目前的圖片集根目錄路徑。
 */
export const GET: RequestHandler = () => {
  const collectionRoot = collection.getCollectionRoot();
  return json({ ok: true, data: { collectionRoot } });
};

// ---

/** 絕對路徑看起來合理（非空字串）。 */
function isValidAbsPath(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * `POST /api/settings/setup`
 *
 * 設定新的圖片集根目錄路徑。
 */
export const POST: RequestHandler = async ({ request }) => {
  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const { collectionRoot } = body;

  if (!isValidAbsPath(collectionRoot)) {
    return json({ ok: false, error: "無效的集合根目錄路徑" }, { status: 400 });
  }

  const root = collectionRoot.trim();

  if (!collection.isCollectionValid(root)) {
    return json({ ok: false, error: "路徑不存在或無法建立所需的子目錄" }, { status: 422 });
  }

  collection.setCollectionRoot(root);
  collection.setActiveRoot(root);
  database.ensureLoaded(collection.getCollectionPaths(root).db);

  return json({ ok: true, data: { collectionRoot: root } });
};
