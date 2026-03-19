/**
 * @file thumbnail.ts
 * 縮圖產生與 BlurHash 編碼。
 *
 * 本模組的職責：
 *   - 依預設尺寸（sm / md）產生 WebP 縮圖，並透過 LRU 快取與
 *     併發任務池（{@link TaskPool}）控制資源使用。
 *   - 計算圖片的 BlurHash 字串，供前端作為載入佔位使用。
 *   - 提供快取統計與清除介面。
 */

import sharp from "sharp";
import { encode } from "blurhash";
import { LRUCache, TaskPool } from "./resources.js";
import type { ImageSize } from "$lib/types.js";

type ProcessableSize = Exclude<ImageSize, "xl">;

const SIZE_PRESETS: Record<ProcessableSize, { maxPixels: number; quality: number }> = {
  sm: { maxPixels: 512 * 512, quality: 80 },
  md: { maxPixels: 1024 * 1024, quality: 90 },
};

const MAX_CACHE_BYTES = 512 * 1024 * 1024;
const MAX_CONCURRENT = 4;

// ## BlurHash 編碼參數
//
// BlurHash 將圖片轉為離散餘弦轉換 (DCT) 的低頻分量，壓縮成一段 ~20-30 字元的
// 短字串。解碼時可還原為極小的模糊圖片，用作載入佔位。
//
// 編碼流程：
//   1. sharp 將原圖 resize 到 BLURHASH_W px 寬（等比例），輸出 raw RGBA buffer
//   2. blurhash.encode() 對 pixel data 做 DCT，取前 componentX × componentY 個分量
//   3. 分量被量化為 Base83 字串（即最終的 blurhash）
//
// ## 可調參數
//
// BLURHASH_W（編碼用輸入寬度，目前 32px）
//   - 只是餵給 encode() 之前的縮圖尺寸，不影響最終 hash 品質（因為 DCT 分量數
//     才是決定精細度的因素）。降到 16 可加速但拿不到更多細節；升到 64 浪費算力。
//   - 建議範圍：16 ~ 64，32 是常見最佳平衡點。
//
// BLURHASH_COMPONENT_X / BLURHASH_COMPONENT_Y（DCT 分量數，目前 4×3）
//   - 範圍：1 ~ 9（BlurHash 規格限制）
//   - 分量越多 → 模糊圖越精細，但 hash 字串越長：
//       1×1 =  6 chars（單一平均色）
//       4×3 = 28 chars（官方推薦，色塊＋漸層可辨識）
//       4×4 = 33 chars
//       6×6 = 66 chars（細節更多但 ROI 遞減）
//       9×9 = 160 chars（極端，肉眼差異不大）
//   - 字串長度公式：4 + 2 × componentX × componentY
//   - 適用場景：
//       2×2：只需色調提示，追求最短字串（聊天室頭像等）
//       4×3：通用推薦，佔位圖能看出大致構圖
//       5×4 ~ 6×5：大尺寸 hero image，值得多幾個 byte 換更好的預覽
//   - 超過 6×6 幾乎沒有視覺收益，不建議使用。

const BLURHASH_W = 32;
const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;

// ---

const cache = new LRUCache(MAX_CACHE_BYTES);
const pool = new TaskPool(MAX_CONCURRENT);
const inflight = new Map<string, Promise<Buffer>>();

// ---

/** 計算兩個正整數的最大公因數（輾轉相除法）。 */
function gcd(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * 在不超過 `maxPixels` 的前提下，以整數倍比例縮小尺寸。
 * 若原始尺寸已在範圍內，直接回傳原始寬高。
 */
function thumbnailSize(w: number, h: number, maxPixels: number): { width: number; height: number } {
  if (w * h <= maxPixels) return { width: w, height: h };

  const g = gcd(w, h);
  const bw = w / g;
  const bh = h / g;
  const baseArea = bw * bh;

  let k = Math.floor(Math.sqrt(maxPixels / baseArea));
  while ((k + 1) * (k + 1) * baseArea <= maxPixels) k++;
  k = Math.max(1, k);

  const tw = bw * k;
  const th = bh * k;

  // 當 gcd(w,h) ≈ 1 時，baseArea ≈ w*h > maxPixels → k 被迫為 1 → tw*th = 原始尺寸。
  // 此時改用連續比例縮放作為 fallback，確保結果不超過 maxPixels 太多。
  if (tw * th > maxPixels * 1.5) {
    const ratio = Math.sqrt(maxPixels / (w * h));
    return {
      width: Math.max(1, Math.floor(w * ratio)),
      height: Math.max(1, Math.floor(h * ratio)),
    };
  }

  return { width: tw, height: th };
}

// ---

/**
 * 將來源圖片依指定尺寸預設值縮放並轉為 WebP，透過任務池限制併發。
 */
async function processImage(sourcePath: string, size: ProcessableSize): Promise<Buffer> {
  const preset = SIZE_PRESETS[size];

  return pool.enqueue(async () => {
    const meta = await sharp(sourcePath).metadata();
    const origW = meta.width ?? 0;
    const origH = meta.height ?? 0;

    if (origW === 0 || origH === 0) {
      return sharp(sourcePath).webp({ quality: preset.quality }).toBuffer();
    }

    const { width, height } = thumbnailSize(origW, origH, preset.maxPixels);

    if (width === origW && height === origH) {
      return sharp(sourcePath).webp({ quality: preset.quality }).toBuffer();
    }

    return sharp(sourcePath).resize(width, height, { fit: "fill" }).webp({ quality: preset.quality }).toBuffer();
  });
}

// ---

/**
 * 取得指定圖片的縮圖 Buffer（含 LRU 快取與 in-flight 去重）。
 * 若快取命中直接回傳；否則排程產生縮圖後寫入快取。
 */
export async function getImageBuffer(file: string, sourcePath: string, size: ProcessableSize): Promise<Buffer> {
  const cacheKey = `${size}:${file}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  if (inflight.has(cacheKey)) return inflight.get(cacheKey)!;

  const promise = processImage(sourcePath, size)
    .then((buffer) => {
      cache.set(cacheKey, buffer);
      return buffer;
    })
    .finally(() => inflight.delete(cacheKey));

  inflight.set(cacheKey, promise);
  return promise;
}

/**
 * 讀取圖片的寬高與 BlurHash 字串。
 * 發生錯誤時回傳寬高為 0、blurhash 為空字串。
 */
export async function generateMetadata(filePath: string): Promise<{ width: number; height: number; blurhash: string }> {
  try {
    const image = sharp(filePath);
    const meta = await image.metadata();
    const width = meta.width ?? 0;
    const height = meta.height ?? 0;

    if (width === 0 || height === 0) {
      return { width: 0, height: 0, blurhash: "" };
    }

    const blurhashH = Math.max(1, Math.round((BLURHASH_W * height) / width));
    const { data, info } = await image
      .resize(BLURHASH_W, blurhashH, { fit: "fill" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const blurhash = encode(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      BLURHASH_COMPONENT_X,
      BLURHASH_COMPONENT_Y,
    );

    return { width, height, blurhash };
  } catch {
    return { width: 0, height: 0, blurhash: "" };
  }
}

// ---

/**
 * 清空縮圖快取，回傳被清除的項目數量。
 */
export function clearCache(): number {
  const count = cache.stats.entries;
  cache.clear();
  return count;
}

/**
 * 取得縮圖快取的統計資訊（項目數量與已使用位元組數）。
 */
export function getCacheStats(): { entries: number; bytes: number } {
  return cache.stats;
}
