# 4. image 模組測試規劃

> 為 `src/lib/image/` 補上後端測試，比照既有 `test/repo` 領域的做法（`loader` + `fixtures` + `suite`），不引入 Vitest/Jest，也不在 repo 裡簽入圖片二進位檔——測試用圖全部由 `sharp` 在執行當下合成。

## 目標

- 新增 `test/image/` 領域，登記進 [test/run.mjs](../test/run.mjs) 的 `DOMAINS`（該檔案第 32 行的註解本來就預留了這個擴充點）。
- 覆蓋三種邏輯：純函式（零 I/O）、fs 相關邏輯（穿越檢查、生命週期）、sharp pipeline（縮圖／metadata／blurhash）。
- 不新增任何 npm 依賴，不簽入任何圖片素材檔案。
- 只測公開行為，不為了測試方便而 export 原本刻意私有的函式（見下方「決策 1」）。

## 現況

- 測試架構見 [TESTING.md](../TESTING.md)：`test/core/loader.mjs` 用 Vite 的 `ssrLoadModule` 直接載入 TS 原始碼，`test/core/assert.mjs` 提供 `t.eq/ok/throws/notThrows`，每個領域一支 `fixtures.mjs` + 多支 `*.suite.mjs`。
- 目前唯一領域是 `repo`（database/query/mutation），`image` 目前零覆蓋。
- image 模組剛完成扁平化重寫（[3-image-library-rewrite.md](3-image-library-rewrite.md)），驗收條件明確要求「搬移不改演算法」——這正是最需要測試鎖住回歸的部分。
- 各檔案可測性盤點：

| 檔案 | 性質 | 測法 |
|---|---|---|
| `resources.ts`（`LRUCache`/`TaskPool`） | 純記憶體，零 I/O | 直接單元測 |
| `formats.ts` | 純函式 | 直接單元測 |
| `result.ts` | 純工廠函式 | 順帶覆蓋，不必獨立 suite |
| `blurhash.ts`（`blurhashStyle`） | 純函式（字串輸入輸出） | 直接單元測，不需真實 blurhash 也可（假字串即可） |
| `client.ts`（`imgSrc`） | 純字串組裝 | 順帶覆蓋 |
| `metadata.ts`（`generateMetadata`/`readImageInfo`） | 需要真實可解碼的圖檔（sharp） | 用合成圖 + `tmpRoot` |
| `processor.ts`（`ImageProcessor`） | 內部私有的 `gcd`/`thumbnailSize` 是純函式；`get()`/`process()` 需要真實圖檔 | 私有函式不 export，透過 `get()` 的輸出間接驗證；`get()` 本身用合成圖 |
| `server.ts`（`ImageLibrary`） | 單例 + fs（穿越檢查、生命週期） | 用 `tmpRoot` 下的獨立子目錄 + 合成圖 |

## 檔案結構規劃

```
test/image/
  fixtures.mjs           載入 image 模組、提供合成圖工具與隔離目錄
  resources.suite.mjs    LRUCache / TaskPool
  formats.suite.mjs      IMG_EXTS / isImageFile / isValidSize / mimeTypeOf
  blurhash.suite.mjs     blurhashStyle（含 contain fit 的 SVG 邊界情況）
  metadata.suite.mjs     generateMetadata / readImageInfo
  processor.suite.mjs    ImageProcessor.get()（含 thumbnailSize 間接驗證、animated、快取、in-flight dedupe）
  server.suite.mjs       ImageLibrary：ensureActive / resolve / has / list / probe / payload / clear / stats
```

`test/run.mjs` 新增一筆：

```js
const DOMAINS = [
  { name: "repo", setup: createRepoFixtures, suites: [...] },
  { name: "image", setup: createImageFixtures, suites: [resources, formats, blurhash, metadata, processor, server] },
];
```

## `fixtures.mjs` 設計

比照 `test/repo/fixtures.mjs` 用 `newDbPath()` 讓每個測試案例取得獨立路徑（達成隔離）的手法：

```js
export async function createImageFixtures(loader) {
  const { load, tmpRoot } = loader;
  const modules = { ...(await load("/src/lib/image/server.ts")), ...(await load("/src/lib/image/formats.ts")), ... };

  let counter = 0;
  const newImagesDir = () => {
    const dir = path.join(tmpRoot, `image-dir-${counter++}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  };

  /** 合成一張純色 PNG，寫入 dir，回傳檔名。 */
  const putImage = async (dir, name, { width = 100, height = 100, background = { r: 200, g: 100, b: 50 } } = {}) => {
    const buf = await sharp({ create: { width, height, channels: 3, background } }).png().toBuffer();
    fs.writeFileSync(path.join(dir, name), buf);
    return name;
  };

  /** 合成一個多幀 GIF（測 animated 分支），frames 為背景色陣列。 */
  const putAnimated = async (dir, name, frames = [{ r: 255, g: 0, b: 0 }, { r: 0, g: 255, b: 0 }, { r: 0, g: 0, b: 255 }]) => {
    const pages = await Promise.all(
      frames.map((background) => sharp({ create: { width: 50, height: 50, channels: 3, background } }).png().toBuffer()),
    );
    const buf = await sharp(pages, { join: { animated: true, across: 1 } }).gif().toBuffer();
    fs.writeFileSync(path.join(dir, name), buf);
    return name;
  };

  return { modules, newImagesDir, putImage, putAnimated };
}
```

- 圖片尺寸刻意選小（50–100px），減少 sharp 原生轉檔的測試耗時。
- 在正式寫進 `fixtures.mjs` 前，先用 `TESTING.md`「一次性驗證」一節的 `_smoke.mjs` 手法跑一次 `join({ animated: true })`，確認 sharp 0.34.5 這個 API 行為符合預期（多幀確實保留、`ImageProcessor.get(..., animated: true)` 能吃到多幀輸出），再正式寫入 suite。

## 各 suite 打算測什麼

### `resources.suite.mjs`
- `LRUCache`：基本 set/get、超過 `maxBytes` 觸發淘汰、淘汰的是最舊未存取項目、覆寫同 key 時先扣除舊 byteSize 再累加、`clear()` 歸零、`stats()` 數字正確。
- `TaskPool`：未達 concurrency 時立即執行、超過時排隊、任務完成後 `drain()` 啟動下一個、任務 reject 不會卡住 pool（下一個仍會執行）。用手動控制 resolve 時機的 Promise 來精確斷言執行順序。

### `formats.suite.mjs`
- 各副檔名（含大小寫）是否判定為圖片檔；`isValidSize` 對合法/不合法值的判斷；`mimeTypeOf` 對應副檔名的 MIME type。

### `blurhash.suite.mjs`
- 給定假 blurhash 字串，輸出的 CSS/data-uri 格式正確；`fit: "contain"` 的 SVG wrapper 在極端長寬比下的邊界情況。

### `metadata.suite.mjs`
- `generateMetadata`：合成圖 → `width`/`height` 符合預期、`blurhash` 為非空字串；餵一個非圖片內容的檔案（如純文字檔）→ 回傳 `{width:0, height:0, blurhash:""}` 而不丟例外（吞錯誤語意）。
- `readImageInfo`：正常檔案時 `fileSize`/`width`/`height`/`blurhash` 都正確；檔案不存在時 `fs.statSync` 應該丟例外（`t.throws`），這是刻意不吞錯誤的行為，要測到。

### `processor.suite.mjs`
- `get()` 輸出的 buffer 可以被 sharp 再次解碼，且 `width*height` 不超過對應 size 的 `maxPixels`（`sm`=512×512, `md`=1024×1024）——這是**間接驗證 `thumbnailSize` 正確性**的方式，不直接呼叫私有函式。
- 針對幾種寬高組合各跑一次（整除、互質、原始尺寸已小於 maxPixels 免縮放、極端長寬比觸發 fallback 分支），確認每種都落在預期的 bound 內。
- 快取命中：連續呼叫兩次 `get()` 用同一組參數，第二次應直接命中快取（可用 `stats().entries` 不變化 + 呼叫耗時明顯變短來間接驗證，避免依賴內部實作細節）。
- `animated: true` 時，輸出的 webp 用 sharp 讀回應為多幀（`metadata().pages > 1`）。
- `clear()`/`stats()` 正確反映快取狀態。

### `server.suite.mjs`
- `ensureActive`：首次呼叫綁定 dir；同一個 dir 重複呼叫不清快取（先塞一筆快取，再呼叫同 dir，快取仍在）；換成新 dir 呼叫則快取被清空（`stats().entries === 0`）。
- `resolve`/`has`：合法檔名 → ok；`../` 穿越或絕對路徑逃出 base → forbidden；不存在的檔名 → notFound。
- `list()`：回傳依自然排序的圖片副檔名清單，非圖片檔案被過濾掉。
- `probe()`：委派 `resolve` + `readImageInfo`，不存在時回傳 notFound（而不是丟例外）。
- `payload()`：`xl` → stream + 正確 `contentType`/`length`；`sm`/`md` → webp buffer；不存在/穿越 → 對應的 Result 錯誤變體。
- `clear()`/`stats()`：不需要 `ensureActive` 也能安全呼叫（dir 無關，對應 rewrite plan 裡特別強調的這個決策）。

## 需要決策

1. **`gcd`/`thumbnailSize` 要不要 export 出來直接單元測？**
   建議：**不 export**，理由是找到既有先例——`database/bitmap.ts` 的 `popcount32` 就是同樣情況的私有輔助函式，[bitmap.suite.mjs](../test/repo/database/bitmap.suite.mjs) 只透過公開的 `BitSet` API 間接驗證，並未為了測試方便而 export。`processor.suite.mjs` 比照這個慣例，用 `get()` 的輸出尺寸間接驗證 `thumbnailSize` 的正確性。
2. **`ImageLibrary` 是 `globalThis` 單例，跨 suite 共用狀態——`isActive()` 的「尚未啟用」初始狀態很難重複測到**（一旦任何 suite 呼叫過 `ensureActive`，之後同一個 test process 內永遠是 active）。
   建議：接受這個限制，不特別測「冷啟動未 active」的情境（這與現有 `Database.isLoaded()` 在 repo 領域測試裡的處理方式一致，`repo` fixtures 也沒有測「未 `ensureLoaded`」的狀態）。真正的冷啟動行為（503）留給既有的手動/整合測試把關。
3. **in-flight dedupe（同時對同一檔案發兩次 `get()` 只實際轉檔一次）要測到什麼精確度？**
   建議：只驗證「兩個同時發出的 `get()` promise resolve 成同一個 buffer」這個可觀察行為，不深入斷言 `process()` 實際被呼叫的次數（那需要 spy sharp 呼叫，超出目前測試框架的簡單斷言能力範圍）。

## 風險 / 注意

- `ImageLibrary`/`ImageProcessor` 的快取是跨呼叫共用的 `globalThis` 單例，每個測試案例都必須呼叫 `ensureActive(newImagesDir())` 綁到自己獨立的子目錄，才能保證快取不互相污染（比照 `repo` 領域用 `newDbPath()` 讓 `Database.ensureLoaded` 各自隔離的模式）。
- sharp 是原生綁定，合成圖 + 多次 resize/webp 轉檔會比純 JS 測試慢；圖片尺寸刻意壓小（50–100px）以控制整體測試耗時，避免拖慢 `node ./test/run.mjs` 的整體執行時間。
- `sharp` 的 `join({ animated: true })` API 行為在寫入正式 suite 前，先用 `_smoke.mjs` 跑一次確認（`TESTING.md` 的「一次性驗證」流程），避免把未驗證過的假設直接寫進正式測試導致誤判。
- `metadata.generateMetadata` 對錯誤的吞錯語意（回傳零值而非丟例外）跟 `readImageInfo` 對檔案不存在的丟例外語意不同，兩者都要各自測到，避免未來重構時混淆這兩種錯誤處理方式。

## 驗收

- `test/image/` 建立，`test/run.mjs` 的 `DOMAINS` 新增一筆 `image`。
- `node ./test/run.mjs image` 全數通過。
- `node ./test/run.mjs`（不帶 filter）跑全部領域也全數通過，且整體執行時間沒有因為新增的 sharp 測試而明顯拉長。
- 不新增 `package.json` 的任何依賴，不簽入任何圖片二進位檔案到 repo。
- 覆蓋範圍：`LRUCache`/`TaskPool` 的邊界行為、縮圖尺寸計算（透過 `get()` 間接驗證）、`animated` 分支、快取行為、`formats`/`blurhash` 純函式、`metadata` 的兩種錯誤處理語意（吞錯 vs 丟例外）、`server.ts` 的路徑穿越檢查與 `ensureActive` 生命週期（切換 dir 清快取）。
