import { error, json, type RequestHandler } from "@sveltejs/kit";

import { Collection } from "$lib/collection";
import { Database } from "$lib/database";
import { ImageLibrary } from "$lib/image/server";
import { parseJsonObject } from "$lib/utils/server";

/** 圖片集的表示：持久化的根目錄、顯示名稱，以及後端是否已就緒 */
function represent(root: string | null) {
  return {
    root: root ?? "",
    name: Collection.nameOf(root),
    loaded: Database.isLoaded() && ImageLibrary.isActive(),
  };
}

/**
 * `GET /api/collection`
 *
 * 取得目前的圖片集設定與就緒狀態。
 *
 * 這是唯一不需要圖片集就緒的資源——沒有它使用者就無從設定第一個圖片集。
 * 刻意不回傳 `valid`：`Collection.isValid()` 會順手建立 images/ 子目錄，GET 不該有副作用。
 */
export const GET: RequestHandler = () => {
  return json(represent(Collection.getPersistedRoot()));
};

/**
 * `PUT /api/collection`
 *
 * 設定圖片集根目錄。整體覆寫唯一的一份設定，因此是 PUT 而非 POST。
 * Body: `{ root: string }`
 */
export const PUT: RequestHandler = async ({ request }) => {
  const body = await parseJsonObject(request);

  const raw = body.root;
  if (typeof raw !== "string" || raw.trim().length === 0) error(400, "無效的圖片集路徑");

  const root = raw.trim();
  if (!Collection.isValid(root)) error(422, "路徑不存在或無法建立所需的子目錄");

  const paths = Collection.paths(root);
  Collection.setPersistedRoot(root);
  Collection.setActiveRoot(root);
  Database.ensureLoaded(paths.db);
  ImageLibrary.ensureActive(paths.images);

  return json(represent(root));
};
