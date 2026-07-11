# ImageLibrary：image 模組扁平化重寫

> 以 `database` / `query` / `mutation` 的封裝精神重寫 `image` 模組：server 入口收斂成一個 `ImageLibrary` class，把散在各 route 的「路徑解析／穿越檢查／xl 分支／切換清快取」全部收進模組；檔案結構扁平化，去掉 `internal/` 子資料夾。

## 目標

把 image 模組從「一袋鬆散函式（`import * as image`）」重塑為與 `Database` 對等的**橋樑型單例**：

- **`ImageLibrary` : `<root>/images/*` ⟺ `Database` : `<root>/db.json`**。兩者都是「程式 ↔ 該 collection 某份磁碟資料」的橋樑，都持有由該資料衍生的重狀態（`Database` 是索引、`ImageLibrary` 是縮圖快取），切換 collection 時都要重建／清空。
- server 入口 = **一個 class**（`ImageLibrary`），採 `Database` 式的**有狀態單例**生命週期（`ensureActive` / `isActive`，globalThis 護體、HMR-safe）。
- client 入口不變（`imgSrc` / `blurhashStyle` 維持 free function）。
- 檔案結構**扁平**，無 `internal/`、無 `index.ts`；對外入口只有 `server.ts` 與 `client.ts` 兩個。

## 動機（現況的漏抽象）

**1. 切換 collection 的清快取邏輯漏到 route。** 對照 [api/settings/setup/+server.ts:46-51](../src/routes/api/settings/setup/+server.ts#L46-L51)：

```ts
const isSwitching = Collection.getActiveRoot() !== root;
Collection.setActiveRoot(root);
Database.ensureLoaded(Collection.paths(root).db);   // db 側：「路徑變了才重載」封裝在內部
if (isSwitching) clearCache();                        // image 側：route 得自己算 isSwitching、自己清快取 ← 漏出來
```

`Database.ensureLoaded` 把「切換偵測 + 重建」藏在內部，image 側卻逼 route 手動處理。重寫後兩者對稱：

```ts
Collection.setActiveRoot(root);
Database.ensureLoaded(Collection.paths(root).db);
ImageLibrary.ensureActive(Collection.paths(root).images);   // 「dir 變了就清快取」封裝在內部，isSwitching 消失
```

**2. 取圖的組裝工作漏到 route。** [api/images/[filename]/+server.ts](../src/routes/api/images/[filename]/+server.ts) 有 ~50 行在做 `path.resolve` + 穿越檢查 + `existsSync` + `mimeTypeOf` + `statSync` + xl/thumbnail 分支 —— 全是 image 領域邏輯，卻住在 route。

**3. 沒有內聚的門面。** 現在是 `import * as image`（[server.ts](../src/lib/image/server.ts) 一堆 free function），對比 `new Query(db)` / `Database.xxx()` 的內聚感完全不同。

## 檔案結構（扁平，8 檔，零子資料夾、零 index）

```
src/lib/image/
  server.ts       # class ImageLibrary                       ← server 入口
  client.ts       # imgSrc + blurhashStyle（free function）  ← client 入口
  processor.ts    # class ImageProcessor（快取 + 池 + resize；ImageLibrary 內部持有）
  metadata.ts     # probe：readImageInfo / generateMetadata → FileInfo
  formats.ts      # ImageSize / IMG_EXTS / MIME_TYPES / isValidSize（等距，兩端共用）
  blurhash.ts     # blurhashStyle 實作（client 用）
  resources.ts    # LRUCache / TaskPool（processor 用的通用原語）
  result.ts       # Result / ok / notFound / forbidden（server 用的錯誤模型）
```

對應現況搬遷：`internal/thumbnail.ts` → `processor.ts`（升格為 class）、`internal/metadata.ts` → `metadata.ts`、`internal/formats.ts` → `formats.ts`、`internal/blurhash.ts` → `blurhash.ts`、`internal/resources.ts` → `resources.ts`。全部抬升一層、刪掉 `internal/`。

> **邊界的取捨（誠實說明）**：扁平化後，「外部只能 import server/client」從「`internal/` 資料夾半強制」退化成**純註解約定**（每個非入口檔的 `@file` docblock 註明「模組內部檔，經 server.ts / client.ts 取用」）。這是扁平的代價。若日後想補強，可用 eslint `no-restricted-imports` 擋掉外部對非入口檔的 import，用工具取代資料夾語意。`formats.ts` 雖被 client/server 兩端 import，但它是**內部檔**不是入口，兩入口對外的規則不變。

---

## 逐檔藍圖

### `server.ts` — `class ImageLibrary`（server 入口）

`Database` 式有狀態單例：globalThis 實例持有 `dir` + 一個 `ImageProcessor`（快取）。就像 `Database` 實例內部持有 `FacetIndex` / `OrdinalRegistry`——**內部委派給 `ImageProcessor` 只是檔案分解，不改變「模組對外就是那個持有快取的重狀態單例」的事實**。

生命週期詞彙直接對映 `Database`（見 [store.ts:27-57](../src/lib/database/store.ts#L27-L57)）：

| Database | ImageLibrary | 語義 |
|---|---|---|
| `singleton()`（`globalThis.__db`, HMR） | `singleton()`（`globalThis.__imageLibrary`, HMR） | 行程單例護體 |
| `ensureLoaded(dbPath)` | `ensureActive(imagesDir)` | 綁定 dir；**dir 變了 → 清空快取**（＝重載＋重建索引的類比） |
| `isLoaded()` | `isActive()` | route 前置守衛（未就緒 → 503） |
| `requireLoaded()`（拿不到就 throw） | 私有 `require()`（方法內部假設已就緒，未就緒 = route 有 bug → throw） | 方法假設前置守衛已通過 |
| `clearCache` / `getCacheStats` | `clear()` / `stats()` | 快取維運 |

```ts
declare global {
  /** HMR 保護：熱重載之間重用實例。 */
  var __imageLibrary: ImageLibrary | undefined;
}

export class ImageLibrary {
  /** 當前綁定的 images 目錄；null = 尚未 ensureActive。 */
  private dir: string | null = null;
  /** 縮圖快取＋池，模組對外的重狀態，實際機制委派給 ImageProcessor。 */
  private processor = new ImageProcessor(MAX_CACHE_BYTES, MAX_CONCURRENT);

  private static singleton(): ImageLibrary { /* globalThis.__imageLibrary ??= new ... */ }

  // ── 生命週期（只在 layout + setup 呼叫，對稱 Database.ensureLoaded 的呼叫點）──
  static ensureActive(imagesDir: string): void {
    const self = ImageLibrary.singleton();
    if (self.dir !== imagesDir) {   // 切換偵測封裝在內部
      self.dir = imagesDir;
      self.processor.clear();       // 對稱 Database.load() 的重建索引
    }
  }
  static isActive(): boolean { return ImageLibrary.singleton().dir !== null; }
  /** 拿到已綁定的 dir；未綁定 = route 少了 isActive() 守衛 → throw 到框架邊界。 */
  private static requireDir(): string { /* 見 Database.requireLoaded 的哲學 */ }

  // ── 需要 active 的方法（走 requireDir）──
  static list(): string[]                                              // 原 listImageFiles
  static has(file: string): boolean                                    // = resolve(file).ok
  static resolve(file: string): Result<string, NotFound | Forbidden>   // 拼接＋穿越檢查＋existsSync
  static probe(file: string): Promise<Result<FileInfo, NotFound | Forbidden>>   // 原 readImageInfo
  static payload(file: string, size: ImageSize, animated: boolean):
    Promise<Result<ImagePayload, NotFound | Forbidden>>

  // ── 不需要 active 的純／快取方法 ──
  static isImageFile(file: string): boolean          // 委派 formats，純函式
  static isValidSize(v: unknown): v is ImageSize      // 委派 formats，純函式
  static clear(): number                              // processor 清快取，dir 無關
  static stats(): { entries: number; bytes: number }  // processor 統計，dir 無關
}
```

**`resolve()`**（收攏原 [api/images:31-38](../src/routes/api/images/[filename]/+server.ts#L31-L38) 的安全邏輯）：

```ts
const base = this.requireDir();
const full = path.resolve(base, file);
if (full !== path.resolve(base) && !full.startsWith(path.resolve(base) + path.sep)) return forbidden();
if (!fs.existsSync(full)) return notFound();
return ok(full);
```

**`payload()`** 內部自理 xl vs thumbnail（收攏原 [api/images:52-65](../src/routes/api/images/[filename]/+server.ts#L52-L65)）：

```ts
const r = this.resolve(file); if (!r.ok) return r;
if (size === "xl") {
  return ok({ kind: "stream",
    body: Readable.toWeb(fs.createReadStream(r.data)),
    contentType: mimeTypeOf(file),          // mimeTypeOf 降為 formats 內部函式
    length: fs.statSync(r.data).size });
}
const buffer = await this.processor.get(file, r.data, size, animated);
return ok({ kind: "buffer", body: new Uint8Array(buffer), contentType: "image/webp" });
```

> **dir 相依性一覽**：`list / has / resolve / probe / payload` 需要 active（走 `requireDir`）。`isImageFile / isValidSize / clear / stats` 與 dir 無關（`stats`/`clear` 只碰 processor 快取，可在 settings 頁未 activate 時安全呼叫，維持現況行為）。

### `processor.ts` — `class ImageProcessor`（內部）

由 `internal/thumbnail.ts` 的 module-level `const cache / pool / inflight` 升格為 class，狀態收進實例（不再是檔案級全域），由 `ImageLibrary` 單例持有一個。演算法（`gcd` / `thumbnailSize` / `SIZE_PRESETS` / animated 處理）原樣搬移。

```ts
export class ImageProcessor {
  private cache: LRUCache;
  private pool: TaskPool;
  private inflight = new Map<string, Promise<Buffer>>();
  constructor(maxBytes: number, concurrency: number) { /* new LRUCache / TaskPool */ }

  get(file, sourcePath, size: ProcessableSize, animated): Promise<Buffer>   // 原 getImageBuffer
  clear(): number      // 原 clearCache
  stats(): { entries; bytes }   // 原 getCacheStats
}
```

> 快取鍵維持 `${size}:${animated?'a':'s'}:${file}`。因為 `ImageLibrary.ensureActive` 在切換 collection 時會整個 `processor.clear()`，跨 collection 同名檔的殘留問題自然消失（現況靠 route 手動 `clearCache` 達成，現在封裝進生命週期）。

### `metadata.ts` — probe

`readImageInfo` / `generateMetadata` / `FileInfo` 原樣搬移（[internal/metadata.ts](../src/lib/image/internal/metadata.ts)）。`ImageLibrary.probe(file)` 是它的 Result 包裝：檔案不存在 → `notFound()`，可讀但 sharp 取不到尺寸 → `ok` 但 `width/height=0`（沿用現有寬容語義）。

> `FileInfo` 與 [mutation/commands.ts:8-13](../src/lib/mutation/commands.ts#L8-L13) 的 `FileInfo` 維持「結構相容、無 import 依賴」的既有刻意解耦，本次不動。

### `formats.ts` / `blurhash.ts` / `resources.ts`

原樣搬移（去掉 `internal/` 路徑）。`mimeTypeOf` 收進 `formats.ts` 作為模組內部函式（外部不再直接用，由 `payload` 內部呼叫）。`resources.ts`（`LRUCache` / `TaskPool`）維持通用原語。

### `result.ts` — 錯誤模型（server 用）

比照 [mutation/result.ts](../src/lib/mutation/result.ts) 的純物件可辨識聯集 + 工廠，但只有 image 需要的兩個變體（`no_active` 依決策**不**進 Result，由 `isActive()` 守衛處理）：

```ts
export type NotFound = { kind: "not_found" };
export type Forbidden = { kind: "forbidden" };
export type ImageError = NotFound | Forbidden;
export type Result<T, E = ImageError> = { ok: true; data: T } | { ok: false; error: E };
export const ok, notFound, forbidden;

export type ImagePayload =
  | { kind: "stream"; body: ReadableStream; contentType: string; length: number }   // xl：串流 + Content-Length
  | { kind: "buffer"; body: Uint8Array; contentType: string };                       // sm/md：webp buffer
```

### `client.ts`（幾乎不動）

`imgSrc` / `blurhashStyle` 維持 free function；只改內部 import 路徑（`./internal/formats` → `./formats`、`./internal/blurhash` → `./blurhash`）。URL 契約 `/api/images/{file}?size=&animated=1` 不變（本次不引入 `ImageSource` 值物件，理由：幾乎無重複需求，且入口只保留 server/client 兩個）。

---

## 生命週期整合點

`ImageLibrary.ensureActive(paths.images)` 只加在**現有 `Database.ensureLoaded` 出現的每一處**（維持與 db 對稱、且遵循「只有 layout + setup 做 activate，其餘 route 只守衛」的既有慣例）：

- [+layout.server.ts:38](../src/routes/+layout.server.ts#L38)（`loadOther`，`Database.ensureLoaded` 之後）
- [api/settings/setup/+server.ts:50](../src/routes/api/settings/setup/+server.ts#L50)（同上，並刪除 `isSwitching` + `clearCache`）

其餘 route 比照現有對 `Database.isLoaded()` 的用法：只用 `ImageLibrary.isActive()` 做前置守衛（未就緒 → 503），不自行 activate。

## 呼叫端遷移對照

| 檔案 | 現況 | 重寫後 |
|---|---|---|
| [+layout.server.ts](../src/routes/+layout.server.ts) | `image.listImageFiles(paths.images)`（x2） | `ImageLibrary.ensureActive(paths.images)` → `ImageLibrary.list()` |
| [tagger/+page.server.ts:16](../src/routes/tagger/+page.server.ts#L16) | `listImageFiles(paths.images)` | `ImageLibrary.list()` |
| [api/images/[filename]](../src/routes/api/images/[filename]/+server.ts) | `isValidSize`/`mimeTypeOf`/`getImageBuffer` + 手動 fs/穿越 | `isActive()` 守衛 → `isValidSize` → `payload()`；Result → 404/403 |
| [api/staged/[filename]](../src/routes/api/staged/[filename]/+server.ts) | `isImageFile` + `readImageInfo` + `fs.existsSync` | `ImageLibrary.isImageFile` / `has` / `probe` |
| [api/staged](../src/routes/api/staged/+server.ts#L54) | `isImageFile` | `ImageLibrary.isImageFile` |
| [api/committed:51](../src/routes/api/committed/+server.ts#L51) | `readImageInfo` + `fs.existsSync` | `ImageLibrary.probe` / `has` |
| [api/settings/setup:51](../src/routes/api/settings/setup/+server.ts#L51) | `isSwitching` + `clearCache()` | `ImageLibrary.ensureActive(paths.images)`（清快取內含） |
| [api/settings/cache](../src/routes/api/settings/cache/+server.ts) | `clearCache` / `getCacheStats` | `ImageLibrary.clear()` / `ImageLibrary.stats()` |
| [api/settings/metadata:33](../src/routes/api/settings/metadata/+server.ts#L33) | `generateMetadata(join(dir,id))` | `ImageLibrary.probe(record.id)`（忽略 fileSize，讀 width/height/blurhash） |
| [settings/+page.server.ts:18](../src/routes/settings/+page.server.ts#L18) | `getCacheStats()` | `ImageLibrary.stats()` |
| client 端（home / tagger / editor / compare / player / ImageCanvas） | `imgSrc` / `blurhashStyle` | 不變 |

> api/images 重寫後的 route 骨架：
> ```ts
> if (!ImageLibrary.isActive()) return new Response("尚未載入資料庫", { status: 503 });
> if (!isSafeFilename(filename)) return new Response("無效的檔名", { status: 400 }); // 通用 util，維持 400
> if (!ImageLibrary.isValidSize(sizeParam)) return new Response("無效的尺寸", { status: 400 });
> const r = await ImageLibrary.payload(filename, sizeParam, animated);
> if (!r.ok) return new Response(r.error.kind === "forbidden" ? "Forbidden" : "找不到圖片",
>                                { status: r.error.kind === "forbidden" ? 403 : 404 });
> // 依 r.data.kind 設 headers（Content-Type / Content-Length）後回傳 Response
> ```
> `isSafeFilename`（通用 util，語義為「輸入畸形」→ 400）仍留在 route；`resolve()` 內的穿越檢查是防禦縱深（→ 403）。兩者職責不同，都保留。

## 已定案的小決策

- 「未就緒」用 **`isActive()` 前置守衛 + 方法假設已就緒**（照 `isLoaded()` / `requireLoaded()`），`no_active` **不**做成 Result 變體。
- `ImageProcessor` 是 `ImageLibrary` 單例內部持有的普通 helper，**不**自帶 globalThis 單例。
- 本次**不**引入 `ImageSource` 值物件；URL 契約維持現狀。

## 風險 / 注意

- **HMR**：`globalThis.__imageLibrary` 護體照抄 `__db`；熱重載時實例（含快取）保留，避免每次 HMR 都冷快取。
- **API route 的 active 前提**：`ensureActive` 只在 layout + setup 呼叫，故 API 端點假設 layout 已跑過（與現有 api/committed 假設 `Database.isLoaded()` 已由 layout 完成的慣例一致）。真正冷啟直打 `/api/images` 時 `isActive()` 為 false → 503，與現況 root 為 null 時的 503 行為等價。
- **`stats()` / `clear()` 的 dir 無關性**：settings 頁（`loadSettings` 不 activate）仍能取 `stats()`，因為 processor 在 constructor 就存在；務必讓這兩個方法不走 `requireDir`。
- **搬移不改演算法**：`thumbnailSize` / `gcd` / blurhash 參數 / SIZE_PRESETS / animated 分支一律原樣搬移，只改封裝與 import 路徑，降低回歸風險。

## 驗收

- `import * as image` 全數消失；server 端只透過 `ImageLibrary.*` 使用，client 端 `imgSrc` / `blurhashStyle` 不變。
- `src/lib/image/` 下無 `internal/`、無 `index.ts`，僅 8 個扁平檔；外部檔案只 import `server.ts` / `client.ts`。
- 切換 collection（POST `/api/settings/setup` 換 root）：縮圖快取自動清空，route 內不再有 `isSwitching` / `clearCache` 字樣。
- `GET /api/images/[filename]`：xl 回原圖串流（正確 Content-Type / Content-Length）、sm/md 回 webp；不存在 → 404、穿越嘗試 → 403、未就緒 → 503、壞 size → 400，與現況一致。
- 提交（staged→committed）與匯入（/api/committed）仍能經 `probe` 取得 `FileInfo` 寫入 db；`/api/settings/metadata` 補算 blurhash/尺寸行為不變。
- 既有測試（`test/`）綠燈；`svelte-check` / build 無型別錯誤。
