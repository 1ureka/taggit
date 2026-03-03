import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import * as config from "$lib/server/config.js";
import * as db from "$lib/server/db.js";
import { isValidAbsPath } from "$lib/server/validation.js";

/** GET /api/setup — return current collectionRoot */
export const GET: RequestHandler = () => {
  const collectionRoot = config.getCollectionRoot();
  return json({ ok: true, data: { collectionRoot } });
};

/** POST /api/setup — set a new collectionRoot */
export const POST: RequestHandler = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { collectionRoot } = body as Record<string, unknown>;

  if (!isValidAbsPath(collectionRoot)) {
    return json({ ok: false, error: "collectionRoot is required and must be a non-empty string" }, { status: 400 });
  }

  const root = (collectionRoot as string).trim();

  if (!config.isCollectionValid(root)) {
    return json(
      { ok: false, error: "Path does not exist or could not create required subdirectories" },
      { status: 422 },
    );
  }

  config.setCollectionRoot(root);
  db.loadCollection(root);

  return json({ ok: true, data: { collectionRoot: root } });
};
