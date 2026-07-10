# 專案測試指引：基於 Vite SSR 的輕量自動化測試

> 本專案**刻意不引入 Vitest / Jest 等第三方測試庫**。
> 當需要驗證程式「真實執行邏輯」時，統一採用專案現有的 **Vite 作為模組載入器**，撰寫獨立的 `.mjs` 腳本進行斷言。

## TL;DR

- **不要** 為了測一段邏輯就 `npm i` 一個測試框架。
- 寫一個 `*.mjs`,用 `vite` 的 `createServer(...).ssrLoadModule("/src/...ts")` 載入**真正的 TS 原始碼**(含 `$lib` alias、`.ts` 解析、server-only 的 `fs` import 都照常運作),跑完手寫斷言後 `process.exit`。
- 檔案放**專案內**(node 才找得到 `vite`),跑完即刪。

## 為什麼用 Vite 而不是 `node --experimental-strip-types`

`node` 原生跑 `.ts`(strip-types)**不會**處理:
- `$lib/...` 這種路徑 alias(SvelteKit 的);
- import 寫 `./foo.js` 卻實體是 `./foo.ts` 的副檔名改寫;
- 其他 vite/svelte 專案級的解析規則。

而 `ssrLoadModule` 用的是**和正式 build 同一套解析器與轉譯**,所以你載到的模組行為 = 上線行為,擬真度最高,還零額外依賴(vite 本來就在 `devDependencies`)。

> 例外:若你要測的模組是**純 isomorphic、沒有 `$lib`/`fs`/alias**(例如 `query-spec/` 那些值物件),可以直接 `node --experimental-strip-types file.ts`,更輕。有任何 alias 或 server import 就走 Vite 版。

## 可直接複製的模板

把以下存成專案根目錄的 `_smoke.mjs`(或任何 `.mjs`),改中間的載入與斷言即可:

```js
// _smoke.mjs —— 一次性測試腳本;跑完請刪除
import { createServer } from "vite";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

const root = process.cwd();

// Vite 當「模組載入器」用:middlewareMode 不會真的開 port。
const server = await createServer({
  root,
  configFile: false, // 不讀 svelte.config,自己給最小設定
  logLevel: "error",
  resolve: { alias: { $lib: path.join(root, "src/lib") } }, // 對齊本專案的 $lib
  server: { middlewareMode: true },
  optimizeDeps: { noDiscovery: true }, // 跳過 dep 預打包,啟動更快
});

// 極簡斷言器:JSON 深比較,計數 pass/fail。
let pass = 0, fail = 0;
const eq = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "✓" : "✗"} ${label}` + (ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};

try {
  // ── 載入真正的原始碼(路徑相對 root、以 / 開頭)──
  const { Database } = await server.ssrLoadModule("/src/lib/poc/database/index.ts");
  const { Query } = await server.ssrLoadModule("/src/lib/poc/query/index.ts");
  const { Mutation } = await server.ssrLoadModule("/src/lib/poc/mutation/index.ts");
  const spec = await server.ssrLoadModule("/src/lib/poc/query-spec/index.ts");

  // ── 若模組要碰檔案系統,給它一個 temp 檔,別碰真實資料 ──
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "smoke-"));
  Database.ensureLoaded(path.join(tmpDir, "db.json"));
  const db = Database.requireLoaded();
  const q = new Query(db);
  const m = new Mutation(db);

  // ── 你的斷言 ──
  const file = { fileSize: 1, width: 1, height: 1, blurhash: "" };
  eq("commit ok", m.commitRecord("a.png", { name: "A", tags: ["cat"], rating: 5 }, file).ok, true);
  eq("count", q.getImageCount(), 1);

  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch (e) {
  console.error("THREW:", e);
  fail++;
} finally {
  await server.close();
  console.log(`\n=== ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0); // 見「陷阱 4」:一定要 exit
}
```

跑法:

```bash
node ./_smoke.mjs
# 應用程式自己的 log() 會夾雜輸出,想安靜可過濾:
node ./_smoke.mjs 2>&1 | grep -vE "^\[|INFO"
# 跑完刪掉
rm -f ./_smoke.mjs
```

## 陷阱(都是實際踩過的)

1. **腳本必須放在專案內**。`node` 解析 `import "vite"` 是從**腳本檔所在目錄往上找** `node_modules`,不是看 cwd。放在專案外(例如系統暫存區)會 `ERR_MODULE_NOT_FOUND: Cannot find package 'vite'`。→ 放專案根目錄,跑完刪。
2. **一定要設 `$lib` alias**。`configFile: false` 時 SvelteKit 的 alias 不會自動套用,漏了就會解析不到 `$lib/utils/...`。若模組還用了別的 alias,一併補進 `resolve.alias`。
3. **`ssrLoadModule` 的路徑以 `/` 開頭、相對 `root`**,且指向 `.ts` 原始碼本身(如 `/src/lib/poc/query/index.ts`),不是 build 產物。
4. **結尾一定要 `process.exit()`**。像本專案的 `markDirty()` 會排一個 `setTimeout` 防抖 flush,會**吊住 event loop** 讓 node 不退出。`server.close()` 之後顯式 `process.exit(code)`,順便用 exit code 表達成敗(CI 友善)。
5. **別碰真實資料**。要落地檔案的模組,用 `os.tmpdir()` + `fs.mkdtempSync` 開一個 temp 目錄餵它,結束 `rmSync` 清掉。
6. **log 雜訊**。模組內的 `log()` 會印到 stdout/stderr;用 `logLevel: "error"`(或 `"silent"`)壓 vite 自己的,再用 `grep -v` 濾掉應用程式的。
7. **斷言物件相等**要嘛用 `JSON.stringify` 深比較(如模板),要嘛比 `.map(i => i.id)` 這種**純量投影**——別直接對物件陣列 `.join()`,會得到 `[object Object]`(這個 pitfall 讓我某次誤報成 ❌)。

## 進階:把「一次性腳本」變「回歸測試」

同一招可以留成可重跑的回歸案例。做法不變,只是:

- 每條斷言寫清楚 **輸入 → 預期**,`✗` 時印出 `got` / `want`;
- 用 exit code 讓外層(手動或 CI)判定;
- 若要固定保留,放到 `scripts/` 之類目錄並在檔頭註明「如何跑、測什麼」,而非留在根目錄。

## 什麼時候「不用」這招

- 只是想確認**型別**對不對 → `npm run check`(svelte-check)就夠,不必跑腳本。
- 要測的是 **Svelte 元件互動 / 瀏覽器行為** → 這招只到「模組邏輯」層;UI 行為請走 `/run`、實際起 app 或瀏覽器驅動。
- 邏輯**純 isomorphic 無 alias** → 直接 `node --experimental-strip-types file.ts` 更省事。

---

**一句話總結給未來的你**:需要跑真邏輯時,別加測試庫——`vite` 的 `ssrLoadModule` 就是現成、高擬真的載入器,配一個自帶斷言的 `.mjs`、記得 temp 資料 + `process.exit`,跑完即刪。
