import sharp from "sharp";
import { encode } from "blurhash";
import { LRUCache, TaskPool } from "./resources.js";
import type { ImageSize } from "$lib/types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const SIZE_PRESETS = {
  sm: { maxPixels: 512 * 512, quality: 80, lossless: false },
  md: { maxPixels: 1024 * 1024, quality: 90, lossless: false },
  xl: { maxPixels: Infinity, quality: 100, lossless: true },
} as const;

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

  if (tw * th > maxPixels * 1.5) {
    const ratio = Math.sqrt(maxPixels / (w * h));
    return {
      width: Math.max(1, Math.floor(w * ratio)),
      height: Math.max(1, Math.floor(h * ratio)),
    };
  }

  return { width: tw, height: th };
}

// ─── Image Processing ─────────────────────────────────────────────────────────

async function processImage(sourcePath: string, size: ImageSize): Promise<Buffer> {
  const preset = SIZE_PRESETS[size];

  return pool.enqueue(async () => {
    if (preset.lossless) {
      return sharp(sourcePath).webp({ lossless: true }).toBuffer();
    }

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

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getImage(area: string, file: string, sourcePath: string, size: ImageSize): Promise<Buffer> {
  const cacheKey = `${size}:${area}/${file}`;

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
