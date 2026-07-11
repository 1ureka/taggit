# 後端測試指引：基於 Vite SSR 的輕量自動化測試

本專案的後端邏輯（`src/lib/` 下不依賴瀏覽器 / Svelte 的模組）**不引入 Vitest / Jest 等測試框架**，改用專案既有的 **Vite** 當「模組載入器」：以 `createServer(...).ssrLoadModule()` 直接載入 TypeScript 原始碼，在同一支 Node 進程內完成載入、執行、斷言、清理。所有測試放在 `test/`。

選這條路徑而非裝測試框架，原因是：

- `ssrLoadModule` 用的是與正式 build 相同的解析器與轉譯管線，載入到的模組行為即上線行為。
- Vite 本來就在 `devDependencies`，不增加依賴面。
- 後端模組邊界仍在演進，用輕量 suite 比固化成框架結構更容易跟著改。

> 純型別正確與否用 `npm run check`（svelte-check）即可，不必跑這裡的測試。

## 執行測試

```bash
# 全部 suite
node ./test/run.mjs

# 只跑名稱含關鍵字的 suite（子字串比對，例如 hidden / bitmap）
node ./test/run.mjs hidden
```

exit code：全通過 `0`、有任何失敗 `1`（可配合 CI）。

## 目錄結構

```
test/
  run.mjs              進入點：起載入器、建 fixtures、依序跑 suite、彙總、process.exit
  core/                與領域無關的底座，任何後端模組都共用
    loader.mjs           Vite 模組載入器（load / tmpRoot）、console 靜音、dispose
    assert.mjs           斷言器 createAsserter（t.eq/ok/throws/notThrows）與 say
  poc/                 一個「領域」＝一組相關後端模組 + 它的 fixtures + suites
    fixtures.mjs         載入 poc 模組、提供 db 隔離工具（freshDb/seedFile/putImage）
    database/*.suite.mjs 依模組分層擺放的 suite
    query/*.suite.mjs
    mutation/*.suite.mjs
    scenario/*.suite.mjs 跨模組的情境測試（例如 hidden 標籤語義）
```

三個層次各司其職：

- **core**：不認識任何領域，只給「載入原始碼」「斷言」「暫存隔離」三件事。
- **領域（domain）**：一組相關後端模組（目前只有 `poc`）。每個領域有一支 `fixtures.mjs`，
  用 core 的 `load` 載入該領域模組、回傳測試需要的工具物件（慣例命名為 `h`）。
- **suite**：實際的斷言集合，一支 `*.suite.mjs`，只認 `(t, h)` 兩個參數。

## suite 的形狀

每支 suite 預設匯出 `{ name, run(t, h) }`：

```js
// test/poc/database/example.suite.mjs
export const name = "example (簡短說明測什麼)";

export async function run(t, h) {
  const { Database } = h.modules;   // h 由所屬領域的 fixtures 提供
  const db = h.freshDb();           // 每個案例拿一個隔離的空 db

  t.ok("剛載入時是空的", db.getImageCount() === 0);
  t.eq("加一筆後計數為 1", /* got */ 1, /* want */ 1);
}

export default { name, run };
```

- `t` 來自 `core/assert.mjs`：`t.eq(label, got, want)`（JSON 深比較）、`t.ok(label, cond)`、
  `t.throws(label, fn)`、`t.notThrows(label, fn)`。
- `h` 是所屬領域 `fixtures.mjs` 的回傳物件；poc 領域提供 `modules`、`freshDb`、`seedFile`、
  `putImage`、`newDbPath`（見 [`test/poc/fixtures.mjs`](test/poc/fixtures.mjs)）。

## 撰寫慣例

- **每條斷言的 label 要能單獨說明「測什麼」**。`FAIL` 時只會印出該 label 加 `got` / `want`，
  label 寫清楚才不必回頭翻程式碼。
- **深比較走 `t.eq`，比物件陣列先投影成純量**（如 `.map(i => i.id)`）再比對；直接 `.join()`
  物件陣列只會得到 `[object Object]`。
- **會落地檔案的模組一律用暫存目錄隔離。** 走領域 fixtures 提供的工具（poc 用 `freshDb` /
  `seedFile`，路徑都在 `loader.tmpRoot` 底下），`dispose()` 時一次清乾淨，**不得指向專案內或
  真實的 `db.json`**。
- **一個案例一個 `{ ... }` 區塊**，各自造 fixture、互不共用可變狀態，順序無關才好定位失敗。

## 加東西時

- **加一條斷言 / 一個案例**：找到對應 suite，往 `run(t, h)` 裡加。
- **加一支 suite**：在對應領域資料夾新增 `*.suite.mjs`（`export default { name, run }`），
  到 [`test/run.mjs`](test/run.mjs) `import` 後登記進該領域的 `suites` 陣列。
- **加一個新後端領域**（例如日後要測 `collection/` 或 `image/`）：
  1. 新增 `test/<domain>/fixtures.mjs`，輸出一個 `create<Domain>Fixtures(loader)`，
     用 `loader.load(...)` 載入該領域模組、回傳自己的工具物件。
  2. 在該資料夾下依模組分層擺 suite。
  3. 到 `test/run.mjs` 的 `DOMAINS` 陣列加一筆 `{ name, setup, suites }`。

  所有領域共用同一台 Vite 載入器與同一個暫存根目錄，互不干擾。

## 已知限制與必守事項

1. **測試檔必須放在專案內。** `node` 解析 `import "vite"` 是從檔案所在目錄往上找 `node_modules`，
   放到專案外會拋 `ERR_MODULE_NOT_FOUND: Cannot find package 'vite'`。
2. **`configFile: false` 不會自動套 alias。** 需要的 alias（目前僅 `$lib`）已列在
   `core/loader.mjs` 的 `resolve.alias`；若某模組用到別的 alias，往那裡補。
3. **`ssrLoadModule` 的路徑以 `/` 開頭、相對專案根目錄**，且指向 `.ts` 原始碼本身
   （如 `/src/lib/poc/query/index.ts`），不是 build 產物路徑。
4. **進入點結尾必須顯式 `process.exit()`。** `Database.markDirty()` 會排一個 500ms 防抖
   `setTimeout` 觸發 `flush()`，會吊住 event loop 讓進程不自然退出。`run.mjs` 在 `dispose()`
   後以 exit code 表達成敗並 `process.exit()`，才能配合 CI。
5. **`console.*` 已被靜音。** 測試報表一律用 `say()`（`core/assert.mjs`）直送 stdout，別改用
   `console.log`，否則會被吞掉。

## 需要一次性驗證，還不想寫成 suite？

臨時想確認某段邏輯時，可在專案內開一支一次性 `.mjs`，用 `test/core/` 的兩個工具拼出來：

```js
// _smoke.mjs —— 跑完即刪
import { createLoader } from "./test/core/loader.mjs";
import { createAsserter, say } from "./test/core/assert.mjs";

const loader = await createLoader();
const { t, state } = createAsserter();
try {
  const { Database } = await loader.load("/src/lib/poc/database/index.ts");
  Database.ensureLoaded(loader.tmpRoot + "/smoke.json");
  t.ok("載入成功", Database.isLoaded());
} finally {
  await loader.dispose();
  say(`\n=== ${state.pass} passed, ${state.fail} failed ===`);
  process.exit(state.fail > 0 ? 1 : 0);
}
```

跑 `node ./_smoke.mjs`，確認後刪掉。若這段邏輯值得長期守住，就別刪——把它整理成一支
`*.suite.mjs` 放進對應領域，按上面「加一支 suite」登記即可。
