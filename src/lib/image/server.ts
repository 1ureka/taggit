/**
 * @file image/server.ts
 * image 模組的 server 端入口。
 *
 * 在給定的 collection 目錄下，找到圖檔、壓縮、產生檔案側元資料。
 *
 * 模組外部只能 import 本檔與 {@link ./client.ts}。
 */

import fs from "fs";
import path from "path";
import sharp from "sharp";
import { Readable } from "stream";
import { sortCollator } from "$lib/utils/shared";

import * as formats from "./formats";
import { readImageInfo } from "./metadata";
import { ImageProcessor } from "./processor";
import { ok, notFound, forbidden } from "./result";

import type { Result, ImagePayload } from "./result";
import type { ImageSize } from "./formats";
import type { FileInfo } from "./metadata";

export type { ImageSize } from "./formats";
export type { FileInfo } from "./metadata";
export type { Result, NotFound, Forbidden, ImagePayload } from "./result";

// libvips 的原生 operation cache 會保留來源檔案的底層 handle 以供重用；
// Windows 上這會讓剛產生過縮圖的檔案在刪除時被鎖住 (EBUSY/EPERM)。
// 本模組已有自己的 LRUCache 負責縮圖重用，關閉這層原生快取影響可忽略。
sharp.cache(false);

const MAX_CACHE_BYTES = 512 * 1024 * 1024;
const MAX_CONCURRENT = 4;

declare global {
  /** HMR 保護：熱重載之間重用實例。 */
  // eslint-disable-next-line no-var
  var __imageLibrary: ImageLibrary | undefined;
}

export class ImageLibrary {
  /** 取模組層級單例，首次存取時建立；為了 Vite HMR。 */
  private static singleton(): ImageLibrary {
    if (!globalThis.__imageLibrary) globalThis.__imageLibrary = new ImageLibrary();
    return globalThis.__imageLibrary;
  }

  /** 確保單例已綁定至 `/images` 目錄，當目錄改變時清空快取，否則 no-op。 */
  static ensureActive(imagesDir: string): void {
    const self = ImageLibrary.singleton();
    if (self.dir !== imagesDir) {
      self.dir = imagesDir;
      self.processor.clear();
    }
  }

  /** 單例是否已綁定 `/images` 目錄 */
  static isActive(): boolean {
    return ImageLibrary.singleton().dir !== null;
  }

  /** 取用已綁定的 `/images` 目錄 */
  private static requireDir(): string {
    const self = ImageLibrary.singleton();
    if (self.dir === null) throw new Error("ImageLibrary 尚未啟用，可能缺失 ImageLibrary.isActive() 判斷");
    return self.dir;
  }

  // ---

  /** 當前綁定的 images 目錄；null = 尚未 ensureActive */
  private dir: string | null = null;
  /** 縮圖快取 + 池 */
  private processor = new ImageProcessor(MAX_CACHE_BYTES, MAX_CONCURRENT);

  // ---

  /** 列出目錄中所有支援的圖片檔名，依自然排序，目錄不可讀時回傳空陣列 */
  static list(): string[] {
    const dir = ImageLibrary.requireDir();
    try {
      return fs
        .readdirSync(dir)
        .filter((f) => formats.IMG_EXTS.has(path.extname(f).toLowerCase()))
        .sort((a, b) => sortCollator.compare(a, b));
    } catch {
      return [];
    }
  }

  /** 檔案是否存在於 `/images` 目錄內 (含穿越檢查) */
  static has(file: string): boolean {
    return ImageLibrary.resolve(file).ok;
  }

  /** 將檔名解析為 images 目錄下的絕對路徑，拼接 + 路徑穿越檢查 + 存在性檢查 */
  static resolve(file: string): Result<string> {
    const base = ImageLibrary.requireDir();
    const full = path.resolve(base, file);
    const baseResolved = path.resolve(base);
    if (full !== baseResolved && !full.startsWith(baseResolved + path.sep)) return forbidden();
    if (!fs.existsSync(full)) return notFound();
    return ok(full);
  }

  /** 讀取圖片的檔案物理屬性 */
  static async probe(file: string): Promise<Result<FileInfo>> {
    const r = ImageLibrary.resolve(file);
    if (!r.ok) return r;
    return ok(await readImageInfo(r.data));
  }

  /** 取得圖片的回傳內容：`xl` 走原圖串流，`sm`/`md` 走 webp 縮圖 buffer */
  static async payload(file: string, size: ImageSize, animated: boolean): Promise<Result<ImagePayload>> {
    const self = ImageLibrary.singleton();
    const r = ImageLibrary.resolve(file);
    if (!r.ok) return r;

    if (size === "xl") {
      return ok({
        kind: "stream",
        body: Readable.toWeb(fs.createReadStream(r.data)) as ReadableStream,
        contentType: formats.mimeTypeOf(file),
        length: fs.statSync(r.data).size,
      });
    }

    const buffer = await self.processor.get(file, r.data, size, animated);
    return ok({ kind: "buffer", body: new Uint8Array(buffer), contentType: "image/webp" });
  }

  // ---

  /** 依副檔名判斷是否為支援的圖片檔案。 */
  static isImageFile(filename: string): boolean {
    return formats.isImageFile(filename);
  }

  /** 檢查 size 查詢參數是否為 sm / md / xl 其中之一。 */
  static isValidSize(value: unknown): value is ImageSize {
    return formats.isValidSize(value);
  }

  /** 清空縮圖快取，回傳被清除的項目數量。 */
  static clear(): number {
    return ImageLibrary.singleton().processor.clear();
  }

  /** 取得縮圖快取的統計資訊（項目數量與已使用位元組數）。 */
  static stats(): { entries: number; bytes: number } {
    return ImageLibrary.singleton().processor.stats();
  }
}
