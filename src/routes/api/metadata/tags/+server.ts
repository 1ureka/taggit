import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getAllTags } from "$lib/server/db-query.js";
import { renameTag } from "$lib/server/db-mutation.js";
import { parseBody } from "$lib/server/helpers.js";
import { requireDatabase } from "$lib/server/db-instance.js";
import { isValidTags } from "$lib/server/validation.js";

/** GET /api/metadata/tags — list all tags with counts, sorted by count desc */
export const GET: RequestHandler = () => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });
  return json({ ok: true, data: { tags: getAllTags(loaded.db) } });
};

/**
 * POST /api/metadata/tags — rename a tag globally.
 * Body: { oldName, newName }
 */
export const POST: RequestHandler = async ({ request }) => {
  const loaded = requireDatabase();
  if (!loaded) {
    return json({ ok: false, error: "No collection loaded" }, { status: 503 });
  }

  const [body, parseErr] = await parseBody(request);
  if (parseErr) {
    return parseErr;
  }

  const fields = [body.oldName, body.newName];
  if (!isValidTags(fields)) {
    return json({ ok: false, error: "oldName and newName must be valid, distinct tag strings" }, { status: 400 });
  }

  const oldName = fields[0].trim();
  const newName = fields[1].trim();

  const affected = renameTag(loaded.db, oldName, newName);
  return json({ ok: true, data: { affected } });
};
