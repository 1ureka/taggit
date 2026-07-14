/**
 * @file metadata.suite.mjs
 * generateMetadata / readImageInfo。需要真實可解碼的圖檔（sharp）。
 * 特別鎖住兩種不同的錯誤處理語意：
 *   - generateMetadata 對無法解碼者「吞錯誤」→ 回傳零值，不丟例外。
 *   - readImageInfo 對檔案不存在「不吞錯誤」→ fs.statSync 丟例外。
 */

import path from "node:path";

export const name = "metadata (generateMetadata / readImageInfo)";

export async function run(t, h) {
  const { generateMetadata, readImageInfo } = h.modules;
  const dir = h.newImagesDir();

  // ── generateMetadata：正常合成圖 ──
  {
    await h.putImage(dir, "ok.png", { width: 120, height: 80 });
    const meta = await generateMetadata(path.join(dir, "ok.png"));
    t.eq("width 符合合成尺寸", meta.width, 120);
    t.eq("height 符合合成尺寸", meta.height, 80);
    t.ok("blurhash 為非空字串", typeof meta.blurhash === "string" && meta.blurhash.length > 0);
  }

  // ── generateMetadata：非圖片內容 → 吞錯誤回零值，不丟例外 ──
  {
    h.putText(dir, "notimage.txt", "definitely not an image");
    let result;
    let threw = false;
    try {
      result = await generateMetadata(path.join(dir, "notimage.txt"));
    } catch {
      threw = true;
    }
    t.ok("非圖片內容不丟例外（吞錯誤語意）", threw === false);
    t.eq("非圖片內容回傳零值", result, { width: 0, height: 0, blurhash: "" });
  }

  // ── generateMetadata：檔案不存在 → sharp 讀取失敗，一樣吞成零值 ──
  {
    const result = await generateMetadata(path.join(dir, "does-not-exist.png"));
    t.eq("不存在的圖檔也吞成零值", result, { width: 0, height: 0, blurhash: "" });
  }

  // ── readImageInfo：正常檔案 fileSize / width / height / blurhash 都正確 ──
  {
    await h.putImage(dir, "info.png", { width: 60, height: 40 });
    const info = await readImageInfo(path.join(dir, "info.png"));
    t.ok("fileSize 為正數", info.fileSize > 0);
    t.eq("width 正確", info.width, 60);
    t.eq("height 正確", info.height, 40);
    t.ok("blurhash 為非空字串", typeof info.blurhash === "string" && info.blurhash.length > 0);
  }

  // ── readImageInfo：檔案不存在 → fs.statSync 丟例外（刻意不吞錯誤）──
  {
    // readImageInfo 為 async，t.throws 只認同步拋出；改用 rejects 斷言。
    let rejected = false;
    try {
      await readImageInfo(path.join(dir, "missing.png"));
    } catch {
      rejected = true;
    }
    t.ok("檔案不存在時 readImageInfo 丟例外（不吞錯誤語意）", rejected);
  }
}

export default { name, run };
