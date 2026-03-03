import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { isValidFilename } from "$lib/server/validation.js";

/**
 * POST /api/maintenance/import-orphan
 * Body: { filename }
 * Creates a DB record for an orphaned file in committed/.
 */
export const POST: RequestHandler = async ({ request }) => {
  if (!db.isLoaded()) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { filename } = body as Record<string, unknown>;
  if (!isValidFilename(filename)) {
    return json({ ok: false, error: "Invalid filename" }, { status: 400 });
  }

  try {
    const result = db.importOrphan(filename as string);
    return json({ ok: true, data: result }, { status: 201 });
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      return json({ ok: false, error: "File not found in committed/" }, { status: 404 });
    }
    throw e;
  }
};
