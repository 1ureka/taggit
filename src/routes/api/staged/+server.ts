import fs from "fs";
import path from "path";
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { guardLoaded, getStagedFiles, getPaths, uniqueFilename } from "$lib/server/helpers.js";
import { IMG_EXTS } from "$lib/server/config.js";

/** GET /api/staged — list staged image filenames */
export const GET: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;
  return json({ ok: true, data: { files: getStagedFiles() } });
};

/** POST /api/staged — upload (copy) image files into the staged directory */
export const POST: RequestHandler = async ({ request }) => {
  const err = guardLoaded();
  if (err) return err;

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return json({ ok: false, error: "Expected multipart/form-data" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return json({ ok: false, error: "Failed to parse form data" }, { status: 400 });
  }

  const files = formData.getAll("files");
  if (files.length === 0) {
    return json({ ok: false, error: "No files provided" }, { status: 400 });
  }

  const paths = getPaths();
  const added: string[] = [];
  const errors: string[] = [];

  for (const entry of files) {
    if (!(entry instanceof File)) {
      errors.push("Non-file entry skipped");
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!IMG_EXTS.has(ext)) {
      errors.push(`${entry.name}: unsupported format`);
      continue;
    }

    const destName = uniqueFilename(paths.staged, entry.name);
    const destPath = path.join(paths.staged, destName);

    try {
      const buffer = Buffer.from(await entry.arrayBuffer());
      fs.writeFileSync(destPath, buffer);
      added.push(destName);
    } catch (e) {
      errors.push(`${entry.name}: ${(e as Error).message}`);
    }
  }

  if (added.length > 0) {
    return json({ ok: true, data: { added, errors } }, { status: 201 });
  }
  return json({ ok: false, data: { added, errors } }, { status: 400 });
};
