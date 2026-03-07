# Sharp 引入完整規劃

> 最後更新：2026-03-04

## 一、目標概述

引入 `sharp` 套件，實現三大功能：

1. **後端自動計算圖片寬高**：tagger commit 不再依賴前端傳入 `width` / `height`，由後端用 sharp 讀取後寫入 db.json。
2. **縮圖代理**：圖片代理路由 `/img/[area]/[file]` 新增縮圖功能，所有縮圖（與原始圖）統一轉為 **WebP** 格式回傳。
3. **前端統一 `<Image>` 元件**：共用元件處理 loading skeleton、載入完成切換，利用已知寬高產生像素級精準的 SVG shimmer 骨架。

---

## 二、現況分析

### 圖片代理路由

- 路徑：`/img/[area]/[file]`，area 為 `committed | staged | trash`。
- 目前 **直接串流原始檔案**，不做任何轉換。
- committed 設 24h 快取，staged/trash 設 no-cache。
- 整個應用中所有圖片元素全部請求原始檔案。

### Tagger commit 流程

1. 前端 `commit()` → 用 `new Image()` 在瀏覽器測量 `naturalWidth` / `naturalHeight`。
2. 將 `{ tags, rating, width, height }` POST 到 `/api/staged/[filename]`。
3. 後端收到後，若 width/height 有效則存入，否則存 `0`。

**問題**：前端測量依賴瀏覽器圖片解碼，格式不支援或載入失敗時寬高為 0；且造成不必要的前端負載。

---

## 三、安裝

```bash
npm install sharp
```

> sharp 為 native addon，安裝時會自動拉取預編譯二進位。Node adapter (`@sveltejs/adapter-node`) 可正常使用。

---

## 四、新增模組：`src/lib/server/thumbnail.ts`

此模組負責所有 sharp 相關操作，是與 sharp 唯一互動的地方。

### 4.1 面積公式（穩定縮放，ratio 精確保持）

#### 核心需求

1. **ratio 完全一致**：輸出的 $w' / h'$ 必須與輸入的 $w / h$ **數學完全相等**，不可有浮點誤差。
2. **整數輸出**：$w'$ 和 $h'$ 都必須是正整數。
3. **面積儘量小於上限**：在滿足 1、2 的前提下，面積盡可能 $\leq$ `MAX_PIXELS`。
4. **純函式、穩定**：任意時刻帶入同一組 $(w, h)$ 必定產生相同的 $(w', h')$。

#### 數學推導

若 $g = \gcd(w, h)$，定義基底單元 $b_w = w/g$，$b_h = h/g$。

所有與 $(w, h)$ **比例完全相同**且為正整數的組合，恰好是：

$$
(k \cdot b_w,\; k \cdot b_h), \quad k \in \mathbb{Z}^+
$$

面積為 $k^2 \cdot b_w \cdot b_h$，找最大的 $k$ 使得此面積 $\leq$ `MAX_PIXELS`：

$$
k = \left\lfloor \sqrt{\frac{\text{MAX\_PIXELS}}{b_w \cdot b_h}} \right\rfloor
$$

#### Edge case 與 fallback

當 $\gcd(w, h)$ 很小（1 或極小值），使得 $k=1$ 時輸出面積仍遠超上限，此時強制保持精確 ratio 毫無意義。

**策略**：若 GCD 公式算出的面積 $> 1.5 \times \text{MAX\_PIXELS}$，fallback 到傳統近似作法：

$$
r = \sqrt{\frac{\text{MAX\_PIXELS}}{w \times h}}, \quad w' = \lfloor w \cdot r \rfloor, \quad h' = \lfloor h \cdot r \rfloor
$$

此時 ratio 不再數學精確，但面積受控且仍為純函式。實務上此 fallback 極少觸發——主流解析度的 GCD 都夠大。

```ts
const MAX_PIXELS = 250_000;

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
```

#### 驗證範例

| 原始 (w, h) | gcd | base (bw, bh) | k | 輸出 (w', h') | 面積 | ratio 驗證 |
|-------------|-----|---------------|---|---------------|------|------------|
| 1920 × 1080 | 120 | 16 × 9 | 41 | 656 × 369 | 242,064 | 16/9 ✓ |
| 3840 × 2160 | 120 | 32 × 18 | 20 | 640 × 360 | 230,400 | 16/9 ✓ |
| 4032 × 3024 | 1008 | 4 × 3 | 144 | 576 × 432 | 248,832 | 4/3 ✓ |
| 6000 × 4000 | 2000 | 3 × 2 | 204 | 612 × 408 | 249,696 | 3/2 ✓ |
| 500 × 400 | 100 | 5 × 4 | — | 500 × 400 | 200,000 | 不縮放 |

### 4.2 LRU 記憶體快取

不使用磁碟 `.cache` 目錄，改為**純記憶體 LRU 快取**，以 `Buffer` 儲存縮圖資料。

#### 設計理由

- **零磁碟 I/O**：讀取已快取的縮圖時，不走 fs，直接從記憶體回傳 Buffer → Response。
- **自動淘汰**：透過 LRU（Least Recently Used）策略，自動淘汰最不常用的快取條目，避免記憶體無限增長。
- **無需清理 API**：LRU 自動管理容量，不需要手動「清空快取」功能。
- **重啟即清**：進程重啟後快取自然清空，下次請求時重新產生。

#### 容量上限 — 基於記憶體用量

快取上限不以「圖片數量」為閾值，而以**實際記憶體佔用（bytes）**為閾值：

```ts
const MAX_CACHE_BYTES = 512 * 1024 * 1024; // 512 MB（可依部署環境調整）
```

這樣能精確控制記憶體使用：一張 50KB 的縮圖和一張 500KB 的縮圖佔用不同容量，按 bytes 計算比按數量更準確。

#### 實作

```ts
type CacheEntry = {
  buffer: Buffer;
  byteSize: number;
  // LRU 鏈表指標（或使用 Map 的 insertion order 技巧）
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
    // Move to end（最近使用）— Map 的 delete + set 即可
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.buffer;
  }

  set(key: string, buffer: Buffer): void {
    // 若已存在，先移除舊的
    if (this.map.has(key)) {
      this.currentBytes -= this.map.get(key)!.byteSize;
      this.map.delete(key);
    }

    const byteSize = buffer.byteLength;

    // 淘汰最舊條目，直到有空間
    while (this.currentBytes + byteSize > this.maxBytes && this.map.size > 0) {
      const oldest = this.map.keys().next().value!;
      this.currentBytes -= this.map.get(oldest)!.byteSize;
      this.map.delete(oldest);
    }

    this.map.set(key, { buffer, byteSize });
    this.currentBytes += byteSize;
  }

  get stats() {
    return { entries: this.map.size, bytes: this.currentBytes };
  }
}

const cache = new LRUCache(MAX_CACHE_BYTES);
```

### 4.3 所有圖片統一轉 WebP

無論原始格式（JPEG、PNG、GIF、TIFF 等），所有經由 `/img/[area]/[file]` 回傳的圖片一律轉為 **WebP** 格式。

| 模式 | 行為 |
|------|------|
| `?thumb`（縮圖） | resize → WebP（quality: 80） |
| 無 `?thumb`（原始尺寸） | 不 resize，僅轉 WebP（quality: 90） |

**理由**：
- WebP 壓縮效率大幅優於 JPEG/PNG，減少頻寬。
- 前端統一處理 `image/webp`，無需根據副檔名判斷 MIME type。
- 轉換後的 Buffer 直接存入 LRU 記憶體快取。

**快取 key 設計**：

```ts
// 縮圖與原始尺寸使用不同 key
const cacheKey = wantThumb
  ? `thumb:${area}/${file}`
  : `full:${area}/${file}`;
```

### 4.4 避免重複產生 — Promise 去重（inflight map）

```ts
const inflight = new Map<string, Promise<Buffer>>();

export async function getImage(
  area: string, file: string, sourcePath: string, thumb: boolean,
): Promise<Buffer> {
  const cacheKey = thumb ? `thumb:${area}/${file}` : `full:${area}/${file}`;

  // 已在快取 → 直接回傳
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // 正在產生中 → 復用 Promise
  if (inflight.has(cacheKey)) return inflight.get(cacheKey)!;

  // 排入產生
  const promise = processImage(sourcePath, thumb)
    .then((buffer) => {
      cache.set(cacheKey, buffer);
      return buffer;
    })
    .finally(() => inflight.delete(cacheKey));

  inflight.set(cacheKey, promise);
  return promise;
}
```

### 4.5 Pooling（並行限制）

為避免同時大量 sharp 操作導致記憶體/CPU 爆衝，使用簡單的並行限制池：

```ts
const MAX_CONCURRENT = 4;
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
```

實際的 `processImage` 透過 `enqueue` 排入池中：

```ts
async function processImage(sourcePath: string, thumb: boolean): Promise<Buffer> {
  return enqueue(async () => {
    if (!thumb) {
      // 原始尺寸 → 僅轉 WebP
      return sharp(sourcePath).webp({ quality: 90 }).toBuffer();
    }

    const meta = await sharp(sourcePath).metadata();
    const origW = meta.width ?? 0;
    const origH = meta.height ?? 0;

    if (origW === 0 || origH === 0) {
      // 無法讀取尺寸 → 直接轉 WebP，不 resize
      return sharp(sourcePath).webp({ quality: 80 }).toBuffer();
    }

    const { width, height } = thumbnailSize(origW, origH);

    if (width === origW && height === origH) {
      return sharp(sourcePath).webp({ quality: 80 }).toBuffer();
    }

    return sharp(sourcePath)
      .resize(width, height, { fit: "fill" })
      .webp({ quality: 80 })
      .toBuffer();
  });
}
```

注意：所有操作使用 `.toBuffer()` 而非 `.toFile()`，產出 `Buffer` 直接存入 LRU 記憶體快取。

### 4.6 讀取圖片尺寸（供 commit 使用）

```ts
export async function getImageSize(filePath: string): Promise<{ width: number; height: number }> {
  try {
    const meta = await sharp(filePath).metadata();
    return { width: meta.width ?? 0, height: meta.height ?? 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}
```

### 4.7 完整模組結構綜覽

```ts
// src/lib/server/thumbnail.ts

import sharp from "sharp";

// ─── Constants ────────────────────────────────────────────
const MAX_PIXELS = 250_000;
const MAX_CONCURRENT = 4;
const MAX_CACHE_BYTES = 512 * 1024 * 1024;  // 512 MB

// ─── 面積縮放公式 ────────────────────────────────────────
function gcd(a, b): number                    // 內部
export function thumbnailSize(w, h): { width, height }

// ─── LRU Cache ────────────────────────────────────────────
class LRUCache { get, set, stats }            // 內部
const cache: LRUCache                         // 內部

// ─── Pool ─────────────────────────────────────────────────
function enqueue<T>(fn): Promise<T>           // 內部
function drain(): void                        // 內部

// ─── Image Processing ─────────────────────────────────────
async function processImage(src, thumb): Promise<Buffer>  // 內部

// ─── 公開 API ─────────────────────────────────────────────
const inflight: Map<string, Promise<Buffer>>  // 內部
export async function getImage(area, file, sourcePath, thumb): Promise<Buffer>
export async function getImageSize(filePath): Promise<{ width, height }>
```

---

## 五、改動 1：Commit 後端自動計算寬高

### 5.1 修改 `POST /api/staged/[filename]`

**檔案**：`src/routes/api/staged/[filename]/+server.ts`

```diff
+ import { getImageSize } from "$lib/server/thumbnail.js";

  // ... 在 fs.renameSync 之後、addImage 之前 ...

- width: typeof width === "number" && width > 0 ? width : 0,
- height: typeof height === "number" && height > 0 ? height : 0,
+ const dims = await getImageSize(destPath);
  const record: ImageRecord = {
    ext,
    originalName: filename,
    tags: trimmedTags,
    rating: rating as number,
    committedAt: now,
    updatedAt: now,
    fileSize: stat.size,
+   width: dims.width,
+   height: dims.height,
  };
```

### 5.2 修改前端 `commit()` — 移除寬高測量

**檔案**：`src/routes/tagger/actions.ts`

```diff
  const [ok, fail] = await batchRun(names, 5, async (fn) => {
-   const dims = await imageDimensions(stagedUrl(fn));
    return api.post(`/api/staged/${encodeURIComponent(fn)}`, {
      tags: editStore.tags,
      rating: editStore.rating,
-     ...dims,
    });
  });
```

### 5.3 可選：清理 `imageDimensions`

**檔案**：`src/routes/tagger/helpers.ts`

- `imageDimensions` 函式不再被使用，可刪除。

---

## 六、改動 2：縮圖代理路由

### 6.1 修改 `/img/[area]/[file]`

**檔案**：`src/routes/img/[area]/[file]/+server.ts`

新增 `thumb` query parameter，並統一將所有回傳圖片轉為 WebP。

```diff
+ import { getImage } from "$lib/server/thumbnail.js";

  export const GET: RequestHandler = async ({ params, url }) => {
    // ... 既有驗證邏輯不變 ...

    const filePath = path.resolve(baseDir, file);
    // ... 路徑安全檢查 ...
    // ... 檔案存在檢查 ...

+   const wantThumb = url.searchParams.has("thumb");
+   const buffer = await getImage(area!, file!, filePath, wantThumb);
+
+   return new Response(buffer, {
+     headers: {
+       "Content-Type": "image/webp",
+       "Cache-Control": wantThumb
+         ? "public, max-age=604800"    // 縮圖 7 天
+         : area === "committed"
+           ? "public, max-age=86400"   // committed 原始 24h
+           : "no-cache",               // staged/trash 不快取
+     },
+   });

-   // ─── 原始檔案（既有邏輯）
-   const ext = path.extname(file).toLowerCase();
-   // ...
  };
```

**注意**：handler 改為 `async` 因為 `getImage` 是 async。

### 6.2 前端使用方式

需要縮圖的地方，在 URL 加 `?thumb`：

```diff
  <!-- TaggerSidebar.svelte -->
- src="/img/staged/{encodeURIComponent(item.filename)}"
+ src="/img/staged/{encodeURIComponent(item.filename)}?thumb"

  <!-- scroll/+page.svelte -->
- src="/img/committed/{item.id}{item.ext}"
+ src="/img/committed/{item.id}{item.ext}?thumb"

  <!-- trash/TrashSearch.svelte -->
- src="/img/trash/{filename}"
+ src="/img/trash/{filename}?thumb"
```

**不使用縮圖的場景**（需原始尺寸）：
- `tagger/TaggerPreview.svelte` — 預覽區域全尺寸
- `browse/player/+page.svelte` — Player 全尺寸播放
- `compare/+page.svelte` — 對比需原始畫質
- `editor/` — 編輯器需原始畫質

---

## 七、改動 3：Tagger 工具 Modal — 清空垃圾桶 → 清空快取

### 7.1 理由

清空垃圾桶功能在 `/trash` 路由已可操作，Tagger 工具 Modal 不需重複。改為「清空快取」，供使用者在記憶體過高時手動釋放。

### 7.2 新增 API 端點

**檔案**：`src/routes/api/maintenance/cache/+server.ts`（新檔案）

```ts
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { clearCache } from "$lib/server/thumbnail.js";
import { guardLoaded } from "$lib/server/helpers.js";

/** DELETE /api/maintenance/cache — 清空記憶體中的圖片快取 */
export const DELETE: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;

  clearCache();
  return json({ ok: true });
};
```

`clearCache` 在 thumbnail.ts 中新增為公開 API：

```ts
export function clearCache(): void {
  cache.clear();  // LRUCache 新增 clear() 方法，重置 map 與 currentBytes
}
```

### 7.3 修改 actions.ts

```diff
- export async function emptyTrash() { ... }

+ export async function clearImageCache() {
+   if (!(await confirm("確定要清空圖片快取？下次瀏覽將重新產生。"))) return;
+   toolStore.result = "清空中...";
+   const res = await api.del("/api/maintenance/cache");
+   if (res.ok) {
+     toolStore.result = "✓ 已清空圖片快取";
+   } else {
+     toolStore.result = "錯誤: " + (res.error || "未知");
+   }
+ }
```

### 7.4 修改 TaggerModalTools.svelte

```diff
- import { ..., emptyTrash } from "./actions.js";
+ import { ..., clearImageCache } from "./actions.js";

- <button class="btn btn-destructive" onclick={emptyTrash}>
-   <IconTrashX size={16} />
-   清空垃圾桶
- </button>
+ <button class="btn btn-destructive" onclick={clearImageCache}>
+   <IconTrashX size={16} />
+   清空快取
+ </button>
```

---

## 八、改動 4：共用 `<Image>` 元件（含 Skeleton）

### 8.1 設計目標

建立 `src/lib/components/Image.svelte`，作為所有圖片載入的統一元件。在圖片尚未載入時顯示 **SVG shimmer 骨架**，載入完成後無縫切換到實際圖片。

### 8.2 Skeleton 原理

利用 `<img>` 元素的 `object-fit: contain` 特性：

1. 已知目標圖片的 `width` 和 `height`（從 db.json 中取得）。
2. 產生一個同比例的 SVG data URI 作為 `src`，SVG 內含 shimmer 掃光動畫。
3. 因為 SVG 的 viewBox 比例與實際圖片完全一致，`object-fit: contain` 會將 SVG 精確定位在與最終圖片相同的區域。
4. 當實際圖片載入完成（`onload`），替換 `src` → shimmer 無縫消失。

### 8.3 SVG Shimmer 產生函式

```ts
// src/lib/client/shimmer.ts

/**
 * 產生含 shimmer 動畫的 SVG data URI。
 * 使用與目標圖片相同的寬高，確保 object-fit: contain 時定位一致。
 */
export function shimmerSrc(width: number, height: number): string {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <style>
    .base { fill: #1a1a1a; }
    .wave {
      animation: shimmer 2.2s cubic-bezier(0.4,0,0.2,1) infinite;
    }
    .wave2 {
      animation: shimmer2 2.8s cubic-bezier(0.4,0,0.2,1) infinite;
    }
    @keyframes shimmer {
      0%   { transform: translateX(-120%); }
      50%  { transform: translateX(20%); }
      100% { transform: translateX(120%); }
    }
    @keyframes shimmer2 {
      0%   { transform: translateX(-150%); }
      50%  { transform: translateX(-10%); }
      100% { transform: translateX(130%); }
    }
  </style>
  <defs>
    <linearGradient id="g1" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${width}" y2="0">
      <stop offset="0%" stop-color="#1a1a1a"/>
      <stop offset="35%" stop-color="#252525"/>
      <stop offset="50%" stop-color="#2a2a2a"/>
      <stop offset="65%" stop-color="#252525"/>
      <stop offset="100%" stop-color="#1a1a1a"/>
    </linearGradient>
    <linearGradient id="g2" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${width}" y2="0">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" class="base"/>
  <rect class="wave" x="${-width}" y="0" width="${width * 2}" height="${height}" fill="url(#g1)"/>
  <rect class="wave2" x="${-width * 1.5}" y="0" width="${width * 2.5}" height="${height}" fill="url(#g2)"/>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
```

**深色主題適配**：底色使用 `#1a1a1a`（接近 `--bg-hover`），掃光使用 `#2a2a2a`，柔光層用低透明度白色。與應用深色背景融合。

### 8.4 `<Image>` 元件

**檔案**：`src/lib/components/Image.svelte`

```svelte
<script lang="ts">
  import { shimmerSrc } from "$lib/client/shimmer.js";

  let {
    src,
    alt = "",
    width,
    height,
    class: className = "",
    ...restProps
  }: {
    src: string;
    alt?: string;
    width: number;
    height: number;
    class?: string;
    [key: string]: unknown;
  } = $props();

  let loaded = $state(false);
  let currentSrc = $derived(loaded ? src : shimmerSrc(width, height));

  function handleLoad() {
    loaded = true;
  }

  // src 變更時重置 loaded 狀態
  $effect(() => {
    src;  // track
    loaded = false;
  });
</script>

<img
  src={currentSrc}
  {alt}
  class={className}
  onload={loaded ? undefined : handleLoad}
  {...restProps}
/>
```

**使用方式**：

```svelte
<Image
  src="/img/committed/{item.id}{item.ext}?thumb"
  alt={item.originalName}
  width={item.width}
  height={item.height}
  class="card-image"
/>
```

**關鍵行為**：
1. 初始：`src` 為 SVG shimmer data URI → 瀏覽器立即渲染骨架動畫。
2. 同時：瀏覽器在背景預取實際圖片 URL（透過 `$effect` 觸發）。
3. 載入完成：`handleLoad` → `loaded = true` → `currentSrc` 切換為真實 URL。
4. `src` 變更：`$effect` 偵測到 `src` 變化 → `loaded = false` → 重新顯示 shimmer → 新圖片載入後再切換。

**注意**：此元件要求呼叫端提供 `width` 和 `height`。這些值來自 db.json（由後端 sharp 計算後寫入），在 SSR 的 `load` 函數中提供。

### 8.5 載入機制細節

上述簡化版本有一個問題：`currentSrc` 在 `loaded` 為 false 時顯示 shimmer，但瀏覽器不會自動預取真實圖片。需要額外機制：

```svelte
<script lang="ts">
  import { shimmerSrc } from "$lib/client/shimmer.js";

  let { src, alt = "", width, height, class: className = "", ...restProps } = $props();
  let loaded = $state(false);
  let displaySrc = $derived(loaded ? src : shimmerSrc(width, height));

  $effect(() => {
    loaded = false;
    const img = new Image();
    img.src = src;
    img.onload = () => { loaded = true; };
  });
</script>

<img
  src={displaySrc}
  {alt}
  class={className}
  {...restProps}
/>
```

這個版本使用隱藏的 `Image()` 預取實際圖片，確保：
- 顯示的 `<img>` 始終有有效 src（shimmer 或實際圖片）。
- 切換時瀏覽器已快取實際圖片，無閃爍。
- `src` 變更時自動重新載入。

---

## 九、修改清單一覽

| # | 檔案 | 操作 | 說明 |
|---|------|------|------|
| 1 | `package.json` | 修改 | `npm install sharp` |
| 2 | `src/lib/server/thumbnail.ts` | **新增** | sharp 操作模組（LRU 快取、圖片處理、尺寸讀取） |
| 3 | `src/lib/client/shimmer.ts` | **新增** | SVG shimmer data URI 產生函式 |
| 4 | `src/lib/components/Image.svelte` | **新增** | 共用圖片元件（skeleton → 實際圖片切換） |
| 5 | `src/routes/img/[area]/[file]/+server.ts` | 修改 | 統一 WebP 回傳 + `?thumb` 縮圖模式 |
| 6 | `src/routes/api/staged/[filename]/+server.ts` | 修改 | 用 `getImageSize()` 取代前端寬高 |
| 7 | `src/routes/tagger/actions.ts` | 修改 | 移除 `imageDimensions`；`emptyTrash` → `clearImageCache` |
| 8 | `src/routes/tagger/helpers.ts` | 修改 | 刪除 `imageDimensions`（不再需要） |
| 9 | `src/routes/tagger/TaggerModalTools.svelte` | 修改 | 清空垃圾桶 → 清空快取 |
| 10 | `src/routes/api/maintenance/cache/+server.ts` | **新增** | `DELETE /api/maintenance/cache` |
| 11 | `src/routes/tagger/TaggerSidebar.svelte` | 修改 | 縮圖 URL 加 `?thumb` + 使用 `<Image>` |
| 12 | `src/routes/scroll/+page.svelte` | 修改 | 縮圖 URL 加 `?thumb` + 使用 `<Image>` |
| 13 | `src/routes/trash/TrashSearch.svelte` | 修改 | 縮圖 URL 加 `?thumb` + 使用 `<Image>` |
| 14 | `.gitignore` | 檢查 | 不再需要忽略 `.cache`（無磁碟快取） |

---

## 十、快取生命週期管理

### 產生時機
- **惰性產生**：圖片僅在首次被請求時經由 sharp 處理，不做預生成。
- **自動存入 LRU**：處理完成後，Buffer 自動存入記憶體快取。

### 淘汰策略
- **LRU 自動淘汰**：當快取總 bytes 超過 `MAX_CACHE_BYTES`（512 MB），自動淘汰最不常用的條目。
- **手動清空**：Tagger 工具 Modal 的「清空快取」按鈕，呼叫 `clearCache()` 清空整個 LRU。
- **進程重啟**：快取自動清空，無需額外處理。

### 記憶體安全
- `MAX_CACHE_BYTES` 為快取本身的上限，不含 sharp 處理過程中的暫態記憶體。
- `MAX_CONCURRENT = 4` 限制同時處理數，避免多個 sharp pipeline 同時運行時的記憶體峰值。
- 兩者搭配確保記憶體用量可預測：最大約 `MAX_CACHE_BYTES + MAX_CONCURRENT × (單張原始圖平均大小)`。
