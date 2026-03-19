import fs from "fs";
import path from "path";
import type { RequestHandler } from "@sveltejs/kit";

import { MIME_TYPES } from "$lib/server/config.js";
import { requirePaths } from "$lib/server/db-instance.js";
import { getImageBuffer } from "$lib/server/thumbnail.js";
import { isValidFilename, isValidSize } from "$lib/server/validation.js";

/**
 * `GET /api/images/[filename]`
 *
 * 依檔名與尺寸參數回傳圖片二進位資料。
 */
export const GET: RequestHandler = async ({ params, url }) => {
  const paths = requirePaths();
  if (!paths) {
    return new Response("No collection loaded", { status: 503 });
  }

  const { filename } = params;

  if (!isValidFilename(filename)) {
    return new Response("Invalid filename", { status: 400 });
  }

  const baseDir = paths.images;

  const filePath = path.resolve(baseDir, filename);
  if (!filePath.startsWith(path.resolve(baseDir) + path.sep) && filePath !== path.resolve(baseDir)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }

  const sizeParam = url.searchParams.get("size") ?? "xl";
  if (!isValidSize(sizeParam)) {
    return new Response("Invalid size", { status: 400 });
  }

  let headers: HeadersInit = {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Content-Type": "application/octet-stream",
  };

  if (sizeParam === "xl") {
    const ext = path.extname(filename).toLowerCase();
    headers["Content-Type"] = MIME_TYPES[ext] ?? "application/octet-stream";
  } else {
    headers["Content-Type"] = "image/webp";
  }

  try {
    if (sizeParam === "xl") {
      const raw = fs.readFileSync(filePath);
      return new Response(raw, { headers });
    } else {
      const buffer = await getImageBuffer(filename, filePath, sizeParam);
      return new Response(new Uint8Array(buffer), { headers });
    }
  } catch {
    return new Response("Failed to process image", { status: 500 });
  }
};
