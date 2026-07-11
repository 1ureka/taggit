/**
 * @file metadata.ts
 * 圖片檔案側元資料 —— 尺寸、BlurHash 與檔案大小的讀取。
 */

import fs from "fs";
import sharp from "sharp";
import { encode } from "blurhash";
import { log } from "$lib/utils/server.js";
import { formatError } from "$lib/utils/shared.js";

/**
 * 提交圖片時由檔案本身衍生的全部元資料。
 * 作為 image 模組對外的資料契約；database 模組以結構相容的型別接收，
 * 兩模組之間不存在 import 依賴。
 */
export interface FileInfo {
  /** 原始檔案大小（位元組） */
  fileSize: number;
  /** 圖片寬度（像素）；0 表示無法取得 */
  width: number;
  /** 圖片高度（像素）；0 表示無法取得 */
  height: number;
  /** BlurHash 編碼字串；空字串表示無法計算 */
  blurhash: string;
}

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
//   - 4×3 = 28 chars 為官方推薦，色塊＋漸層可辨識；超過 6×6 幾乎沒有視覺收益。

const BLURHASH_W = 32;
const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;

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
  } catch (e) {
    log({ level: "error", module: "image", message: `生成圖片元資料失敗 (${filePath}): ${formatError(e)}` });
    return { width: 0, height: 0, blurhash: "" };
  }
}

/**
 * 讀取提交圖片所需的完整檔案側元資料（檔案大小 + 尺寸 + BlurHash）。
 * 檔案不存在時擲出例外（`fs.statSync`）。
 */
export async function readImageInfo(filePath: string): Promise<FileInfo> {
  const stat = fs.statSync(filePath);
  const meta = await generateMetadata(filePath);
  return { fileSize: stat.size, ...meta };
}
