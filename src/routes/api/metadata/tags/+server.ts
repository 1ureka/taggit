import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getAllTags } from "$lib/server/db-query.js";
import { renameTag } from "$lib/server/db-mutation.js";
import { parseBody, requireDatabase } from "$lib/server/helpers.js";

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
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const [body, parseErr] = await parseBody(request);
  if (parseErr) return parseErr;

  const oldName = body.oldName?.toString().trim();
  const newName = body.newName?.toString().trim();

  if (!oldName) return json({ ok: false, error: "oldName is required" }, { status: 400 });
  if (!newName) return json({ ok: false, error: "newName is required" }, { status: 400 });
  if (oldName === newName) return json({ ok: false, error: "oldName and newName must differ" }, { status: 400 });

  const affected = renameTag(loaded.db, oldName, newName);
  return json({ ok: true, data: { affected } });
};
