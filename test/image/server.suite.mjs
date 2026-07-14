/**
 * @file server.suite.mjs
 * ImageLibrary（globalThis 單例 + fs）：ensureActive 生命週期（切換 dir 清快取）、
 * resolve / has 的路徑穿越檢查、list 過濾與自然排序、probe、payload、clear / stats。
 *
 * 每個案例都以 ensureActive(newImagesDir()) 綁到自己的獨立子目錄，避免單例狀態互相污染
 * （比照 repo 領域用 newDbPath() 讓 Database.ensureLoaded 各自隔離）。
 */

import path from "node:path";

export const name = "server (ImageLibrary)";

export async function run(t, h) {
  const { ImageLibrary } = h.modules;

  // ── ensureActive：切換 dir 清快取；同 dir 不清 ──
  {
    const dir = h.newImagesDir();
    await h.putImage(dir, "a.png", { width: 800, height: 600 });
    ImageLibrary.ensureActive(dir);

    // 產一張縮圖填入快取
    await ImageLibrary.payload("a.png", "sm", false);
    t.ok("payload sm 後快取有內容", ImageLibrary.stats().entries >= 1);

    // 同一個 dir 再呼叫：不清快取
    ImageLibrary.ensureActive(dir);
    t.ok("重複綁定同一 dir 不清快取", ImageLibrary.stats().entries >= 1);

    // 換新 dir：快取被清空
    const dir2 = h.newImagesDir();
    ImageLibrary.ensureActive(dir2);
    t.eq("切換到新 dir 後快取被清空", ImageLibrary.stats().entries, 0);
  }

  // ── resolve / has：合法檔名 ok；穿越 / 絕對路徑 forbidden；不存在 notFound ──
  {
    const dir = h.newImagesDir();
    await h.putImage(dir, "real.png");
    ImageLibrary.ensureActive(dir);

    const good = ImageLibrary.resolve("real.png");
    t.ok("合法檔名 resolve ok", good.ok === true);
    t.ok("has 對合法檔名為 true", ImageLibrary.has("real.png"));

    const missing = ImageLibrary.resolve("nope.png");
    t.ok("不存在檔名 resolve 非 ok", missing.ok === false);
    t.eq("不存在檔名為 not_found", missing.error.kind, "not_found");
    t.ok("has 對不存在檔名為 false", ImageLibrary.has("nope.png") === false);

    const traversal = ImageLibrary.resolve("../outside.png");
    t.ok("../ 穿越 resolve 非 ok", traversal.ok === false);
    t.eq("../ 穿越為 forbidden", traversal.error.kind, "forbidden");

    const absolute = ImageLibrary.resolve(path.resolve(dir, "..", "elsewhere.png"));
    t.ok("逃出 base 的絕對路徑為 forbidden", absolute.ok === false && absolute.error.kind === "forbidden");
  }

  // ── list：依自然排序回傳圖片檔名，非圖片被過濾 ──
  {
    const dir = h.newImagesDir();
    await h.putImage(dir, "img10.png");
    await h.putImage(dir, "img2.png");
    await h.putImage(dir, "img1.png");
    h.putText(dir, "notes.txt", "ignored");
    ImageLibrary.ensureActive(dir);

    const list = ImageLibrary.list();
    t.eq("非圖片檔案被過濾掉", list.includes("notes.txt"), false);
    t.eq("自然排序：img2 在 img10 之前", list, ["img1.png", "img2.png", "img10.png"]);
  }

  // ── probe：委派 resolve + readImageInfo；不存在回 notFound（不丟例外）──
  {
    const dir = h.newImagesDir();
    await h.putImage(dir, "p.png", { width: 70, height: 50 });
    ImageLibrary.ensureActive(dir);

    const r = await ImageLibrary.probe("p.png");
    t.ok("probe 合法檔案 ok", r.ok === true);
    t.eq("probe 回傳正確寬度", r.data.width, 70);
    t.eq("probe 回傳正確高度", r.data.height, 50);
    t.ok("probe 回傳 fileSize 為正數", r.data.fileSize > 0);

    const miss = await ImageLibrary.probe("gone.png");
    t.ok("probe 不存在檔案回 not_found（不丟例外）", miss.ok === false && miss.error.kind === "not_found");
  }

  // ── payload：xl 走 stream + 正確 contentType/length；sm/md 走 webp buffer ──
  {
    const dir = h.newImagesDir();
    await h.putImage(dir, "pay.png", { width: 800, height: 600 });
    ImageLibrary.ensureActive(dir);

    const xl = await ImageLibrary.payload("pay.png", "xl", false);
    t.ok("xl payload ok", xl.ok === true);
    t.eq("xl 為 stream", xl.data.kind, "stream");
    t.eq("xl contentType 依副檔名", xl.data.contentType, "image/png");
    t.ok("xl length 為正數", xl.data.length > 0);
    // 消耗 stream 避免懸置的檔案 handle
    if (xl.ok && xl.data.body) await xl.data.body.cancel?.();

    const sm = await ImageLibrary.payload("pay.png", "sm", false);
    t.eq("sm 為 webp buffer", sm.data.kind, "buffer");
    t.eq("sm contentType 為 image/webp", sm.data.contentType, "image/webp");
    t.ok("sm body 為非空 Uint8Array", sm.data.body instanceof Uint8Array && sm.data.body.length > 0);

    const md = await ImageLibrary.payload("pay.png", "md", false);
    t.eq("md 為 webp buffer", md.data.kind, "buffer");

    // 穿越 / 不存在 → 對應錯誤變體
    const forbidden = await ImageLibrary.payload("../x.png", "sm", false);
    t.ok("payload 穿越為 forbidden", forbidden.ok === false && forbidden.error.kind === "forbidden");
    const notfound = await ImageLibrary.payload("nope.png", "xl", false);
    t.ok("payload 不存在為 not_found", notfound.ok === false && notfound.error.kind === "not_found");
  }

  // ── clear / stats：dir 無關，可安全呼叫 ──
  {
    t.notThrows("stats 可安全呼叫", () => ImageLibrary.stats());
    t.notThrows("clear 可安全呼叫", () => ImageLibrary.clear());
    t.eq("clear 後 stats 歸零", ImageLibrary.stats().entries, 0);
  }
}

export default { name, run };
