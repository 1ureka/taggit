import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getDB } from "$lib/server/db.js";
import { getAllTags } from "$lib/server/db-query.js";
import { renameTag } from "$lib/server/db-mutation.js";
import { guardLoaded, parseBody } from "$lib/server/helpers.js";

/** GET /api/metadata/tags — list all tags with counts, sorted by count desc */
export const GET: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;
  return json({ ok: true, data: { tags: getAllTags(getDB()) } });
};

/**
 * POST /api/metadata/tags — rename a tag globally.
 * Body: { oldName, newName }
 */
export const POST: RequestHandler = async ({ request }) => {
  const err = guardLoaded();
  if (err) return err;

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const { oldName, newName } = body;

  if (typeof oldName !== "string" || oldName.trim() === "")
    return json({ ok: false, error: "oldName is required" }, { status: 400 });
  if (typeof newName !== "string" || newName.trim() === "")
    return json({ ok: false, error: "newName is required" }, { status: 400 });
  if (oldName.trim() === newName.trim())
    return json({ ok: false, error: "oldName and newName must differ" }, { status: 400 });

  const affected = renameTag(getDB(), oldName.trim(), newName.trim());
  return json({ ok: true, data: { affected } });
};
