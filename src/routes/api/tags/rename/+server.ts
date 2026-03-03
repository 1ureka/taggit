import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";

/**
 * POST /api/tags/rename
 * Body: { oldName, newName }
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { oldName, newName } = body as Record<string, unknown>;

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
