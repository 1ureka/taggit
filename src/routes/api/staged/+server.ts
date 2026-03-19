import fs from "fs";
import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";
import { getStagedFiles, uniqueFilename } from "$lib/server/helpers.js";
import { requireDatabase, requirePaths } from "$lib/server/db-instance.js";
import { IMG_EXTS } from "$lib/server/config.js";

/** GET /api/staged — list staged image filenames */
export const GET: RequestHandler = () => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });
  const { db, paths } = loaded;
  return json({ ok: true, data: { files: getStagedFiles(db, paths) } });
};

/** POST /api/staged — upload image files into images/ (not yet committed to db.json) */
export const POST: RequestHandler = async ({ request }) => {
  const paths = requirePaths();
  if (!paths) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

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

    const destName = uniqueFilename(paths.images, entry.name);
    const destPath = path.join(paths.images, destName);

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

  const summary = errors.length === 1 ? errors[0] : `${errors.length} file(s) failed to upload`;
  return json({ ok: false, error: summary }, { status: 400 });
};
