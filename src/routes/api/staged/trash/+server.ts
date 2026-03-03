import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as db from "$lib/server/db.js";
import { isValidFilename } from "$lib/server/validation.js";

/**
 * POST /api/staged/trash
 * Body: { filename }
 * Moves a staged file directly to trash (without committing).
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
    db.trashStagedFile(filename as string);
    return json({ ok: true });
  } catch (e) {
    const err = e as Error;
    if (err.message?.includes("not found")) {
      return json({ ok: false, error: "Staged file not found" }, { status: 404 });
    }
    throw e;
  }
};
