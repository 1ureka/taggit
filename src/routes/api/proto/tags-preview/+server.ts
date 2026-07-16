import { json, type RequestHandler } from "@sveltejs/kit";

import { Database } from "$lib/database";
import { projectChangeset } from "$lib/query";

import { isRecord } from "$lib/utils/shared";
import { parseBody } from "$lib/utils/server";

/**
 * `POST /api/proto/tags-preview`
 *
 * 原型專用：標籤變更集的套用前預覽（純讀取，不寫入）。
 * Body 與 `api/proto/tags-batch` 同構：`{ deletes?: string[], renames?: [{ from, to }], hidden?: [{ name, hidden }] }`
 * 回傳 `{ tags, mergedCounts, emptiedBy, emptiedTotal }`，供 /tags 的畫布即時預估與審查 modal 共用。
 * 格式無效的項目靜默略過（預覽端點，寬鬆處理；真正的把關在 tags-batch 送出時）。
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!Database.isLoaded()) {
    return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  }

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const deletes = (Array.isArray(body.deletes) ? body.deletes : []).filter(
    (x): x is string => typeof x === "string",
  );
  const renames = (Array.isArray(body.renames) ? body.renames : [])
    .filter((x): x is Record<string, unknown> => isRecord(x) && typeof x.from === "string" && typeof x.to === "string")
    .map((x) => ({ from: x.from as string, to: x.to as string }));
  const hidden = (Array.isArray(body.hidden) ? body.hidden : [])
    .filter((x): x is Record<string, unknown> => isRecord(x) && typeof x.name === "string" && typeof x.hidden === "boolean")
    .map((x) => ({ name: x.name as string, hidden: x.hidden as boolean }));

  if (deletes.length + renames.length + hidden.length === 0) {
    return json({ ok: false, error: "變更集為空" }, { status: 400 });
  }

  const projection = projectChangeset(Database.requireLoaded(), { deletes, renames, hidden });
  return json({ ok: true, data: projection });
};
