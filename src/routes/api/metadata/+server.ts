import path from "path";
import { json, type RequestHandler } from "@sveltejs/kit";
import { requireDatabase } from "$lib/server/helpers.js";
import { getImageMeta } from "$lib/server/thumbnail.js";

/** POST /api/metadata — 為缺少 blurhash/寬高 的圖片補算元資料 */
export const POST: RequestHandler = async () => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const { db, paths } = loaded;
  const images = db.data.images;

  let updated = 0;

  for (const [id, record] of Object.entries(images)) {
    const needsBlurhash = !record.blurhash;
    const needsDimensions = record.width === 0 || record.height === 0;
    if (!needsBlurhash && !needsDimensions) continue;

    const filePath = path.join(paths.committed, id + record.ext);
    const meta = await getImageMeta(filePath);

    let changed = false;
    if (needsBlurhash && meta.blurhash) {
      record.blurhash = meta.blurhash;
      changed = true;
    }
    if (needsDimensions && meta.width > 0 && meta.height > 0) {
      record.width = meta.width;
      record.height = meta.height;
      changed = true;
    }
    if (changed) updated++;
  }

  if (updated > 0) db.markDirty();

  return json({ ok: true, data: { updated } });
};

/** GET /api/metadata — 檢查缺少元資料的圖片數量 */
export const GET: RequestHandler = () => {
  const loaded = requireDatabase();
  if (!loaded) return json({ ok: false, error: "No collection loaded" }, { status: 503 });

  const images = loaded.db.data.images;
  let missing = 0;

  for (const record of Object.values(images)) {
    if (!record.blurhash || record.width === 0 || record.height === 0) {
      missing++;
    }
  }

  return json({ ok: true, data: { missing } });
};
