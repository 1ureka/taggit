import type { RequestHandler } from "@sveltejs/kit";

import { ImageLibrary } from "$lib/image/server";
import { isSafeFilename } from "$lib/utils/shared";
import { log } from "$lib/utils/server";

/**
 * `GET /api/images/[filename]`
 *
 * 依檔名與尺寸參數回傳圖片二進位資料。
 */
export const GET: RequestHandler = async ({ params, url }) => {
  if (!ImageLibrary.isActive()) {
    return new Response("尚未載入資料庫", { status: 503 });
  }

  const { filename } = params;
  if (!isSafeFilename(filename)) {
    return new Response("無效的檔名", { status: 400 });
  }

  const sizeParam = url.searchParams.get("size") ?? "xl";
  if (!ImageLibrary.isValidSize(sizeParam)) {
    return new Response("無效的尺寸", { status: 400 });
  }

  const animated = url.searchParams.get("animated") === "1";

  try {
    const r = await ImageLibrary.payload(filename, sizeParam, animated);
    if (!r.ok) {
      return r.error.kind === "forbidden"
        ? new Response("Forbidden", { status: 403 })
        : new Response("找不到圖片", { status: 404 });
    }

    const headers: HeadersInit = {
      "Cache-Control": "private, max-age=60",
      "Content-Type": r.data.contentType,
    };

    if (r.data.kind === "stream") {
      headers["Content-Length"] = String(r.data.length);
    }

    return new Response(r.data.body, { headers });
  } catch (e) {
    log({ level: "error", module: "images/[id]", message: `圖片代理失敗: ${filename}`, data: { error: String(e) } });
    return new Response("處理圖片失敗", { status: 500 });
  }
};
