/**
 * @file api/fixtures.mjs
 * api 領域的 fixtures：直接載入 `+server.ts` 並驅動裡頭的 GET / POST / …。
 *
 * 端點 handler 只用到 RequestEvent 的 url / params / request 三個欄位，所以測試自己捏一個
 * 就夠了，不需要 SvelteKit runtime，也不需要真的起 HTTP server。失敗一律是 `error()` 擲出的
 * HttpError（帶 status 與 body.message），由 call() 統一轉成 { status, body }，因此
 * 「成功回什麼」與「失敗回什麼」在測試裡是同一個形狀。
 *
 * 這也是為什麼端點不需要「導出一個函數再由 handler 呼叫」的間接層：handler 本身就是可測單位。
 */

import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";

/** 端點檔案 → fixtures 上的名稱 */
const ENDPOINTS = {
  collection: "/src/routes/api/collection/+server.ts",
  backup: "/src/routes/api/collection/backup/+server.ts",
  cache: "/src/routes/api/cache/+server.ts",
  files: "/src/routes/api/files/+server.ts",
  file: "/src/routes/api/files/[name]/+server.ts",
  records: "/src/routes/api/records/+server.ts",
  record: "/src/routes/api/records/[id]/+server.ts",
  tags: "/src/routes/api/tags/+server.ts",
  tagCounts: "/src/routes/api/tags/counts/+server.ts",
  tag: "/src/routes/api/tags/[name]/+server.ts",
  orphans: "/src/routes/api/maintenance/orphans/+server.ts",
  metadata: "/src/routes/api/maintenance/metadata/+server.ts",
};

/**
 * @param {{ load: (p: string) => Promise<any>, tmpRoot: string }} loader core/loader.mjs 的產物
 */
export async function createApiFixtures(loader) {
  const { load, tmpRoot } = loader;

  const names = Object.keys(ENDPOINTS);
  const loaded = await Promise.all(names.map((n) => load(ENDPOINTS[n])));
  /** 各支端點模組，例如 api.records.PATCH */
  const api = Object.fromEntries(names.map((n, i) => [n, loaded[i]]));

  const [database, query, mutation, collection, imageServer] = await Promise.all([
    load("/src/lib/database/index.ts"),
    load("/src/lib/query/index.ts"),
    load("/src/lib/mutation/index.ts"),
    load("/src/lib/collection/index.ts"),
    load("/src/lib/image/server.ts"),
  ]);

  const modules = {
    Database: database.Database,
    Query: query.Query,
    Mutation: mutation.Mutation,
    Collection: collection.Collection,
    ImageLibrary: imageServer.ImageLibrary,
  };

  let counter = 0;
  /** 目前這個測試案例綁定的圖片集根目錄 */
  let root = null;

  /**
   * 建立一個全新的圖片集（root/images + 全新 db.json）並綁定三個單例。
   * 每個案例各自呼叫一次，彼此不共用狀態（比照 repo / image 領域的隔離手法）。
   */
  const freshCollection = () => {
    root = path.join(tmpRoot, `api-collection-${counter++}`);
    fs.mkdirSync(path.join(root, "images"), { recursive: true });

    const paths = modules.Collection.paths(root);
    modules.Collection.setActiveRoot(root);
    modules.Database.ensureLoaded(paths.db);
    modules.ImageLibrary.ensureActive(paths.images);

    return root;
  };

  /**
   * 讓三個單例回到「伺服器剛啟動、什麼都還沒載入」的狀態，用來測 503 守衛。
   * 清掉的正是各模組自己宣告的 HMR 保護全域變數 —— 沒有其他公開途徑能讓單例回到未載入。
   */
  const detachCollection = () => {
    root = null;
    globalThis.__db = undefined;
    globalThis.__imageLibrary = undefined;
    globalThis.__activeCollectionRoot = undefined;
  };

  /** 合成一張小的純色 PNG 落到目前圖片集的 images/ 下，回傳檔名 */
  const putImage = async (name, { width = 32, height = 32 } = {}) => {
    const buf = await sharp({ create: { width, height, channels: 3, background: { r: 10, g: 120, b: 200 } } })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(root, "images", name), buf);
    return name;
  };

  /** 寫一個非圖片內容的檔案，用來測「無法解碼」的分支 */
  const putText = (name, content = "not an image") => {
    fs.writeFileSync(path.join(root, "images", name), content, "utf8");
    return name;
  };

  /** 刪掉 images/ 下的檔案（製造孤兒紀錄用） */
  const removeFile = (name) => fs.rmSync(path.join(root, "images", name), { force: true });

  /** 繞過 mutation 直接寫一筆紀錄真相 + 同步投影，欄位有預設值 */
  const seedRecord = (id, rec = {}) => {
    const db = modules.Database.requireLoaded();
    const old = db.getImage(id);
    const full = {
      name: id,
      tags: ["預設"],
      rating: 0,
      committedAt: 0,
      updatedAt: 0,
      fileSize: 0,
      width: 1,
      height: 1,
      blurhash: "x",
      ...rec,
    };
    db.setImage(id, full);
    db.replaceIndex(id, old);
    return full;
  };

  /** 直接寫標籤元資料 */
  const seedTagMeta = (name, meta) => {
    modules.Database.requireLoaded().setTagMeta(name, meta);
  };

  /**
   * 驅動一支 handler，回傳 `{ status, body }`。
   *
   * - `url`：只給 query string（例如 `"?limit=2"`）或完整路徑，會補成絕對 URL
   * - `params`：路由參數，例如 `{ id: "a.png" }`
   * - `body`：JSON 請求內容；`form` 則是已組好的 FormData
   * - 二進位／串流回應不 parse，`body` 給 `null`，另外附 `res` 讓呼叫端自己看
   */
  const call = async (handler, { url = "", params = {}, body, form } = {}) => {
    const full = new URL(url.startsWith("http") ? url : `http://test/api${url}`);

    let request;
    if (form !== undefined) {
      request = new Request(full, { method: "POST", body: form });
    } else if (body !== undefined) {
      request = new Request(full, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      });
    } else {
      request = new Request(full);
    }

    try {
      const res = await handler({ url: full, params, request });
      const type = res.headers.get("content-type") ?? "";
      const parsed = type.includes("application/json") ? await res.json() : null;
      return { status: res.status, body: parsed, res };
    } catch (e) {
      // error() 擲出的 HttpError：把它攤平成與成功路徑相同的形狀
      if (e && typeof e === "object" && "status" in e && "body" in e) {
        return { status: e.status, body: e.body, res: null };
      }
      throw e;
    }
  };

  /** 收完一支 SSE 回應的所有事件 */
  const collectStream = async (res) => {
    const text = await new Response(res.body).text();
    return text
      .split("\n\n")
      .map((chunk) => chunk.match(/^data: (.+)$/m))
      .filter(Boolean)
      .map((m) => JSON.parse(m[1]));
  };

  return {
    api,
    modules,
    call,
    collectStream,
    freshCollection,
    detachCollection,
    putImage,
    putText,
    removeFile,
    seedRecord,
    seedTagMeta,
    imagesDir: () => path.join(root, "images"),
  };
}
