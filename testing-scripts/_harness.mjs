/**
 * @file _harness.mjs
 * 測試基礎建設：Vite 模組載入器 + 斷言器 + db 隔離工具。
 *
 * 依 TESTING.md 的做法，用 Vite 的 `ssrLoadModule` 直接載入 `src/lib/poc/` 下的
 * TypeScript 原始碼（$lib alias、.ts 解析、server-only 的 fs import 皆與正式環境一致），
 * 不引入任何測試框架。所有 suite 共用同一台 Vite server 與同一組已載入模組。
 *
 * 用法：`node ./run-all.mjs`（見 README.md）。單獨跑某個 suite 見各檔尾註。
 */

import { createServer } from "vite";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── console 靜音 ──────────────────────────────────────────────────────────
// 應用程式自己的 log() 與 Vite 都走 console.*，會與斷言結果混在一起。
// 全數轉為 no-op，測試報表改用 process.stdout.write 直送，輸出乾淨可讀。
const realLog = console.log.bind(console);
function silenceConsole() {
  const noop = () => {};
  console.log = noop;
  console.info = noop;
  console.warn = noop;
  console.error = noop;
}
/** 直送 stdout，不受 console 靜音影響。 */
export function say(line = "") {
  process.stdout.write(line + "\n");
}

// ── 斷言器 ────────────────────────────────────────────────────────────────
/**
 * 建立一個累計 pass/fail 的斷言器。每條斷言的 label 要能單獨說明「測什麼」，
 * FAIL 時印出 got / want，不需回頭看程式碼。
 */
export function createAsserter() {
  const state = { pass: 0, fail: 0, failures: [] };

  const record = (ok, label, detail) => {
    if (ok) {
      state.pass++;
      say(`  ✓ ${label}`);
    } else {
      state.fail++;
      state.failures.push(label);
      say(`  ✗ ${label}${detail ? `  ${detail}` : ""}`);
    }
  };

  const t = {
    /** JSON 深比較。比物件陣列請先投影成純量（如 .map(i => i.id)）。 */
    eq(label, got, want) {
      const g = JSON.stringify(got);
      const w = JSON.stringify(want);
      record(g === w, label, g === w ? "" : `got=${g} want=${w}`);
    },
    /** 布林斷言。 */
    ok(label, cond) {
      record(cond === true, label, cond === true ? "" : `got=${JSON.stringify(cond)} want=true`);
    },
    /** fn 必須拋錯。 */
    throws(label, fn) {
      let threw = false;
      try {
        fn();
      } catch {
        threw = true;
      }
      record(threw, label, threw ? "" : "expected throw, got none");
    },
    /** fn 不得拋錯。 */
    notThrows(label, fn) {
      let err = null;
      try {
        fn();
      } catch (e) {
        err = e;
      }
      record(err === null, label, err ? `threw: ${err?.message ?? err}` : "");
    },
  };

  return { t, state };
}

// ── Harness ───────────────────────────────────────────────────────────────
/**
 * 起 Vite server、載入全部 poc 模組（含未對外匯出的內部檔），並回傳一組
 * db 隔離工具。所有落地檔一律走 os.tmpdir()，跑完 dispose() 清乾淨。
 */
export async function createHarness() {
  const server = await createServer({
    root,
    configFile: false,
    logLevel: "silent",
    resolve: { alias: { $lib: path.join(root, "src/lib") } },
    server: { middlewareMode: true },
    optimizeDeps: { noDiscovery: true },
  });

  // 起完 server 後再靜音，避免吞掉 server 啟動階段可能的真實錯誤。
  silenceConsole();

  const load = (p) => server.ssrLoadModule(p);
  const [database, querySpec, query, mutation, bitmap, ordinal, facetIndex, serialization, parse] = await Promise.all([
    load("/src/lib/poc/database/index.ts"),
    load("/src/lib/poc/query-spec/index.ts"),
    load("/src/lib/poc/query/index.ts"),
    load("/src/lib/poc/mutation/index.ts"),
    load("/src/lib/poc/database/bitmap.ts"),
    load("/src/lib/poc/database/ordinal.ts"),
    load("/src/lib/poc/database/facet-index.ts"),
    load("/src/lib/poc/database/serialization.ts"),
    load("/src/lib/poc/query-spec/parse.ts"),
  ]);

  const modules = {
    ...database, // Database, BitSet
    ...querySpec, // ImageWhere, TagWhere, ListOptions, ImageQuery, TagQuery, TagFacetQuery, IMAGE_SORTS, TAG_SORTS
    ...query, // Query
    ...mutation, // Mutation
    ...parse, // parseTags, safeInt, parseEnum, parseBool
    OrdinalRegistry: ordinal.OrdinalRegistry,
    FacetIndex: facetIndex.FacetIndex,
    serialization, // emptyDBData, parseDBData, TagMetaCodec
  };

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "poc-test-"));
  let counter = 0;
  const { Database } = modules;

  /** 產生一條唯一 db.json 路徑（不同路徑 → ensureLoaded 會重載，達成隔離）。 */
  const newDbPath = () => path.join(tmpRoot, `db-${counter++}.json`);

  /** 全新空 db，回傳已載入的實例。 */
  const freshDb = () => {
    Database.ensureLoaded(newDbPath());
    return Database.requireLoaded();
  };

  /** 先把 dataObj 寫成 db.json 再載入，回傳實例。用於序列化相容性測試。 */
  const seedFile = (dataObj) => {
    const p = newDbPath();
    fs.writeFileSync(p, JSON.stringify(dataObj), "utf8");
    Database.ensureLoaded(p);
    return Database.requireLoaded();
  };

  /**
   * 直接寫一筆圖片真相 + 同步投影（繞過 mutation 驗證），欄位有預設值。
   * 供 query / hidden 測試造穩定 fixture、精準控制 committedAt / rating。
   */
  const putImage = (db, id, rec = {}) => {
    const old = db.getImage(id);
    const full = {
      name: id,
      tags: [],
      rating: 0,
      committedAt: 0,
      updatedAt: 0,
      fileSize: 0,
      width: 0,
      height: 0,
      blurhash: "",
      ...rec,
    };
    db.setImage(id, full);
    db.replaceIndex(id, old);
    return full;
  };

  const dispose = async () => {
    await server.close();
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
    // 還原 console，讓最終報表（若有人用 console）與環境乾淨。
    console.log = realLog;
  };

  return { modules, freshDb, seedFile, putImage, newDbPath, dispose };
}
