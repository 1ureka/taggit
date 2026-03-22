import { json, type RequestHandler } from "@sveltejs/kit";
import { requireDatabase } from "$lib/server/db-instance.js";
import { isValidAbsPath } from "$lib/server/validation.js";
import { parseBody } from "$lib/server/helpers.js";
import { getCollectionRoot, isCollectionValid, setCollectionRoot } from "$lib/server/config.js";

/**
 * `GET /api/settings/setup`
 *
 * 取得目前的圖片集根目錄路徑。
 */
export const GET: RequestHandler = () => {
  const collectionRoot = getCollectionRoot();
  return json({ ok: true, data: { collectionRoot } });
};

// ---

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

  if (!isCollectionValid(root)) {
    return json({ ok: false, error: "路徑不存在或無法建立所需的子目錄" }, { status: 422 });
  }

  setCollectionRoot(root);
  requireDatabase({ allowUnload: true }).db.loadCollection(root);

  return json({ ok: true, data: { collectionRoot: root } });
};
