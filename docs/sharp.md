# Sharp 引入完整規劃

> 最後更新：2026-03-04

## 一、目標概述

引入 `sharp` 套件，一次實現兩大改動：

1. **後端自動計算圖片寬高**：tagger commit 不再依賴前端傳入 `width` / `height`，由後端用 sharp 讀取尺寸後寫入 db.json。
2. **縮圖代理**：現有靜態圖片代理路由 `/img/[area]/[file]` 新增縮圖功能，大幅改善效能。

---

## 二、現況分析

### 圖片代理路由

- 路徑：`/img/[area]/[file]`，area 為 `committed | staged | trash`。
- 目前 **直接串流原始檔案**，不做任何轉換。
- committed 設 24h 快取，staged/trash 設 no-cache。
- 整個應用中 **所有圖片元素**——包含 Tagger 側欄縮圖、Scroll 瀑布流、Browse player、Compare 對比、Trash 卡片——全部請求原始檔案。

### Tagger commit 流程

1. 前端 `commit()` → 對每張圖呼叫 `imageDimensions(stagedUrl(fn))`，用 `new Image()` 在瀏覽器測量 `naturalWidth` / `naturalHeight`。
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

1. **ratio 完全一致**：輸出的 `w' / h'` 必須與輸入的 `w / h` **數學完全相等**，不可有任何浮點誤差。
2. **整數輸出**：`w'` 和 `h'` 都必須是正整數。
3. **面積儘量小於上限**：在滿足 1、2 的前提下，面積盡可能 ≤ `MAX_PIXELS`。
4. **純函式、穩定**：任意時刻帶入同一組 `(w, h)` 必定產生相同的 `(w', h')`。

#### 數學推導

若 $g = \gcd(w, h)$，定義基底單元 $b_w = w/g$，$b_h = h/g$。

所有與 $(w, h)$ **比例完全相同**且為正整數的組合，恰好是：

$$
(k \cdot b_w,\; k \cdot b_h), \quad k \in \mathbb{Z}^+
$$

這是數學上充要的——沒有其他正整數 pair 能達到完全相同的 ratio。

面積為 $k^2 \cdot b_w \cdot b_h$，找最大的 $k$ 使得此面積 $\leq$ `MAX_PIXELS`：

$$
k = \left\lfloor \sqrt{\frac{\text{MAX\_PIXELS}}{b_w \cdot b_h}} \right\rfloor
$$

#### Edge case 與 fallback

當 $\gcd(w, h)$ 很小（1 或極小值），使得 $k=1$ 時輸出面積仍遠超上限，此時強制保持精確 ratio 毫無意義（縮圖效果差）。

**策略**：若 GCD 公式算出的面積 $> 1.5 \times \text{MAX\_PIXELS}$，fallback 到傳統近似作法：

$$
r = \sqrt{\frac{\text{MAX\_PIXELS}}{w \times h}}, \quad w' = \lfloor w \cdot r \rfloor, \quad h' = \lfloor h \cdot r \rfloor
$$

此時 ratio 不再數學精確，但：
- 面積確實受控在 MAX\_PIXELS 附近。
- 仍然是純函式、穩定（相同輸入相同輸出）。
- 實務上此 fallback 極少觸發——主流相機/螢幕解析度（如 1920×1080 → gcd=120, 4032×3024 → gcd=1008）的 GCD 都夠大。

```ts
const MAX_PIXELS = 250_000;

function gcd(a: number, b: number): number {
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return a;
}

/**
 * 計算縮圖尺寸（ratio 精確保持）。
 *
 * 演算法：
 *   1. 若原始面積 w×h ≤ MAX_PIXELS → 回傳 (w, h)（不放大）。
 *   2. 計算 g = gcd(w, h)，基底 bw = w/g, bh = h/g。
 *   3. 找最大正整數 k 使得 k² × bw × bh ≤ MAX_PIXELS。
 *   4. 回傳 (bw × k, bh × k)。
 *
 * 性質：
 *   - ratio 精確：(bw×k)/(bh×k) = bw/bh = w/h（整數除法完全相等）。
 *   - 整數輸出：bw, bh, k 皆為正整數，乘積亦為正整數。
 *   - 純函式：僅依賴 (w, h) 和常量 MAX_PIXELS。
 *   - 穩定：相同 (w, h) 永遠產生相同結果。
 *   - 面積 ≤ MAX_PIXELS：當 bw×bh ≤ MAX_PIXELS 時保證成立；
 *     當 bw×bh > MAX_PIXELS（coprime 大尺寸）時回傳最小合法 pair。
 */
export function thumbnailSize(w: number, h: number): { width: number; height: number } {
  if (w * h <= MAX_PIXELS) return { width: w, height: h };

  const g = gcd(w, h);
  const bw = w / g;
  const bh = h / g;
  const baseArea = bw * bh;

  // 找最大 k，使用整數運算驗證避免浮點誤差
  let k = Math.floor(Math.sqrt(MAX_PIXELS / baseArea));
  // 浮點修正：嘗試 k+1 是否實際可行
  while ((k + 1) * (k + 1) * baseArea <= MAX_PIXELS) k++;
  k = Math.max(1, k);

  const tw = bw * k;
  const th = bh * k;

  // Edge case fallback：gcd 太小導致面積仍遠超上限時，
  // 退回傳統近似作法（ratio 不再精確，但面積受控）
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

| 原始 (w, h) | gcd | base (bw, bh) | baseArea | k | 輸出 (w', h') | 面積 | ratio 驗證 |
|-------------|-----|---------------|----------|---|---------------|------|------------|
| 1920 × 1080 | 120 | 16 × 9 | 144 | 41 | 656 × 369 | 242,064 | 16/9 ✓ |
| 3840 × 2160 | 120 | 32 × 18 | 576 | 20 | 640 × 360 | 230,400 | 16/9 ✓ |
| 4032 × 3024 | 1008 | 4 × 3 | 12 | 144 | 576 × 432 | 248,832 | 4/3 ✓ |
| 6000 × 4000 | 2000 | 3 × 2 | 6 | 204 | 612 × 408 | 249,696 | 3/2 ✓ |
| 500 × 400 | 100 | 5 × 4 | 20 | — | 500 × 400 | 200,000 | 不縮放 |
| 1921 × 1081 | 1 | 1921 × 1081 | 2,078,601 | 1 | 498 × 280 | 139,440 | fallback* |

\* coprime 大尺寸：GCD 公式結果面積 > 1.5×MAX，觸發傳統近似 fallback（ratio 近似但面積受控）。

### 4.2 快取路徑結構

```
<server.json 同級目錄>/
├── server.json
└── .cache/
    ├── committed/
    │   └── <id><ext>          # 如 a1b2c3d4e5f6g7h8.webp
    ├── staged/
    │   └── <filename>         # 如 my-photo.png
    └── trash/
        └── <filename>         # 如 IMG_001.jpg
```

- 快取目錄位於 `path.resolve("server.json", "..")` 即 `path.dirname(SERVER_JSON_PATH)`，名稱為 `.cache`。
- 快取子目錄結構與 `/img/[area]/[file]` 路由參數完全一致，所以識別方式為 `<area>/<file>`。
- 縮圖格式固定為 **WebP**（sharp 預設壓縮效率最佳），快取副檔名改為 `.webp`。

### 4.3 避免重複產生 — Promise 去重（inflight map）

```ts
/** 正在產生中的縮圖 Promise，避免重複觸發 */
const inflight = new Map<string, Promise<string>>();

/**
 * 取得縮圖路徑。
 * 若快取已存在 → 直接回傳路徑。
 * 若正在產生中 → 回傳已有的 Promise（去重）。
 * 若不存在 → 排入產生佇列。
 */
export async function getThumbnail(area: string, file: string, sourcePath: string): Promise<string> {
  const cacheKey = `${area}/${file}`;

  // 快取副檔名固定為 .webp
  const cacheName = path.basename(file, path.extname(file)) + ".webp";
  const cachePath = path.join(CACHE_DIR, area, cacheName);

  // 已有快取 → 直接使用
  if (fs.existsSync(cachePath)) return cachePath;

  // 正在產生中 → 復用 Promise
  if (inflight.has(cacheKey)) return inflight.get(cacheKey)!;

  // 排入產生
  const promise = generateThumbnail(sourcePath, cachePath)
    .finally(() => inflight.delete(cacheKey));

  inflight.set(cacheKey, promise);
  return promise;
}
```

### 4.4 Pooling（並行限制）

為避免同時大量產生縮圖導致記憶體/CPU 爆衝，使用簡單的並行限制池：

```ts
const MAX_CONCURRENT = 4;  // 可依硬體調整
let running = 0;
const queue: Array<{ run: () => Promise<void>; resolve: () => void }> = [];

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
      queue.push({ run: run as () => Promise<void>, resolve: () => {} });
    }
  });
}

function drain() {
  while (running < MAX_CONCURRENT && queue.length > 0) {
    const item = queue.shift()!;
    item.run();
  }
}
```

實際的 `generateThumbnail` 會透過 `enqueue` 排入池中：

```ts
async function generateThumbnail(sourcePath: string, cachePath: string): Promise<string> {
  return enqueue(async () => {
    // 確保快取目錄存在
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });

    const meta = await sharp(sourcePath).metadata();
    const origW = meta.width ?? 0;
    const origH = meta.height ?? 0;

    if (origW === 0 || origH === 0) {
      // 無法讀取尺寸 → 不產生縮圖，複製原始
      fs.copyFileSync(sourcePath, cachePath);
      return cachePath;
    }

    const { width, height } = thumbnailSize(origW, origH);

    if (width === origW && height === origH) {
      // 面積已小於上限 → 不需縮放，直接轉 WebP
      await sharp(sourcePath).webp({ quality: 80 }).toFile(cachePath);
    } else {
      await sharp(sourcePath)
        .resize(width, height, { fit: "fill" })  // 已精確計算過，直接 fill
        .webp({ quality: 80 })
        .toFile(cachePath);
    }

    return cachePath;
  });
}
```

### 4.5 讀取圖片尺寸（供 commit 使用）

```ts
/**
 * 讀取圖片 metadata，回傳寬高。
 * 供 commit API 使用，取代前端的 imageDimensions()。
 */
export async function getImageSize(filePath: string): Promise<{ width: number; height: number }> {
  try {
    const meta = await sharp(filePath).metadata();
    return { width: meta.width ?? 0, height: meta.height ?? 0 };
  } catch {
    return { width: 0, height: 0 };
  }
}
```

### 4.6 清空快取

```ts
/**
 * 遞迴刪除整個 .cache 目錄。
 * 回傳被刪除的檔案數。
 */
export function clearCache(): number {
  if (!fs.existsSync(CACHE_DIR)) return 0;

  let count = 0;
  // 遞迴計數所有檔案
  function countFiles(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) countFiles(path.join(dir, entry.name));
      else count++;
    }
  }
  countFiles(CACHE_DIR);

  fs.rmSync(CACHE_DIR, { recursive: true, force: true });
  return count;
}
```

### 4.7 完整模組結構綜覽

```ts
// src/lib/server/thumbnail.ts

import fs from "fs";
import path from "path";
import sharp from "sharp";

// ─── Constants ────────────────────────────────────────────
const SERVER_JSON_DIR = path.dirname(path.resolve("server.json"));
const CACHE_DIR = path.join(SERVER_JSON_DIR, ".cache");
const MAX_PIXELS = 250_000;
const MAX_CONCURRENT = 4;

// ─── 面積縮放公式 ────────────────────────────────────────
function gcd(a, b): number                  //（內部函式，不匯出）
export function thumbnailSize(w, h): { width, height }

// ─── Pool ─────────────────────────────────────────────────
//（內部函式，不匯出）
function enqueue<T>(fn): Promise<T>
function drain(): void

// ─── 縮圖產生 ─────────────────────────────────────────────
//（內部函式，不匯出）
async function generateThumbnail(sourcePath, cachePath): Promise<string>

// ─── 公開 API ─────────────────────────────────────────────
const inflight: Map<string, Promise<string>>
export async function getThumbnail(area, file, sourcePath): Promise<string>
export async function getImageSize(filePath): Promise<{ width, height }>
export function clearCache(): number
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
  // ...
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

**要點**：
- body 中的 `width` / `height` 不再需要，但為向後相容，直接忽略即可（不刪 body 解構欄位）。
- `getImageSize` 讀取的是已搬移到 committed 的檔案（`destPath`），確保路徑正確。
- 此為 async 操作，但 commit 本來就是 `async` handler，無需額外改動。

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
- 確認無其他引用後移除。

---

## 六、改動 2：縮圖代理路由

### 6.1 修改 `/img/[area]/[file]`

**檔案**：`src/routes/img/[area]/[file]/+server.ts`

新增 `thumb` query parameter，當 `?thumb` 存在時回傳縮圖。

```diff
+ import { getThumbnail } from "$lib/server/thumbnail.js";

  export const GET: RequestHandler = async ({ params, url }) => {
    // ... 既有驗證邏輯不變 ...

    const filePath = path.resolve(baseDir, file);
    // ... 路徑安全檢查 ...
    // ... 檔案存在檢查 ...

+   // ─── 縮圖模式 ──────────────────────────────────────────
+   const wantThumb = url.searchParams.has("thumb");
+
+   if (wantThumb) {
+     const thumbPath = await getThumbnail(area!, file!, filePath);
+     const thumbStream = fs.createReadStream(thumbPath);
+     const webStream = Readable.toWeb(thumbStream) as ReadableStream;
+     return new Response(webStream, {
+       headers: {
+         "Content-Type": "image/webp",
+         "Cache-Control": "public, max-age=604800",  // 7 天
+       },
+     });
+   }

    // ─── 原始檔案（既有邏輯不變）─────────────────────────
    const ext = path.extname(file).toLowerCase();
    // ...
  };
```

**注意**：handler 改為 `async` 因為 `getThumbnail` 是 async。

### 6.2 縮圖快取控制

| 區域 | 縮圖 Cache-Control | 說明 |
|------|---------------------|------|
| committed | `public, max-age=604800` (7天) | committed 圖片不變，長期快取 |
| staged | `public, max-age=604800` (7天) | staged 檔名不變時內容不變 |
| trash | `public, max-age=604800` (7天) | trash 檔案不變 |

快取的失效由刪除快取檔案本身來處理（清空快取功能），不靠 HTTP Cache-Control。

### 6.3 前端使用方式

前端需要縮圖的地方，只需在 URL 加 `?thumb` 即可：

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
- `tagger/TaggerPreview.svelte` — 預覽區域全尺寸。
- `browse/player/+page.svelte` — Player 全尺寸播放。
- `compare/+page.svelte` — 對比需原始畫質。
- `editor/` — 編輯器需原始畫質。

---

## 七、改動 3：Tagger 工具 Modal — 清空垃圾桶 → 清空快取

### 7.1 理由

清空垃圾桶功能在 `/trash` 路由已可操作，Tagger 工具 Modal 不需重複。改為「清空快取」更實用，因為快取是新引入的概念，需要在某處提供清理入口。

### 7.2 新增 API 端點

**檔案**：`src/routes/api/maintenance/cache/+server.ts`（新檔案）

```ts
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "@sveltejs/kit";
import { clearCache } from "$lib/server/thumbnail.js";
import { guardLoaded } from "$lib/server/helpers.js";

/** DELETE /api/maintenance/cache — 清空縮圖快取 */
export const DELETE: RequestHandler = () => {
  const err = guardLoaded();
  if (err) return err;

  const deleted = clearCache();
  return json({ ok: true, data: { deleted } });
};
```

### 7.3 修改 actions.ts

```diff
- export async function emptyTrash() {
-   if (!(await confirm("確定要清空垃圾桶？此操作無法復原。"))) return;
-   toolStore.result = "清空中...";
-   const res = await api.del<{ deleted: number }>("/api/trash");
-   if (res.ok && res.data) {
-     toolStore.result = `✓ 已清空垃圾桶，刪除 ${res.data.deleted} 個檔案`;
-   } else {
-     toolStore.result = "錯誤: " + (res.error || "未知");
-   }
- }

+ export async function clearThumbnailCache() {
+   if (!(await confirm("確定要清空縮圖快取？下次瀏覽將重新產生縮圖。"))) return;
+   toolStore.result = "清空中...";
+   const res = await api.del<{ deleted: number }>("/api/maintenance/cache");
+   if (res.ok && res.data) {
+     toolStore.result = `✓ 已清空快取，刪除 ${res.data.deleted} 個檔案`;
+   } else {
+     toolStore.result = "錯誤: " + (res.error || "未知");
+   }
+ }
```

### 7.4 修改 TaggerModalTools.svelte

```diff
- import { ..., emptyTrash } from "./actions.js";
+ import { ..., clearThumbnailCache } from "./actions.js";

- <button class="btn btn-destructive" onclick={emptyTrash}>
-   <IconTrashX size={16} />
-   清空垃圾桶
- </button>
+ <button class="btn btn-destructive" onclick={clearThumbnailCache}>
+   <IconTrashX size={16} />
+   清空快取
+ </button>
```

---

## 八、修改清單一覽

| # | 檔案 | 操作 | 說明 |
|---|------|------|------|
| 1 | `package.json` | 修改 | `npm install sharp` |
| 2 | `src/lib/server/thumbnail.ts` | **新增** | sharp 操作模組（縮圖產生、尺寸讀取、快取清理） |
| 3 | `src/routes/img/[area]/[file]/+server.ts` | 修改 | 加入 `?thumb` 縮圖模式 |
| 4 | `src/routes/api/staged/[filename]/+server.ts` | 修改 | 用 `getImageSize()` 取代前端寬高 |
| 5 | `src/routes/tagger/actions.ts` | 修改 | 移除 `imageDimensions`；`emptyTrash` → `clearThumbnailCache` |
| 6 | `src/routes/tagger/helpers.ts` | 修改 | 刪除 `imageDimensions`（不再需要） |
| 7 | `src/routes/tagger/TaggerModalTools.svelte` | 修改 | 清空垃圾桶 → 清空快取 |
| 8 | `src/routes/api/maintenance/cache/+server.ts` | **新增** | `DELETE /api/maintenance/cache` |
| 9 | `src/routes/tagger/TaggerSidebar.svelte` | 修改 | 縮圖 URL 加 `?thumb` |
| 10 | `src/routes/scroll/+page.svelte` | 修改 | 縮圖 URL 加 `?thumb` |
| 11 | `src/routes/trash/TrashSearch.svelte` | 修改 | 縮圖 URL 加 `?thumb` |
| 12 | `.gitignore` | 修改 | 確認 `.cache` 已被忽略 |

---

## 九、快取生命週期管理

### 產生時機
- **惰性產生**：縮圖僅在首次被請求 `?thumb` 時產生，不做預生成。
- **自動初始化**：`getThumbnail` 自動建立 `.cache/<area>/` 目錄。

### 失效策略
- **手動清空**：Tagger 工具 Modal 的「清空快取」，呼叫 `clearCache()` 遞迴刪除整個 `.cache` 目錄。
- **不做自動清理**：無 TTL、無 LRU。理由是縮圖為純衍生物，隨時可重建，手動清理足夠。

### committed 圖片的快取安全
- committed 圖片的 id 是隨機 hex，與檔案一一對應，不會被修改（只會被刪除），因此快取不會過期。
- 若圖片從 committed 被移到 trash（或反向），也不影響每個 area 各自的快取。

### staged / trash 圖片的快取安全
- staged 和 trash 使用原始檔名。新的同名檔案上傳時，由 `uniqueFilename` 保證不會覆蓋，所以快取名稱不會發生碰撞。

---

## 十、效能影響評估

| 場景 | 現狀 | 引入 sharp 後 |
|------|------|----------------|
| Tagger 側欄（~50 張縮圖可見） | 每張請求原始檔（可能數 MB） | 首次：產生 WebP 縮圖；後續：直接讀快取（~20-80KB） |
| Scroll 瀑布流（100+ 張可見） | 每張請求原始檔 | 同上，最大效益場景 |
| Trash 卡片列表 | 每張請求原始檔 | 同上 |
| Tagger commit | 前端 `new Image()` 測量 + 傳寬高 | 後端 `sharp.metadata()`，更快且更可靠 |
| Browse player | 原始檔（全尺寸） | 不變（不使用縮圖） |
| Compare 對比 | 原始檔（全尺寸） | 不變 |

**預期改善**：
- 縮圖列表場景的網路傳輸量可降低 **90%+**（數 MB → 數十 KB）。
- 瀏覽器解碼壓力大幅降低。
- Commit 更可靠（不再依賴前端 Image 物件解碼）。

---

## 十一、面積公式穩定性證明

要求：`thumbnailSize(w, h)` 對任意 (w, h) 帶入，永遠產生相同的 (w', h')，且 w'/h' = w/h 精確成立。

**ratio 精確性證明**：

設 $g = \gcd(w, h)$，$b_w = w/g$，$b_h = h/g$，輸出為 $(k \cdot b_w, k \cdot b_h)$。

$$
\frac{w'}{h'} = \frac{k \cdot b_w}{k \cdot b_h} = \frac{b_w}{b_h} = \frac{w/g}{h/g} = \frac{w}{h}
$$

這是整數運算的恆等式，不涉及浮點近似——ratio 是**數學精確**的。

**穩定性保證**：
1. `gcd(w, h)` 是確定性整數演算法（輾轉相除），相同輸入永遠相同輸出。
2. `baseArea = bw * bh` 是整數乘法，精確。
3. `k` 的計算：`Math.floor(Math.sqrt(...))` 可能有浮點誤差，但隨後的 `while ((k+1)*(k+1)*baseArea <= MAX_PIXELS)` 修正迴圈使用**純整數乘法比較**，確保 `k` 值精確。
4. 最終輸出 `bw * k`、`bh * k` 是整數乘法，精確。

**Edge case fallback 說明**：
- 若 GCD 公式算出的面積 $> 1.5 \times \text{MAX\_PIXELS}$（通常發生在 $\gcd(w,h)$ 極小的 coprime 尺寸），自動 fallback 到傳統 `floor(w * ratio)` 近似作法。此時 ratio 不精確，但面積受控、函式仍為純函式。
- 實務上主流相機/螢幕解析度的 gcd 都夠大（如 1920×1080→120, 4032×3024→1008），fallback 極少觸發。
