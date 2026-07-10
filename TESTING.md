# 專案測試指引：基於 Vite SSR 的輕量自動化測試

## 概述

本專案目前**不引入 Vitest / Jest 等測試框架**。驗證邏輯正確性時，一律用專案既有的
**Vite** 作為模組載入器：以 `createServer(...).ssrLoadModule()` 直接載入 `src/lib/poc/`
下的 TypeScript 原始碼（`$lib` alias、`.ts` 副檔名解析、server-only 的 `fs` import 皆與
正式環境一致），在同一支腳本內完成載入、執行、斷言、清理。

選擇這條路徑，而非額外安裝測試框架，原因是：

- `poc/` 目前處於快速迭代期，模組邊界（`database` / `query` / `mutation` / `query-spec`）
  還會調整，過早固化成測試框架的 suite 結構成本較高。
- `ssrLoadModule` 用的是與正式 build 相同的解析器與轉譯管線，載入到的模組行為即上線行為，
  不需要額外維護 mock / transform 設定。
- vite 本來就在 `devDependencies`，不增加依賴面。

等模組邊界穩定下來後，可以評估導入正式測試框架；在那之前，以下方法是本專案驗證邏輯的
標準做法。

## 什麼時候要寫這種腳本

- 修改 `database/`、`query/`、`mutation/` 底下任何檔案後，尤其是牽涉到索引同步
  （`replaceIndex` / `rebuild`）、樂觀併發（`updatedAt` 檢查）、或持久化（`flush` /
  `markDirty`）的變更。
- 新增或調整 `query-spec/` 的值物件解析邏輯（例如 `search-params.ts` 內的 `safeInt` /
  `parseEnum` / `parseTags`）。
- 懷疑某個 PR 影響到單例生命週期（`Database.ensureLoaded` / `requireLoaded`）在
  HMR 或多次載入下的行為。

不適用的情況見文末「什麼時候不用這招」。

## 快速開始

1. 在專案根目錄建立一支一次性腳本，例如 `_smoke.mjs`（檔名不重要，但**必須放在專案內**，
   細節見下方「已知限制」第 1 點）。
2. 貼上「模板」一節的內容，依需求修改載入的模組與斷言。
3. 執行：

   ```bash
   node ./_smoke.mjs
   ```

4. 確認全數通過後，**刪除腳本**（除非要留作回歸測試，見「進階」一節）。

```bash
rm -f ./_smoke.mjs
```

## 模板

```js
// _smoke.mjs —— 一次性驗證腳本；跑完請刪除，或依「進階」一節移入 scripts/
import { createServer } from "vite";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const root = process.cwd();

// Vite 純作「模組載入器」：middlewareMode 不會真的開 port。
const server = await createServer({
  root,
  configFile: false, // 不讀 svelte.config，自己給最小設定
  logLevel: "error",
  resolve: { alias: { $lib: path.join(root, "src/lib") } }, // 對齊本專案的 $lib
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true }, // 跳過 dep 預打包，啟動更快
});

// 極簡斷言器：JSON 深比較，計數 pass/fail。
let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "PASS" : "FAIL"} ${label}` + (ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};

try {
  // ── 載入真正的原始碼（路徑相對 root、以 / 開頭）──
  const { Database } = await server.ssrLoadModule("/src/lib/poc/database/index.ts");
  const { Query } = await server.ssrLoadModule("/src/lib/poc/query/index.ts");
  const { Mutation } = await server.ssrLoadModule("/src/lib/poc/mutation/index.ts");

  // ── 需要碰檔案系統的模組，一律餵 temp 檔，別碰真實資料 ──
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-"));
  Database.ensureLoaded(path.join(tmpDir, "db.json"));
  const db = Database.requireLoaded();
  const query = new Query(db);
  const mutation = new Mutation(db);

  // ── 斷言 ──
  const file = { fileSize: 1, width: 1, height: 1, blurhash: "" };
  const committed = mutation.commitRecord("a.png", { name: "A", tags: ["cat"], rating: 5 }, file);
  eq("commit 成功", committed.ok, true);
  eq("圖片總數為 1", query.getImageCount(), 1);

  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch (e) {
  console.error("THREW:", e);
  fail++;
} finally {
  await server.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0); // 見「已知限制」第 4 點：一定要 exit
}
```

跑法：

```bash
node ./_smoke.mjs

# 應用程式自己的 log() 會夾雜輸出，想安靜可過濾：
node ./_smoke.mjs 2>&1 | grep -vE "^\[|INFO"
```

## 撰寫慣例

- **斷言一律走 `eq(label, got, want)`**，用 `JSON.stringify` 深比較。若要比物件陣列，先投影成純量
  （如 `.map(i => i.id)`）再比對；直接對物件陣列 `.join()` 只會得到 `[object Object]`。
- **每條斷言的 label 要能單獨說明「測什麼」**，`FAIL` 時的 `got` / `want` 輸出才有意義，不需要
  回頭看程式碼才知道斷言在驗證什麼。
- **會落地檔案的模組一律用 `os.tmpdir()` + `fs.mkdtempSync` 開 temp 目錄**餵入，結束後
  `fs.rmSync(tmpDir, { recursive: true, force: true })` 清掉，不得指向專案內或真實的
  `db.json`。
- **純 isomorphic、不含 `$lib` / `fs` / 其他 alias 的模組**（例如 `query-spec/` 內的值物件）
  可以省去 Vite，直接 `node --experimental-strip-types file.ts`，啟動更快。只要有一個 alias
  或 server-only import，就改用 Vite 版模板。

## 已知限制

1. **腳本必須放在專案內。** `node` 解析 `import "vite"` 是從腳本檔所在目錄往上找
   `node_modules`，不是看 cwd。放在系統暫存區之類的專案外路徑會拋出
   `ERR_MODULE_NOT_FOUND: Cannot find package 'vite'`。
2. **`configFile: false` 時不會自動套用 alias。** 需要的 alias（目前僅 `$lib`）要手動列進
   `resolve.alias`；若模組用到其他 alias，一併補上，否則會解析不到對應路徑。
3. **`ssrLoadModule` 的路徑以 `/` 開頭、相對 `root`**，且指向 `.ts` 原始碼本身
   （如 `/src/lib/poc/query/index.ts`），不是 build 產物路徑。
4. **結尾必須顯式呼叫 `process.exit()`。** `Database` 的 `markDirty()` 會排一個
   500ms 防抖 `setTimeout` 觸發 `flush()`，會吊住 event loop、讓 Node 進程不自然退出。
   `server.close()` 之後接 `process.exit(code)`，並用 exit code 表達成敗，才能配合 CI 判斷。
5. **`log()` 輸出會與斷言結果混在一起。** 用 `logLevel: "error"`（或 `"silent"`）壓下 Vite
   自身的訊息，應用程式內的 `log()` 呼叫則用 `grep -v` 過濾。

## 進階：把一次性腳本留作回歸測試

多數情況下腳本驗證完即刪；若某段邏輯值得長期守住（例如一次修過的 bug、一個容易再犯錯的
邊界情況），可以保留下來，做法不變，只需：

- 每條斷言寫清楚**輸入 → 預期**，`FAIL` 時印出 `got` / `want`，不依賴外部上下文就能看懂。
- 保留 `process.exit(fail > 0 ? 1 : 0)`，讓外層（手動執行或 CI）能以 exit code 判定成敗。
- 移到 `scripts/` 之類的固定目錄，並在檔頭註明「測什麼、如何跑」，不留在專案根目錄。

## 什麼時候不用這招

| 情境 | 改用 |
| --- | --- |
| 只需要確認型別是否正確 | `npm run check`（svelte-check），不必跑腳本 |
| 要測 Svelte 元件互動 / 瀏覽器行為 | 這招只驗證到「模組邏輯」層；UI 行為請走 `/run` 或實際起 app 用瀏覽器操作 |
| 邏輯純 isomorphic、無 alias / fs | 直接 `node --experimental-strip-types file.ts`，不需要起 Vite server |

---

需要驗證 `poc/` 內的真實邏輯時，不必為此安裝測試框架 —— Vite 的 `ssrLoadModule` 就是現成、
與正式環境同源的模組載入器；配合本檔的模板與斷言慣例，記得用 temp 目錄隔離資料、結尾
`process.exit`，跑完即刪即可。
