/**
 * @file processor.suite.mjs
 * ImageProcessor.get()：輸出可被 sharp 再解碼、縮圖尺寸不超過對應 maxPixels
 * （間接驗證私有 thumbnailSize，不為測試而 export）、animated 多幀、快取命中、
 * in-flight 去重、clear / stats。
 */

import path from "node:path";

export const name = "processor (ImageProcessor.get)";

const MAX_PIXELS = { sm: 512 * 512, md: 1024 * 1024 };

export async function run(t, h) {
  const { ImageProcessor } = h.modules;
  const sharp = h.sharp;
  const dir = h.newImagesDir();

  // ── get()：輸出為可再解碼的 webp，且尺寸不超過對應 size 的 maxPixels ──
  // 對幾種寬高組合各跑一次：整除、互質、原始已小於 maxPixels、極端長寬比觸發 fallback。
  {
    const cases = [
      { name: "even", width: 2000, height: 1000, size: "sm", desc: "整除比例" },
      { name: "coprime", width: 1999, height: 997, size: "sm", desc: "互質觸發 fallback" },
      { name: "small", width: 100, height: 100, size: "md", desc: "原始已小於 maxPixels 免縮放" },
      { name: "wide", width: 4000, height: 50, size: "sm", desc: "極端長寬比" },
    ];

    for (const c of cases) {
      const proc = new ImageProcessor(64 * 1024 * 1024, 4);
      await h.putImage(dir, `${c.name}.png`, { width: c.width, height: c.height });
      const out = await proc.get(`${c.name}.png`, path.join(dir, `${c.name}.png`), c.size);

      const meta = await sharp(out).metadata();
      t.eq(`${c.desc}：輸出為 webp`, meta.format, "webp");
      t.ok(
        `${c.desc}：輸出像素不超過 ${c.size} 的 maxPixels`,
        meta.width * meta.height <= MAX_PIXELS[c.size],
      );

      if (c.width * c.height <= MAX_PIXELS[c.size]) {
        t.eq(`${c.desc}：原尺寸已在範圍內則不縮放（寬）`, meta.width, c.width);
        t.eq(`${c.desc}：原尺寸已在範圍內則不縮放（高）`, meta.height, c.height);
      }
    }
  }

  // ── 快取命中：同參數第二次呼叫直接回快取，entries 不增加 ──
  {
    const proc = new ImageProcessor(64 * 1024 * 1024, 4);
    await h.putImage(dir, "cache.png", { width: 800, height: 600 });
    const src = path.join(dir, "cache.png");

    const first = await proc.get("cache.png", src, "sm");
    t.eq("首次 get 後快取有 1 筆", proc.stats().entries, 1);

    const second = await proc.get("cache.png", src, "sm");
    t.eq("同參數第二次 get 快取仍為 1 筆（命中未新增）", proc.stats().entries, 1);
    t.ok("兩次回傳為同一個 buffer（快取命中）", first === second);

    // 不同 size 使用不同快取鍵
    await proc.get("cache.png", src, "md");
    t.eq("不同 size 使用獨立快取鍵", proc.stats().entries, 2);
  }

  // ── in-flight 去重：同時對同一檔案發兩次 get()，兩者 resolve 為同一 buffer ──
  {
    const proc = new ImageProcessor(64 * 1024 * 1024, 4);
    await h.putImage(dir, "inflight.png", { width: 800, height: 600 });
    const src = path.join(dir, "inflight.png");

    const [a, b] = await Promise.all([proc.get("inflight.png", src, "sm"), proc.get("inflight.png", src, "sm")]);
    t.ok("同時發出的兩個 get 得到同一 buffer", a === b);
    t.eq("in-flight 去重後只留一筆快取", proc.stats().entries, 1);
  }

  // ── animated：多幀 GIF 以 animated:true 輸出為多幀 webp ──
  {
    const proc = new ImageProcessor(64 * 1024 * 1024, 4);
    await h.putAnimated(dir, "anim.gif");
    const src = path.join(dir, "anim.gif");

    const animatedOut = await proc.get("anim.gif", src, "sm", true);
    const animMeta = await sharp(animatedOut, { animated: true }).metadata();
    t.ok("animated:true 輸出保留多幀（pages > 1）", animMeta.pages > 1);

    const staticOut = await proc.get("anim.gif", src, "sm", false);
    const staticMeta = await sharp(staticOut, { animated: true }).metadata();
    // 靜態 webp 的 pages 可能為 undefined（無多幀概念），視為單幀。
    t.eq("animated:false 只取首幀（單幀）", staticMeta.pages ?? 1, 1);

    t.eq("animated 與 static 使用獨立快取鍵", proc.stats().entries, 2);
  }

  // ── clear / stats ──
  {
    const proc = new ImageProcessor(64 * 1024 * 1024, 4);
    await h.putImage(dir, "clr.png", { width: 400, height: 400 });
    await proc.get("clr.png", path.join(dir, "clr.png"), "sm");
    t.eq("clear 前有 1 筆", proc.stats().entries, 1);
    t.eq("clear 回傳被清除的項目數", proc.clear(), 1);
    t.eq("clear 後 stats 歸零", proc.stats().entries, 0);
  }
}

export default { name, run };
