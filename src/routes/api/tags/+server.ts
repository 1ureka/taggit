import { json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/poc/database";
import { Mutation } from "$lib/poc/mutation";

import { parseBody, errorJson, log } from "$lib/utils/server";

/**
 * `POST /api/tags`
 *
 * 全域重新命名標籤。
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const [body, parseErr] = await parseBody(request);
  if (parseErr) {
    return parseErr;
  }

  const mutation = new Mutation(Database.requireLoaded());
  const r = mutation.renameTag(body.oldName, body.newName);
  if (!r.ok) return errorJson(r.error);

  log({ level: "info", module: "tags", message: `重命名標籤: "${body.oldName}" → "${body.newName}"`, data: r.data });
  return json({ ok: true, data: r.data });
};
