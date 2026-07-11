# 後端測試

`src/lib/` 下不依賴瀏覽器 / Svelte 的模組，測試不使用 Vitest / Jest，而是用專案既有的 Vite 做模組載入：透過 `createServer(...).ssrLoadModule()` 直接載入 TypeScript 原始碼，在同一個 Node 進程內完成載入、執行、斷言、清理。測試檔放在 `test/`。

- `ssrLoadModule` 使用與正式 build 相同的解析與轉譯流程。
- Vite 已經是 `devDependencies` 之一，不需要新增依賴。
- 純型別檢查用 `npm run check`（svelte-check），與這裡的測試無關。

## 執行

```bash
node ./test/run.mjs

# 只跑名稱包含關鍵字的測試（子字串比對）
node ./test/run.mjs hidden
```

全部通過時 exit code 為 `0`，有任何失敗為 `1`。

## 目錄結構

```
test/
  run.mjs              進入點：建立載入器、準備 fixtures、依序執行、彙總結果
  core/
    loader.mjs         模組載入器（load / tmpRoot）、輸出控制、清理
    assert.mjs         斷言函式（eq / ok / throws / notThrows）與輸出函式 say
  <domain>/            一組相關的後端模組，各自有 fixtures 與測試檔
    fixtures.mjs       載入該組模組、提供測試需要的工具與隔離環境
    .../*.suite.mjs    依模組分類擺放的測試檔
```

- `core` 不涉及任何具體模組，只提供載入、斷言、暫存目錄隔離。
- 每一組後端模組（例如資料庫、查詢、mutation 等）各自有一支 `fixtures.mjs`。
- `fixtures.mjs` 用 `core` 的 `load` 載入模組、回傳一個工具物件（慣例命名為 `h`）。
- 測試檔（`*.suite.mjs`）只接受 `(t, h)` 兩個參數，內容是實際的斷言。

## 測試檔格式

每支測試檔預設匯出 `{ name, run(t, h) }`：

```js
export const name = "簡短說明測試內容";

export async function run(t, h) {
  const db = h.freshDb();

  t.ok("初始狀態為空", db.getImageCount() === 0);
  t.eq("加一筆後計數為 1", /* got */ 1, /* want */ 1);
}

export default { name, run };
```

- `t` 提供 `t.eq(label, got, want)`（深比較）、`t.ok(label, cond)`、`t.throws(label, fn)`、`t.notThrows(label, fn)`。
- `h` 是所屬模組群組的 `fixtures.mjs` 回傳的物件，內容依模組而定。

## 撰寫慣例

- 每個斷言的 label 要能單獨說明測的是什麼；失敗時只會印出 label 加 got / want。
- 深比較用 `t.eq`；比較物件陣列前先轉成純量（如 `.map(i => i.id)`），否則會得到 `[object Object]`。
- 需要落地檔案的模組一律使用暫存目錄，不指向專案內或正式資料檔案。
- 每個測試案例使用獨立的區塊，各自建立 fixture，不共用可變狀態。

## 新增測試

- **新增一個斷言或案例**：找到對應的測試檔，加進 `run(t, h)`。
- **新增一支測試檔**：在對應模組群組資料夾新增 `*.suite.mjs`，於 `test/run.mjs` import 後加進該群組的清單。
- **新增一組後端模組的測試**：
  1. 新增 `test/<domain>/fixtures.mjs`，載入該組模組、回傳工具物件。
  2. 在該資料夾下依模組分類新增測試檔。
  3. 在 `test/run.mjs` 中登記這組模組與其測試檔清單。

所有模組群組共用同一個載入器與同一個暫存根目錄。

## 已知限制

1. 測試檔必須放在專案內，否則載入 Vite 會找不到套件。
2. 路徑別名（目前只有 `$lib`）需要在 `core/loader.mjs` 設定；使用其他別名的模組需另外補上。
3. 模組載入路徑以 `/` 開頭、相對專案根目錄，指向 `.ts` 原始碼，不是 build 產物。
4. 進入點結尾需要顯式呼叫 `process.exit()`，否則背景的計時器會讓進程無法自然結束。
5. 輸出一律使用 `say()`，不使用 `console.log`，因為後者已被關閉。

## 一次性驗證

想暫時確認某段邏輯而不打算寫成測試檔時，可在專案內建立一支暫用的 `.mjs`，用 `test/core/` 的載入器與斷言函式拼出來：

```js
// _smoke.mjs —— 跑完即刪
import { createLoader } from "./test/core/loader.mjs";
import { createAsserter, say } from "./test/core/assert.mjs";

const loader = await createLoader();
const { t, state } = createAsserter();
try {
  const { Database } = await loader.load("/src/lib/database/index.ts");
  Database.ensureLoaded(loader.tmpRoot + "/smoke.json");
  t.ok("載入成功", Database.isLoaded());
} finally {
  await loader.dispose();
  say(`\n=== ${state.pass} passed, ${state.fail} failed ===`);
  process.exit(state.fail > 0 ? 1 : 0);
}
```

執行 `node ./_smoke.mjs`，確認後刪除。若這段邏輯需要長期保留，整理成一支測試檔放進對應資料夾即可。
