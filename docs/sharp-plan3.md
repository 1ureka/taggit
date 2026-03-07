# Sharp + BlurHash 引入完整規劃

> 最後更新：2026-03-08

## 一、目標概述

引入 `sharp`、`blurhash`、`@unpic/placeholder` 三個套件，實現三大功能：

1. **後端自動計算圖片寬高與 BlurHash**：commit 時由後端用 sharp 讀取寬高，並計算 BlurHash 字串，一併寫入 db.json。前端不再負責測量。
2. **縮圖代理**：圖片代理路由 `/img/[area]/[file]` 新增縮圖功能，所有圖片統一轉為 **WebP** 格式回傳。
3. **BlurHash 背景佔位**：前端各處 `<img>` 利用 `@unpic/placeholder` 將 BlurHash 轉為 CSS background，在圖片載入期間顯示模糊佔位圖，無需自訂元件或 JavaScript 事件監聽。

---

## 二、現況分析

### 圖片代理路由

- 路徑：`/img/[area]/[file]`，area 為 `committed | staged | trash`。
- 目前**直接串流原始檔案**，不做任何轉換。
- committed 設 24h 快取，staged/trash 設 no-cache。
- 整個應用中所有圖片元素全部請求原始檔案。

### Tagger commit 流程

1. 前端 `doCommit()` → 用 `imageDimensions()` 在瀏覽器以 `new Image()` 測量 `naturalWidth` / `naturalHeight`。
2. 將 `{ tags, rating, width, height }` POST 到 `/api/staged/[filename]`。
3. 後端收到後，若 width/height 有效則存入，否則存 `0`。

**問題**：前端測量依賴瀏覽器圖片解碼，格式不支援或載入失敗時寬高為 0；且造成不必要的前端負載。

### 圖片載入體驗

目前各頁面的 `<img>` 在圖片載入完成前為空白，沒有佔位效果。

---

## 三、方案設計：BlurHash 佔位

### 3.1 為什麼選 BlurHash + `@unpic/placeholder`

- **BlurHash** 是約 20–30 字元的短字串，直接存在 db.json 中，無額外儲存開銷。
- `@unpic/placeholder` 的 `blurhashToDataUri()` 可將 BlurHash 轉為微型 BMP data URI（約 150 bytes），搭配自訂 CSS 組合為背景樣式，直接作為 `<img>` 的 `style` 屬性。
- **不需要自訂 `<Image>` 元件**：只要在 `<img>` 加上 `style={css}` 即可。圖片載入完成後，原生 `<img>` 自然覆蓋背景。
- **不需要 JavaScript 事件監聯**：不必監聽 `onload` 來切換狀態，CSS background 天然被 `<img>` 內容覆蓋。
- **SSR 友好**：CSS 字串可在 server-side render 時直接輸出，首屏就有佔位色塊。

### 3.2 `background-size` 必須匹配 `object-fit`

`<img>` 的 `object-fit` 與 background 的 `background-size` 使用相同的空間佈局演算法。因此：

- `object-fit: cover` → `background-size: cover`
- `object-fit: contain` → `background-size: contain`

若兩者不一致，圖片載入後會出現視覺跳動。例如 `object-fit: contain` 的圖片在元素內留有 letterbox 空白區域，但若背景用 `cover` 則會填滿整個元素，載入後 BlurHash 背景仍會從空白區域露出。

因此，我們**不使用** `blurhashToImageCssString()`（它硬編碼 `background-size: cover`），改用 `blurhashToDataUri()` 取得微型 BMP data URI，自行組合 CSS 並讓呼叫端指定 fit 模式。

### 3.3 兩類圖片的佔位策略

本應用中的圖片分為兩類，佔位策略不同：

#### Committed 圖片 — 個別 BlurHash

Committed 圖片在 db.json 中有完整的 `ImageRecord`，包含 `blurhash` 欄位。各頁面直接使用該圖片自己的 BlurHash 作為背景。

#### Staged / Trash 圖片 — 預設 BlurHash

Staged 圖片尚未寫入 db.json，Trash 圖片只有檔名沒有 db record。這兩類圖片沒有個別的 BlurHash。

**解法**：使用一個**預設 BlurHash** 作為統一佔位背景。此預設值：

- 儲存在 `server.json` 中的 `defaultBlurhash` 欄位。
- 內建一個出廠預設值（中性灰調 BlurHash）。
- 可在 Settings 頁面的「圖片與快取」章節中替換。

這兩類圖片在應用中全部以**正方形 `object-fit: cover`** 方式顯示（TaggerList 與 TrashList），因此預設 BlurHash 一律搭配 `cover` 模式。

### 3.4 前端使用範例

```svelte
<script>
  import { blurhashStyle } from "$lib/client/blurhash.js";
  import { DEFAULT_BLURHASH } from "$lib/client/constants.js";
</script>

<!-- committed 圖片：使用自身 blurhash，object-fit: cover -->
<img
  src="/img/committed/{item.id}{item.ext}?thumb"
  alt={item.originalName}
  style={blurhashStyle(item.blurhash)}
/>

<!-- committed 圖片：使用自身 blurhash，object-fit: contain -->
<img
  src="/img/committed/{item.id}{item.ext}"
  alt={item.originalName}
  style={blurhashStyle(item.blurhash, "contain")}
/>

<!-- staged/trash 圖片：使用預設 blurhash，正方形 cover -->
<img
  src="/img/staged/{encodeURIComponent(name)}?thumb"
  alt={name}
  style={blurhashStyle(DEFAULT_BLURHASH)}
/>
```

### 3.5 BlurHash 為空的 fallback

當 `blurhash` 為空字串（sharp 無法讀取），`blurhashStyle()` 回傳 `undefined`，`<img>` 回到預設空白行為，不會報錯。

---

## 四、安裝

```bash
npm install sharp blurhash @unpic/placeholder
```

> - `sharp`：native addon，安裝時自動拉取預編譯二進位。Node adapter 可正常使用。
> - `blurhash`：純 TypeScript 的 BlurHash 編碼/解碼庫。
> - `@unpic/placeholder`：將 BlurHash 轉為 CSS 的工具庫（僅需此套件，不需 `@unpic/pixels`）。

---

## 五、資料模型變更

### 5.1 `ImageRecord` 新增 `blurhash` 欄位

**檔案**：`src/lib/types.ts`

```diff
  export interface ImageRecord {
    ext: string;
    originalName: string;
    tags: string[];
    rating: number;
    committedAt: number;
    updatedAt: number;
    fileSize: number;
    width: number;
    height: number;
+   blurhash: string;     // BlurHash 字串，空字串表示無法計算
  }
```

### 5.2 `ServerConfig` 新增 `defaultBlurhash` 欄位

**檔案**：`src/lib/types.ts`

```diff
  export interface ServerConfig {
    collectionRoot?: string;
+   defaultBlurhash?: string;  // 預設 BlurHash（用於 staged/trash 圖片佔位）
  }
```

### 5.3 向下相容

- 既有 db.json 中的舊記錄不含 `blurhash` 欄位，讀取時以 `""` 作為預設值。所有使用 `item.blurhash` 的前端程式碼已有 fallback（見 3.5）。
- `server.json` 中若無 `defaultBlurhash`，前端使用內建的出廠預設值。
- 可在 Settings 維護頁面提供「補算 BlurHash」功能，批次為既有圖片補上 BlurHash（見第十一節）。

---

## 六、新增模組：`src/lib/server/thumbnail.ts`

此模組負責所有 sharp 相關操作，是與 sharp 唯一互動的地方。

### 6.1 面積公式（穩定縮放，ratio 精確保持）

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

### 6.2 LRU 記憶體快取

不使用磁碟 `.cache` 目錄，改為**純記憶體 LRU 快取**，以 `Buffer` 儲存圖片資料。

#### 設計理由

- **零磁碟 I/O**：讀取已快取的圖片時，不走 fs，直接從記憶體回傳 Buffer → Response。
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

  clear(): void {
    this.map.clear();
    this.currentBytes = 0;
  }

  get stats() {
    return { entries: this.map.size, bytes: this.currentBytes };
  }
}

const cache = new LRUCache(MAX_CACHE_BYTES);
```

### 6.3 所有圖片統一轉 WebP

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

### 6.4 避免重複產生 — Promise 去重（inflight map）

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

### 6.5 Pooling（並行限制）

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

### 6.6 讀取圖片尺寸與計算 BlurHash（供 commit 使用）

Commit 時需要一次性取得寬高和 BlurHash。為了避免重複讀取圖片，合併為一個函式：

```ts
import { encode } from "blurhash";

/** BlurHash 編碼用的縮小尺寸（僅用於計算 hash，不影響輸出品質） */
const BLURHASH_W = 32;
const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;

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

    // 將圖片縮小至固定寬度，取得 raw pixel data 供 blurhash 編碼
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
```

**流程**：
1. 讀取 metadata 取得原始寬高。
2. 將圖片 resize 到 32px 寬（等比例），輸出為 raw RGBA buffer。
3. 以 `blurhash.encode()` 計算 BlurHash 字串（4×3 components，約 28 字元）。
4. 一次性回傳 `{ width, height, blurhash }`。

### 6.7 清空快取

```ts
export function clearCache(): void {
  cache.clear();
}
```

### 6.8 完整模組結構綜覽

```ts
// src/lib/server/thumbnail.ts

import sharp from "sharp";
import { encode } from "blurhash";

// ─── Constants ────────────────────────────────────────────
const MAX_PIXELS = 250_000;
const MAX_CONCURRENT = 4;
const MAX_CACHE_BYTES = 512 * 1024 * 1024;  // 512 MB
const BLURHASH_W = 32;
const BLURHASH_COMPONENT_X = 4;
const BLURHASH_COMPONENT_Y = 3;

// ─── 面積縮放公式 ────────────────────────────────────────
function gcd(a, b): number                    // 內部
export function thumbnailSize(w, h): { width, height }

// ─── LRU Cache ────────────────────────────────────────────
class LRUCache { get, set, clear, stats }     // 內部
const cache: LRUCache                         // 內部

// ─── Pool ─────────────────────────────────────────────────
function enqueue<T>(fn): Promise<T>           // 內部
function drain(): void                        // 內部

// ─── Image Processing ─────────────────────────────────────
async function processImage(src, thumb): Promise<Buffer>  // 內部

// ─── 公開 API ─────────────────────────────────────────────
const inflight: Map<string, Promise<Buffer>>  // 內部
export async function getImage(area, file, sourcePath, thumb): Promise<Buffer>
export async function getImageMeta(filePath): Promise<{ width, height, blurhash }>
export function clearCache(): void
```

---

## 七、改動 1：Commit 後端自動計算寬高與 BlurHash

### 7.1 修改 `POST /api/staged/[filename]`

**檔案**：`src/routes/api/staged/[filename]/+server.ts`

```diff
+ import { getImageMeta } from "$lib/server/thumbnail.js";

  // ... 在 fs.renameSync 之後、addImage 之前 ...

+ const meta = await getImageMeta(destPath);
  const record: ImageRecord = {
    ext,
    originalName: filename,
    tags: trimmedTags,
    rating: rating as number,
    committedAt: now,
    updatedAt: now,
    fileSize: stat.size,
-   width: typeof width === "number" && width > 0 ? width : 0,
-   height: typeof height === "number" && height > 0 ? height : 0,
+   width: meta.width,
+   height: meta.height,
+   blurhash: meta.blurhash,
  };
```

body 中的 `width`、`height` 不再被使用，可從解構中移除。

### 7.2 修改前端 `doCommit()` — 移除寬高測量

**檔案**：`src/routes/tagger/taggerPanel.svelte.ts`

```diff
- import { stagedUrl, imageDimensions, batchRun, scrollToActive } from "./helpers.js";
+ import { stagedUrl, batchRun, scrollToActive } from "./helpers.js";

  const [ok, fail] = await batchRun(names, 5, async (fn) => {
-   const dims = await imageDimensions(stagedUrl(fn));
    return api.post(`/api/staged/${encodeURIComponent(fn)}`, {
      tags: ctx.tags,
      rating: ctx.rating,
-     ...dims,
    });
  });
```

### 7.3 清理 `imageDimensions`

**檔案**：`src/routes/tagger/helpers.ts`

- 刪除 `imageDimensions` 函式，不再被任何地方使用。

---

## 八、改動 2：縮圖代理路由

### 8.1 修改 `/img/[area]/[file]`

**檔案**：`src/routes/img/[area]/[file]/+server.ts`

新增 `thumb` query parameter，並統一將所有回傳圖片轉為 WebP。

```diff
+ import { getImage } from "$lib/server/thumbnail.js";

- export const GET: RequestHandler = ({ params }) => {
+ export const GET: RequestHandler = async ({ params, url }) => {
    // ... 既有驗證邏輯不變（area、file、path traversal 檢查）...

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

-   // ─── 以下為原始串流邏輯（移除）
-   const ext = path.extname(file).toLowerCase();
-   const mimeType = MIME_TYPES[ext] ?? "application/octet-stream";
-   // ...
  };
```

### 8.2 前端使用方式

需要縮圖的地方，在 URL 加 `?thumb`：

```diff
  <!-- TaggerList.svelte -->
- src="/img/staged/{encodeURIComponent(item.filename)}"
+ src="/img/staged/{encodeURIComponent(item.filename)}?thumb"

  <!-- ScrollMasonry.svelte -->
- src="/img/committed/{item.id}{item.ext}"
+ src="/img/committed/{item.id}{item.ext}?thumb"

  <!-- TrashList.svelte -->
- src="/img/trash/{filename}"
+ src="/img/trash/{filename}?thumb"

  <!-- EditorList.svelte -->
- src="/img/committed/{img.id}{img.ext}"
+ src="/img/committed/{img.id}{img.ext}?thumb"
```

**不使用縮圖的場景**（需原始尺寸）：
- `tagger/TaggerPreview.svelte` — 預覽區域全尺寸
- `browse/player/+page.svelte` — Player 全尺寸播放
- `compare/CompareCard.svelte` — 對比需原始畫質

---

## 九、改動 3：前端 BlurHash 佔位

### 9.1 通用 helper

**檔案**：`src/lib/client/blurhash.ts`（新增）

```ts
import { blurhashToDataUri } from "@unpic/placeholder";

/**
 * 將 blurhash 轉為可直接套用在 <img> 上的 CSS style 字串。
 * fit 參數應與該 <img> 的 object-fit 一致（預設 "cover"）。
 * 若 blurhash 為空，回傳 undefined（不套用樣式）。
 */
export function blurhashStyle(
  blurhash: string,
  fit: "cover" | "contain" = "cover",
): string | undefined {
  if (!blurhash) return undefined;
  const uri = blurhashToDataUri(blurhash);
  return [
    `background-image:url(${uri})`,
    `background-size:${fit}`,
    "background-repeat:no-repeat",
    "background-position:center",
  ].join(";");
}
```

### 9.2 預設 BlurHash 常數

**檔案**：`src/lib/client/constants.ts`（新增或追加）

```ts
/**
 * 出廠預設 BlurHash — 中性灰調，用於 staged/trash 等沒有個別 BlurHash 的圖片。
 * 可在 Settings「圖片與快取」章節中自訂替換。
 */
export const FALLBACK_BLURHASH = "L6Pj0^jE.AyE_3t7t7R**0LAt7og";
```

此值為一個人畜無害的中性灰/深灰 BlurHash。實際部署時可自行替換。

### 9.3 將預設 BlurHash 傳遞至前端

預設 BlurHash 儲存在 `server.json` 的 `defaultBlurhash` 欄位。需要透過 SSR `load` 將其傳遞至使用 staged/trash 圖片的頁面。

#### 後端讀取

**檔案**：`src/lib/server/config.ts`

```ts
export function getDefaultBlurhash(): string {
  const cfg = readServerJson();
  return cfg.defaultBlurhash ?? "";
}

export function setDefaultBlurhash(hash: string): void {
  const cfg = readServerJson();
  cfg.defaultBlurhash = hash;
  writeServerJson(cfg);
}
```

#### Tagger 頁面 load

**檔案**：`src/routes/tagger/+page.server.ts`

```diff
+ import { getDefaultBlurhash } from "$lib/server/config.js";

  export const load = () => {
    // ... 既有邏輯 ...
    return {
      files: getStagedFiles(),
+     defaultBlurhash: getDefaultBlurhash(),
    };
  };
```

#### Trash 頁面 load

**檔案**：`src/routes/trash/+page.server.ts`

```diff
+ import { getDefaultBlurhash } from "$lib/server/config.js";

  export const load = ({ url }) => {
    // ... 既有邏輯 ...
    return {
      // ... 既有欄位 ...
+     defaultBlurhash: getDefaultBlurhash(),
    };
  };
```

### 9.4 Committed 圖片 — 使用自身 BlurHash

#### ScrollMasonry（`object-fit: cover`）

**檔案**：`src/routes/scroll/ScrollMasonry.svelte`

```diff
+ import { blurhashStyle } from "$lib/client/blurhash.js";

  <img
    src="/img/committed/{item.id}{item.ext}?thumb"
    alt={item.originalName}
+   style={blurhashStyle(item.blurhash)}
    loading="lazy"
  />
```

#### CompareCard（`object-fit: contain`）

**檔案**：`src/routes/compare/CompareCard.svelte`

```diff
+ import { blurhashStyle } from "$lib/client/blurhash.js";

  <img
    src="/img/committed/{image.id}{image.ext}"
    alt={image.originalName || image.id}
+   style={blurhashStyle(image.blurhash, "contain")}
    draggable="false"
  />
```

#### EditorList（`object-fit: cover`）

**檔案**：`src/routes/editor/EditorList.svelte`

```diff
+ import { blurhashStyle } from "$lib/client/blurhash.js";

  <img
    src="/img/committed/{img.id}{img.ext}?thumb"
    alt={img.originalName}
+   style={blurhashStyle(img.blurhash)}
  />
```

#### browse/player（`object-fit: contain`）

**檔案**：`src/routes/browse/player/+page.svelte`

```diff
+ import { blurhashStyle } from "$lib/client/blurhash.js";

  <img
    src={`/img/committed/${img.id}${img.ext}`}
+   style={blurhashStyle(img.blurhash, "contain")}
    ...
  />
```

### 9.5 Staged 圖片 — 使用預設 BlurHash（正方形 cover）

**檔案**：`src/routes/tagger/TaggerList.svelte`

TaggerList 是唯一顯示 staged 圖片縮圖的地方，以正方形 `object-fit: cover` 顯示。

```diff
+ import { blurhashStyle } from "$lib/client/blurhash.js";
+ import { FALLBACK_BLURHASH } from "$lib/client/constants.js";

  // defaultBlurhash 從 page load data 傳入，若無則用 FALLBACK_BLURHASH
+ let { defaultBlurhash = "" } = $props();
+ const bgStyle = blurhashStyle(defaultBlurhash || FALLBACK_BLURHASH);

  <img
    src="/img/staged/{encodeURIComponent(item.filename)}?thumb"
    alt={item.filename}
+   style={bgStyle}
  />
```

### 9.6 Trash 圖片 — 使用預設 BlurHash（正方形 cover）

**檔案**：`src/routes/trash/TrashList.svelte`

TrashList 是唯一顯示 trash 圖片縮圖的地方，以正方形 `object-fit: cover` 顯示。

```diff
+ import { blurhashStyle } from "$lib/client/blurhash.js";
+ import { FALLBACK_BLURHASH } from "$lib/client/constants.js";

+ let { defaultBlurhash = "" } = $props();
+ const bgStyle = blurhashStyle(defaultBlurhash || FALLBACK_BLURHASH);

  <img
    class="trash-card-thumb"
    src="/img/trash/{filename}?thumb"
    alt={filename}
+   style={bgStyle}
    loading="lazy"
  />
```

### 9.7 不套用 BlurHash 的場景

- **TaggerPreview.svelte**：全尺寸預覽的 staged 圖片，佔據整個預覽區域，不需要佔位效果。

---

## 十、改動 4：Settings 新增「圖片與快取」章節

將圖片快取清空、預設 BlurHash 設定、BlurHash 補算三個功能獨立為 Settings 頁面的新章節。

### 10.1 導航更新

**檔案**：`src/routes/settings/settingsNav.svelte.ts`

```diff
  if (ctx.collectionRoot) {
    base.push({ id: "tags", label: "標籤管理" });
+   base.push({ id: "images", label: "圖片與快取" });
    base.push({ id: "maintenance", label: "系統維護" });
  }
```

### 10.2 新增 Settings 章節元件

**檔案**：`src/routes/settings/SettingsImages.svelte`（新增）

**檔案**：`src/routes/settings/settingsImages.svelte.ts`（新增）

### 10.3 章節掛載

**檔案**：`src/routes/settings/+page.svelte`

```diff
+ import SettingsImages from "./SettingsImages.svelte";

  <SettingsTagRename />
+ <SettingsImages />
  <SettingsMaintenance />
```

### 10.4 功能一：清空圖片快取

#### API 端點

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

#### UI

```svelte
<!-- 清空圖片快取 -->
<div class="tool-card">
  <div class="tool-header">
    <IconPhoto size={18} />
    <h3 class="tool-title">清空圖片快取</h3>
  </div>
  <p class="tool-desc">
    清空記憶體中的縮圖與 WebP 轉換快取。下次瀏覽圖片時將重新產生。適合在記憶體使用過高時執行。
  </p>
  <div class="tool-actions">
    <button class="btn btn-sm" onclick={ui.handleClearCacheClick} disabled={ui.cacheBusy}>
      {ui.cacheBusy ? "清空中…" : "清空快取"}
    </button>
  </div>
  {#if ui.cacheResult}
    <p class="tool-result">{ui.cacheResult}</p>
  {/if}
</div>
```

#### Handler

```ts
let cacheBusy = $state(false);
let cacheResult = $state("");

async function handleClearCacheClick() {
  cacheBusy = true;
  cacheResult = "";

  const res = await api.del("/api/maintenance/cache");
  if (res.ok) {
    cacheResult = "已清空圖片快取";
  } else {
    cacheResult = "錯誤: " + (res.error || "未知");
  }
  cacheBusy = false;
}
```

### 10.5 功能二：預設 BlurHash 設定

#### API 端點

**檔案**：`src/routes/api/settings/blurhash/+server.ts`（新檔案）

```ts
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getDefaultBlurhash, setDefaultBlurhash } from "$lib/server/config.js";
import { guardLoaded } from "$lib/server/helpers.js";

/** GET /api/settings/blurhash — 取得預設 BlurHash */
export const GET: RequestHandler = () => {
  return json({ ok: true, data: { blurhash: getDefaultBlurhash() } });
};

/** PUT /api/settings/blurhash — 設定預設 BlurHash */
export const PUT: RequestHandler = async ({ request }) => {
  const err = guardLoaded();
  if (err) return err;

  const body = await request.json();
  const { blurhash } = body;

  if (typeof blurhash !== "string") {
    return json({ ok: false, error: "blurhash must be a string" }, { status: 400 });
  }

  setDefaultBlurhash(blurhash);
  return json({ ok: true });
};
```

#### UI

```svelte
<!-- 預設 BlurHash -->
<div class="tool-card">
  <div class="tool-header">
    <IconPhoto size={18} />
    <h3 class="tool-title">預設 BlurHash</h3>
  </div>
  <p class="tool-desc">
    用於 staged 和 trash 等沒有獨立 BlurHash 的圖片作為載入佔位背景。留空則使用出廠預設值。
  </p>
  <div class="blurhash-preview-row">
    <div class="blurhash-preview" style={ui.previewStyle}></div>
    <input
      class="input input-sm blurhash-input"
      type="text"
      placeholder="留空使用預設"
      bind:value={ui.blurhashInput}
    />
  </div>
  <div class="tool-actions">
    <button class="btn btn-sm" onclick={ui.handleSaveBlurhash} disabled={ui.blurhashSaveBusy}>
      {ui.blurhashSaveBusy ? "儲存中…" : "儲存"}
    </button>
    <button class="btn btn-sm btn-ghost" onclick={ui.handleResetBlurhash}>
      恢復預設
    </button>
  </div>
  {#if ui.blurhashSaveResult}
    <p class="tool-result">{ui.blurhashSaveResult}</p>
  {/if}
</div>
```

`blurhash-preview` 是一個小方塊，即時顯示目前輸入的 BlurHash 效果：

```css
.blurhash-preview {
  width: 4rem;
  height: 4rem;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background-size: cover;
  background-position: center;
  flex-shrink: 0;
}
```

#### Handler

```ts
import { FALLBACK_BLURHASH } from "$lib/client/constants.js";
import { blurhashStyle } from "$lib/client/blurhash.js";

let blurhashInput = $state("");
let blurhashSaveBusy = $state(false);
let blurhashSaveResult = $state("");

// 即時預覽
const previewStyle = $derived(
  blurhashStyle(blurhashInput || FALLBACK_BLURHASH) ?? "",
);

// 初始化時讀取現有值
$effect(() => {
  api.get<{ blurhash: string }>("/api/settings/blurhash").then((res) => {
    if (res.ok && res.data) {
      blurhashInput = res.data.blurhash;
    }
  });
});

async function handleSaveBlurhash() {
  blurhashSaveBusy = true;
  blurhashSaveResult = "";

  const res = await api.patch("/api/settings/blurhash", {
    blurhash: blurhashInput,
  });
  if (res.ok) {
    blurhashSaveResult = "已儲存";
  } else {
    blurhashSaveResult = "錯誤: " + (res.error || "未知");
  }
  blurhashSaveBusy = false;
}

function handleResetBlurhash() {
  blurhashInput = "";
}
```

### 10.6 功能三：BlurHash 補算

#### API 端點

**檔案**：`src/routes/api/maintenance/blurhash/+server.ts`（新檔案）

```ts
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { getDB } from "$lib/server/db.js";
import { guardLoaded, getPaths } from "$lib/server/helpers.js";
import { getImageMeta } from "$lib/server/thumbnail.js";
import path from "path";

/** POST /api/maintenance/blurhash — 為缺少 blurhash 的圖片補算 */
export const POST: RequestHandler = async () => {
  const err = guardLoaded();
  if (err) return err;

  const db = getDB();
  const paths = getPaths();
  const images = db.data.images;

  let updated = 0;

  for (const [id, record] of Object.entries(images)) {
    if (record.blurhash) continue; // 已有 blurhash，跳過

    const filePath = path.join(paths.committed, id + record.ext);
    const meta = await getImageMeta(filePath);

    if (meta.blurhash) {
      record.blurhash = meta.blurhash;
      // 同時補上寬高（若原本為 0）
      if (record.width === 0 && meta.width > 0) record.width = meta.width;
      if (record.height === 0 && meta.height > 0) record.height = meta.height;
      db.markDirty();
      updated++;
    }
  }

  return json({ ok: true, data: { updated } });
};
```

#### UI

```svelte
<!-- 補算 BlurHash -->
<div class="tool-card">
  <div class="tool-header">
    <IconPhoto size={18} />
    <h3 class="tool-title">補算 BlurHash</h3>
  </div>
  <p class="tool-desc">
    為目前缺少 BlurHash 的圖片批次計算並寫入 db.json。新提交的圖片已自動包含 BlurHash，此功能主要用於升級後為舊資料補算。
  </p>
  <div class="tool-actions">
    <button class="btn btn-sm" onclick={ui.handleBlurhashCalcClick} disabled={ui.blurhashCalcBusy}>
      {ui.blurhashCalcBusy ? "計算中…" : "開始補算"}
    </button>
  </div>
  {#if ui.blurhashCalcResult}
    <p class="tool-result">{ui.blurhashCalcResult}</p>
  {/if}
</div>
```

#### Handler

```ts
let blurhashCalcBusy = $state(false);
let blurhashCalcResult = $state("");

async function handleBlurhashCalcClick() {
  blurhashCalcBusy = true;
  blurhashCalcResult = "計算中，這可能需要一些時間…";

  const res = await api.post<{ updated: number }>("/api/maintenance/blurhash");
  if (res.ok && res.data) {
    blurhashCalcResult = res.data.updated > 0
      ? `已為 ${res.data.updated} 張圖片補上 BlurHash`
      : "所有圖片皆已有 BlurHash，無需補算";
  } else {
    blurhashCalcResult = "錯誤: " + (res.error || "未知");
  }
  blurhashCalcBusy = false;
}
```

---

## 十一、修改清單一覽

| # | 檔案 | 操作 | 說明 |
|---|------|------|------|
| 1 | `package.json` | 修改 | `npm install sharp blurhash @unpic/placeholder` |
| 2 | `src/lib/types.ts` | 修改 | `ImageRecord` 新增 `blurhash`；`ServerConfig` 新增 `defaultBlurhash` |
| 3 | `src/lib/server/thumbnail.ts` | **新增** | sharp 操作模組（LRU 快取、圖片處理、尺寸與 BlurHash 計算） |
| 4 | `src/lib/server/config.ts` | 修改 | 新增 `getDefaultBlurhash()` / `setDefaultBlurhash()` |
| 5 | `src/lib/client/blurhash.ts` | **新增** | `blurhashStyle()` 前端 helper |
| 6 | `src/lib/client/constants.ts` | **新增** | `FALLBACK_BLURHASH` 出廠預設值 |
| 7 | `src/routes/img/[area]/[file]/+server.ts` | 修改 | 統一 WebP 回傳 + `?thumb` 縮圖模式 |
| 8 | `src/routes/api/staged/[filename]/+server.ts` | 修改 | 用 `getImageMeta()` 取得寬高與 BlurHash |
| 9 | `src/routes/tagger/taggerPanel.svelte.ts` | 修改 | 移除 `imageDimensions` 呼叫，不再傳寬高 |
| 10 | `src/routes/tagger/helpers.ts` | 修改 | 刪除 `imageDimensions`（不再需要） |
| 11 | `src/routes/tagger/+page.server.ts` | 修改 | load 回傳 `defaultBlurhash` |
| 12 | `src/routes/tagger/TaggerList.svelte` | 修改 | 縮圖 URL 加 `?thumb` + 預設 BlurHash 佔位 |
| 13 | `src/routes/scroll/ScrollMasonry.svelte` | 修改 | 縮圖 URL 加 `?thumb` + 自身 BlurHash 佔位 |
| 14 | `src/routes/compare/CompareCard.svelte` | 修改 | BlurHash 佔位（contain） |
| 15 | `src/routes/editor/EditorList.svelte` | 修改 | 縮圖 URL 加 `?thumb` + 自身 BlurHash 佔位 |
| 16 | `src/routes/browse/player/+page.svelte` | 修改 | BlurHash 佔位（contain） |
| 17 | `src/routes/trash/+page.server.ts` | 修改 | load 回傳 `defaultBlurhash` |
| 18 | `src/routes/trash/TrashList.svelte` | 修改 | 縮圖 URL 加 `?thumb` + 預設 BlurHash 佔位 |
| 19 | `src/routes/api/maintenance/cache/+server.ts` | **新增** | `DELETE /api/maintenance/cache` |
| 20 | `src/routes/api/maintenance/blurhash/+server.ts` | **新增** | `POST /api/maintenance/blurhash` |
| 21 | `src/routes/api/settings/blurhash/+server.ts` | **新增** | `GET/PUT /api/settings/blurhash` |
| 22 | `src/routes/settings/settingsNav.svelte.ts` | 修改 | 新增「圖片與快取」導航項目 |
| 23 | `src/routes/settings/+page.svelte` | 修改 | 掛載 `SettingsImages` 元件 |
| 24 | `src/routes/settings/settingsImages.svelte.ts` | **新增** | 圖片與快取章節邏輯 |
| 25 | `src/routes/settings/SettingsImages.svelte` | **新增** | 圖片與快取章節 UI |

---

## 十二、快取生命週期管理

### 產生時機
- **惰性產生**：圖片僅在首次被請求時經由 sharp 處理，不做預生成。
- **自動存入 LRU**：處理完成後，Buffer 自動存入記憶體快取。

### 淘汰策略
- **LRU 自動淘汰**：當快取總 bytes 超過 `MAX_CACHE_BYTES`（512 MB），自動淘汰最不常用的條目。
- **手動清空**：Settings「圖片與快取」章節的「清空圖片快取」功能，呼叫 `clearCache()` 清空整個 LRU。
- **進程重啟**：快取自動清空，無需額外處理。

### 記憶體安全
- `MAX_CACHE_BYTES` 為快取本身的上限，不含 sharp 處理過程中的暫態記憶體。
- `MAX_CONCURRENT = 4` 限制同時處理數，避免多個 sharp pipeline 同時運行時的記憶體峰值。
- 兩者搭配確保記憶體用量可預測：最大約 `MAX_CACHE_BYTES + MAX_CONCURRENT × (單張原始圖平均大小)`。

---

## 十三、BlurHash 相關設計決策

### 編碼參數

| 參數 | 值 | 說明 |
|------|---|------|
| 輸入圖片寬度 | 32 px | 縮小至 32px 寬再編碼，降低計算量 |
| componentX | 4 | 水平方向 DCT 分量數 |
| componentY | 3 | 垂直方向 DCT 分量數 |
| 產出字串長度 | ~28 字元 | 4×3 components 產出固定長度 |

### 為什麼 4×3

- 4×3 是 BlurHash 官方推薦的預設值，在視覺品質和字串長度間取得平衡。
- 較高的 component 數（如 6×6）會增加字串長度但視覺差異不明顯。
- 較低的 component 數（如 2×2）會過於模糊，失去佔位意義。

### 儲存成本

每張圖片在 db.json 中增加約 30 bytes（`"blurhash":"LKO2:N%2Tw=w]~RBV@Rj"`）。10,000 張圖片約增加 300 KB，完全可忽略。

### CSS 輸出原理

`@unpic/placeholder` 的 `blurhashToDataUri()` 將 BlurHash 解碼為一張極小的 BMP data URI（約 150 bytes）。`blurhashStyle()` helper 將其組合為完整 CSS：

```css
background-image: url(data:image/bmp;base64,...);
background-size: contain;  /* 或 cover，與 object-fit 一致 */
background-repeat: no-repeat;
background-position: center;
```

`background-size` 必須與 `<img>` 的 `object-fit` 一致，BlurHash 背景和最終圖片佔據完全相同的區域。套用在 `<img>` 上後：
- 圖片載入前：顯示模糊的 BlurHash 背景。
- 圖片載入後：`<img>` 內容自然覆蓋背景，無需 JavaScript 切換邏輯。
- 使用 `object-fit: contain` 時，letterbox 區域不會殘留 BlurHash。

### 預設 BlurHash 的設計

| 項目 | 說明 |
|------|------|
| 用途 | staged 與 trash 圖片的統一佔位背景 |
| 出廠預設 | `FALLBACK_BLURHASH`（中性灰調，硬編碼於前端 constants） |
| 自訂值 | `server.json` → `defaultBlurhash` 欄位 |
| 優先順序 | `server.json` 有值 → 使用自訂值；空或未設定 → 使用 `FALLBACK_BLURHASH` |
| 設定方式 | Settings「圖片與快取」章節，附即時預覽 |
| 顯示模式 | 固定 `object-fit: cover`（正方形卡片佈局） |
