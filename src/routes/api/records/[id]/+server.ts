import { error, json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { ImageLibrary } from "$lib/image/server";
import { Mutation, type FileInfo } from "$lib/mutation";
import { Query } from "$lib/query";

import { isSafeFilename } from "$lib/utils/shared";
import { parseJson, throwMutationError, log } from "$lib/utils/server";

/**
 * 建立／還原前的檔案側前置檢查，回傳寫入紀錄所需的檔案元資料。
 * 欄位本身的合法性不在這裡判斷，一律留給 mutation 的 Validator。
 */
async function probeOrThrow(id: string): Promise<FileInfo> {
  if (!ImageLibrary.isImageFile(id)) error(400, "非圖片檔案");

  const probed = await ImageLibrary.probe(id);
  if (!probed.ok) error(404, "找不到檔案");

  return probed.data;
}

/**
 * `GET /api/records/[id]`
 *
 * 取得單筆已提交紀錄。
 */
export const GET: RequestHandler = ({ params }) => {
  if (!Database.isLoaded()) error(503, "尚未載入圖片集");

  const { id } = params;
  if (!isSafeFilename(id)) error(400, "無效的檔名");

  const query = new Query(Database.requireLoaded());
  const record = query.getImage(id);
  if (!record) error(404, "找不到目標紀錄");

  return json(record);
};

/**
 * `POST /api/records/[id]`
 *
 * 提交單張圖片（建立紀錄）。id 已有紀錄時回 409。
 */
export const POST: RequestHandler = async ({ params, request }) => {
  if (!Database.isLoaded() || !ImageLibrary.isActive()) error(503, "尚未載入圖片集");

  const { id } = params;
  if (!isSafeFilename(id)) error(400, "無效的檔名");

  const entry = await parseJson(request);
  const file = await probeOrThrow(id);

  const mutation = new Mutation(Database.requireLoaded());
  const r = mutation.commitRecord(id, entry, file);
  if (!r.ok) throwMutationError(r.error);

  log({ level: "info", module: "records/[id]", message: `提交: ${id}` });
  return json(r.data);
};

/**
 * `PUT /api/records/[id]`
 *
 * 還原單筆紀錄（建立或覆寫）。與 POST 的差別只在 id 已存在時直接覆寫而非拒絕。
 */
export const PUT: RequestHandler = async ({ params, request }) => {
  if (!Database.isLoaded() || !ImageLibrary.isActive()) error(503, "尚未載入圖片集");

  const { id } = params;
  if (!isSafeFilename(id)) error(400, "無效的檔名");

  const entry = await parseJson(request);
  const file = await probeOrThrow(id);

  const mutation = new Mutation(Database.requireLoaded());
  const r = mutation.restoreRecord(id, entry, file);
  if (!r.ok) throwMutationError(r.error);

  log({ level: "info", module: "records/[id]", message: `還原: ${id}` });
  return json(r.data);
};

/**
 * `PATCH /api/records/[id]`
 *
 * 更新單筆紀錄的名稱／標籤／評分，以 `expectedUpdatedAt` 做樂觀併發檢查。
 */
export const PATCH: RequestHandler = async ({ params, request }) => {
  if (!Database.isLoaded()) error(503, "尚未載入圖片集");

  const { id } = params;
  if (!isSafeFilename(id)) error(400, "無效的檔名");

  const patch = await parseJson(request);

  const mutation = new Mutation(Database.requireLoaded());
  const r = mutation.updateRecord(id, patch);
  if (!r.ok) throwMutationError(r.error);

  return json(r.data);
};

/**
 * `DELETE /api/records/[id]`
 *
 * 退回：只移除紀錄，實體檔案保留在圖片集內，回到「沒有紀錄的檔案」狀態。
 * 要連檔案一起刪除是另一個決定，走 `DELETE /api/files/[name]`。
 */
export const DELETE: RequestHandler = ({ params }) => {
  if (!Database.isLoaded()) error(503, "尚未載入圖片集");

  const { id } = params;
  if (!isSafeFilename(id)) error(400, "無效的檔名");

  const mutation = new Mutation(Database.requireLoaded());
  const r = mutation.removeRecord(id);
  if (!r.ok) throwMutationError(r.error);

  log({ level: "info", module: "records/[id]", message: `退回: ${id}` });
  return json({ id });
};
