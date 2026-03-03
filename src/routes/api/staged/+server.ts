import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { guardLoaded, getStagedFiles } from "$lib/server/helpers.js";

/** GET /api/staged — list staged image filenames */
export const GET: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;
  return json({ ok: true, data: { files: getStagedFiles() } });
};
