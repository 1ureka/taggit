import sharp from "sharp";
import { encode } from "blurhash";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_PIXELS = 250_000;
const MAX_CONCURRENT = 4;
const MAX_CACHE_BYTES = 512 * 1024 * 1024; // 512 MB
const BLURHASH_W = 32;
const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;

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

// ─── LRU Cache ────────────────────────────────────────────────────────────────

type CacheEntry = {
  buffer: Buffer;
  byteSize: number;
};

class LRUCache {
  private map = new Map<string, CacheEntry>();
  private currentBytes = 0;
  private readonly maxBytes: number;

  constructor(maxBytes: number) {
    this.maxBytes = maxBytes;
  }

  get(key: string): Buffer | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.buffer;
  }

  set(key: string, buffer: Buffer): void {
    if (this.map.has(key)) {
      this.currentBytes -= this.map.get(key)!.byteSize;
      this.map.delete(key);
    }

    const byteSize = buffer.byteLength;

    while (this.currentBytes + byteSize > this.maxBytes && this.map.size > 0) {
      const oldest = this.map.keys().next().value!;
      this.currentBytes -= this.map.get(oldest)!.byteSize;
      this.map.delete(oldest);
    }

    this.map.set(key, { buffer, byteSize });
    this.currentBytes += byteSize;
  }

  clear(): void {
    this.map.clear();
    this.currentBytes = 0;
  }

  get stats() {
    return { entries: this.map.size, bytes: this.currentBytes };
  }
}

const cache = new LRUCache(MAX_CACHE_BYTES);

// ─── Pool ─────────────────────────────────────────────────────────────────────

let running = 0;
const queue: Array<() => void> = [];

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = async () => {
      running++;
      try {
        resolve(await fn());
      } catch (e) {
        reject(e);
      } finally {
        running--;
        drain();
      }
    };

    if (running < MAX_CONCURRENT) {
      run();
    } else {
      queue.push(run);
    }
  });
}

function drain() {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    const next = queue.shift()!;
    next();
  }
}

// ─── Image Processing ─────────────────────────────────────────────────────────

async function processImage(sourcePath: string, thumb: boolean): Promise<Buffer> {
  return enqueue(async () => {
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

const inflight = new Map<string, Promise<Buffer>>();

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

export function clearCache(): void {
  cache.clear();
}
