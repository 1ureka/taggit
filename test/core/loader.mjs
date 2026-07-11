/**
 * @file core/loader.mjs
 * 後端測試的通用底座：一台當「模組載入器」用的 Vite server + 暫存目錄 + console 靜音。
 *
 * 這一層與任何領域無關（不認識 database / query / …），只提供:
 *   - load(p)：用 Vite 的 ssrLoadModule 直接載入 src 下的 TypeScript 原始碼
 *              （$lib alias、.ts 解析、server-only 的 fs import 皆與正式環境一致）。
 *   - tmpRoot：一個一次性暫存目錄，供各領域的 fixtures 隔離落地檔用，dispose() 時清乾淨。
 *   - dispose()：關閉 server、清暫存、還原 console。
 *
 * 領域專屬的 fixtures（例如 poc/fixtures.mjs）建立在這層之上。
 */

import { createServer } from "vite";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

// test/core/loader.mjs → 專案根目錄。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// ── console 靜音 ──────────────────────────────────────────────────────────
// 應用程式自己的 log() 與 Vite 都走 console.*，會與斷言結果混在一起。
// 全數轉為 no-op；測試報表改用 say()（process.stdout.write）直送，輸出乾淨可讀。
const realLog = console.log.bind(console);
function silenceConsole() {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
}

/**
 * 起一台 middlewareMode 的 Vite server（不會真的開 port），載入完就靜音 console，
 * 並開一個暫存目錄。回傳 { load, tmpRoot, root, dispose }。
 */
export async function createLoader() {
  const server = await createServer({
    root,
    configFile: false, // 不讀 svelte.config，自己給最小設定
    logLevel: "silent",
    resolve: { alias: { $lib: path.join(root, "src/lib") } }, // 對齊本專案的 $lib
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true }, // 跳過 dep 預打包，啟動更快
  });

  // 起完 server 後再靜音，避免吞掉 server 啟動階段可能的真實錯誤。
  silenceConsole();

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "taggit-test-"));

  /** 以 `/` 開頭、相對 root 的路徑載入 .ts 原始碼本身（如 /src/lib/poc/query/index.ts）。 */
  const load = (p) => server.ssrLoadModule(p);

  const dispose = async () => {
    await server.close();
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
    console.log = realLog;
  };

  return { load, tmpRoot, root, dispose };
}
