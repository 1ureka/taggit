import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { guardLoaded, parseBody } from "$lib/server/helpers.js";

/**
 * POST /api/tags/rename
 * Body: { oldName, newName }
 */
export const POST: RequestHandler = async ({ request }) => {
  const err = guardLoaded();
  if (err) return err;

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const { oldName, newName } = body;

  if (typeof oldName !== "string" || oldName.trim() === "") {
    return json({ ok: false, error: "oldName is required" }, { status: 400 });
  }
  if (typeof newName !== "string" || newName.trim() === "") {
    return json({ ok: false, error: "newName is required" }, { status: 400 });
  }
  if (oldName === newName) {
    return json({ ok: false, error: "oldName and newName must differ" }, { status: 400 });
  }

  const affected = db.renameTag(oldName.trim(), newName.trim());
  return json({ ok: true, data: { affected } });
};
