import sharp from "sharp";
import { encode } from "blurhash";
import { LRUCache, TaskPool } from "./resources.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_PIXELS = 250_000;
const MAX_CACHE_BYTES = 512 * 1024 * 1024; // 512 MB
const MAX_CONCURRENT = 4;
const BLURHASH_W = 32;
const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;

// ─── Instances ────────────────────────────────────────────────────────────────

const cache = new LRUCache(MAX_CACHE_BYTES);
const pool = new TaskPool(MAX_CONCURRENT);
const inflight = new Map<string, Promise<Buffer>>();

// ─── Thumbnail Size ───────────────────────────────────────────────────────────

function gcd(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

export function thumbnailSize(w: number, h: number): { width: number; height: number } {
  if (w * h <= MAX_PIXELS) return { width: w, height: h };

  const g = gcd(w, h);
  const bw = w / g;
  const bh = h / g;
  const baseArea = bw * bh;

  let k = Math.floor(Math.sqrt(MAX_PIXELS / baseArea));
  while ((k + 1) * (k + 1) * baseArea <= MAX_PIXELS) k++;
  k = Math.max(1, k);

  const tw = bw * k;
  const th = bh * k;

  if (tw * th > MAX_PIXELS * 1.5) {
    const ratio = Math.sqrt(MAX_PIXELS / (w * h));
    return {
      width: Math.max(1, Math.floor(w * ratio)),
      height: Math.max(1, Math.floor(h * ratio)),
    };
  }

  return { width: tw, height: th };
}

// ─── Image Processing ─────────────────────────────────────────────────────────

async function processImage(sourcePath: string, thumb: boolean): Promise<Buffer> {
  return pool.enqueue(async () => {
    if (!thumb) {
      return sharp(sourcePath).webp({ quality: 90 }).toBuffer();
    }

    const meta = await sharp(sourcePath).metadata();
    const origW = meta.width ?? 0;
    const origH = meta.height ?? 0;

    if (origW === 0 || origH === 0) {
      return sharp(sourcePath).webp({ quality: 80 }).toBuffer();
    }

    const { width, height } = thumbnailSize(origW, origH);

    if (width === origW && height === origH) {
      return sharp(sourcePath).webp({ quality: 80 }).toBuffer();
    }

    return sharp(sourcePath).resize(width, height, { fit: "fill" }).webp({ quality: 80 }).toBuffer();
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getImage(area: string, file: string, sourcePath: string, thumb: boolean): Promise<Buffer> {
  const cacheKey = thumb ? `thumb:${area}/${file}` : `full:${area}/${file}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  if (inflight.has(cacheKey)) return inflight.get(cacheKey)!;

  const promise = processImage(sourcePath, thumb)
    .then((buffer) => {
      cache.set(cacheKey, buffer);
      return buffer;
    })
    .finally(() => inflight.delete(cacheKey));

  inflight.set(cacheKey, promise);
  return promise;
}

export async function getImageMeta(filePath: string): Promise<{
  width: number;
  height: number;
  blurhash: string;
}> {
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
