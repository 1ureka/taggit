import fs from "fs";
import path from "path";
import { Readable } from "stream";
import type { RequestHandler } from "@sveltejs/kit";

import * as collection from "$lib/collection/server.js";
import * as image from "$lib/image/server.js";
import { isValidFilename } from "$lib/utils/shared.js";
import { log } from "$lib/utils/server.js";

/**
 * `GET /api/images/[filename]`
 *
 * 依檔名與尺寸參數回傳圖片二進位資料。
 */
export const GET: RequestHandler = async ({ params, url }) => {
  const root = collection.getActiveRoot();
  if (!root) {
    return new Response("尚未載入資料庫", { status: 503 });
  }

  const { filename } = params;
  if (!isValidFilename(filename)) {
    return new Response("無效的檔名", { status: 400 });
  }

  // ---

  const baseDir = collection.getCollectionPaths(root).images;

  const filePath = path.resolve(baseDir, filename);
  if (!filePath.startsWith(path.resolve(baseDir) + path.sep) && filePath !== path.resolve(baseDir)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new Response("找不到圖片", { status: 404 });
  }

  const sizeParam = url.searchParams.get("size") ?? "xl";
  if (!image.isValidSize(sizeParam)) {
    return new Response("無效的尺寸", { status: 400 });
  }

  // ---

  const headers: HeadersInit = {
    "Cache-Control": "private, max-age=60",
    "Content-Type": "application/octet-stream",
  };

  try {
    if (sizeParam === "xl") {
      headers["Content-Type"] = image.mimeTypeOf(filename);
      headers["Content-Length"] = String(fs.statSync(filePath).size);

      const webStream = Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream;
      return new Response(webStream, { headers });
    } else {
      headers["Content-Type"] = "image/webp";

      const animated = url.searchParams.get("animated") === "1";
      const buffer = await image.getImageBuffer(filename, filePath, sizeParam, animated);
      return new Response(new Uint8Array(buffer), { headers });
    }
  } catch (e) {
    log({ level: "error", module: "images/[id]", message: `圖片代理失敗: ${filename}`, data: { error: String(e) } });
    return new Response("處理圖片失敗", { status: 500 });
  }
};
