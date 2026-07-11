/**
 * @file image/fixtures.mjs
 * image 領域的 fixtures：載入 image 模組，並提供合成圖工具與隔離目錄。
 * 建立在 core/loader.mjs 之上（拿它的 load 與 tmpRoot），交給本領域的 suite 當第二個參數 h。
 *
 * 不簽入任何圖片二進位檔——測試用圖全部由 sharp 在執行當下合成。
 * ImageLibrary / ImageProcessor 的快取是跨呼叫共用的 globalThis 單例，每個需要 fs 的
 * 測試案例都應呼叫 ensureActive(newImagesDir()) 綁到自己獨立的子目錄，避免快取互相污染
 * （比照 repo 領域用 newDbPath() 讓 Database.ensureLoaded 各自隔離的模式）。
 */

import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";

/**
 * @param {{ load: (p: string) => Promise<any>, tmpRoot: string }} loader core/loader.mjs 的產物
 * @returns fixtures 物件 h：{ modules, sharp, newImagesDir, putImage, putAnimated, putText }
 */
export async function createImageFixtures(loader) {
  const { load, tmpRoot } = loader;

  const [server, formats, resources, result, blurhash, metadata, processor, client] = await Promise.all([
    load("/src/lib/image/server.ts"),
    load("/src/lib/image/formats.ts"),
    load("/src/lib/image/resources.ts"),
    load("/src/lib/image/result.ts"),
    load("/src/lib/image/blurhash.ts"),
    load("/src/lib/image/metadata.ts"),
    load("/src/lib/image/processor.ts"),
    load("/src/lib/image/client.ts"),
  ]);

  const modules = {
    ...server, // ImageLibrary
    ...formats, // IMG_EXTS, MIME_TYPES, isValidSize, isImageFile, mimeTypeOf
    ...resources, // LRUCache, TaskPool
    ...result, // ok, notFound, forbidden
    ...blurhash, // blurhashStyle
    ...metadata, // generateMetadata, readImageInfo
    ...processor, // ImageProcessor
    imgSrc: client.imgSrc,
  };

  let counter = 0;

  /** 產生一個唯一的獨立圖片目錄（不同目錄 → ensureActive 會清快取，達成隔離）。 */
  const newImagesDir = () => {
    const dir = path.join(tmpRoot, `image-dir-${counter++}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };

  /** 合成一張純色 PNG，寫入 dir，回傳檔名。尺寸刻意壓小以控制 sharp 轉檔耗時。 */
  const putImage = async (dir, name, { width = 100, height = 100, background = { r: 200, g: 100, b: 50 } } = {}) => {
    const buf = await sharp({ create: { width, height, channels: 3, background } })
      .png()
      .toBuffer();
    fs.writeFileSync(path.join(dir, name), buf);
    return name;
  };

  /** 合成一個多幀 GIF（測 animated 分支），frames 為各幀背景色陣列。 */
  const putAnimated = async (
    dir,
    name,
    frames = [
      { r: 255, g: 0, b: 0 },
      { r: 0, g: 255, b: 0 },
      { r: 0, g: 0, b: 255 },
    ],
  ) => {
    const pages = await Promise.all(
      frames.map((background) =>
        sharp({ create: { width: 50, height: 50, channels: 3, background } })
          .png()
          .toBuffer(),
      ),
    );
    const buf = await sharp(pages, { join: { animated: true, across: 1 } }).gif().toBuffer();
    fs.writeFileSync(path.join(dir, name), buf);
    return name;
  };

  /** 寫一個非圖片內容的檔案（純文字），用於「無法解碼」的錯誤處理測試。 */
  const putText = (dir, name, content = "not an image") => {
    fs.writeFileSync(path.join(dir, name), content, "utf8");
    return name;
  };

  return { modules, sharp, newImagesDir, putImage, putAnimated, putText };
}
