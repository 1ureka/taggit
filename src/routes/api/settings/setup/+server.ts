import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as config from "$lib/server/config.js";
import { requireDatabase } from "$lib/server/db-instance.js";
import { isValidAbsPath } from "$lib/server/validation.js";
import { parseBody } from "$lib/server/helpers.js";

/**
 * `GET /api/settings/setup`
 *
 * 取得目前的圖片集根目錄路徑。
 */
export const GET: RequestHandler = () => {
  const collectionRoot = config.getCollectionRoot();
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
    return json({ ok: false, error: "collectionRoot is required and must be a non-empty string" }, { status: 400 });
  }

  const root = (collectionRoot as string).trim();

  if (!config.isCollectionValid(root)) {
    return json(
      { ok: false, error: "Path does not exist or could not create required subdirectories" },
      { status: 422 },
    );
  }

  config.setCollectionRoot(root);
  requireDatabase({ allowUnload: true }).db.loadCollection(root);

  return json({ ok: true, data: { collectionRoot: root } });
};
