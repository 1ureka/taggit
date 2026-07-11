/**
 * @file run.mjs
 * 後端測試進入點：起一台共用的 Vite 載入器，依領域建立 fixtures，依序跑各 suite，
 * 彙總 pass/fail，以 exit code 表達成敗（全通過 0、有失敗 1，可配合 CI）。
 *
 * 跑法：
 *   node ./test/run.mjs
 *   node ./test/run.mjs hidden      # 只跑名稱含 "hidden" 的 suite
 *
 * 每個 suite 是一支 *.suite.mjs，預設匯出 { name, run(t, h) }；h 是所屬領域的 fixtures。
 * 新增 suite：放進對應領域資料夾，於下方 import 並登記到該領域的 suites 陣列。
 * 新增領域：新增 <domain>/fixtures.mjs，於 DOMAINS 加一筆 { name, setup, suites }。
 */

import { createLoader } from "./core/loader.mjs";
import { createAsserter, say } from "./core/assert.mjs";

import { createRepoFixtures } from "./repo/fixtures.mjs";
import bitmap from "./repo/database/bitmap.suite.mjs";
import ordinal from "./repo/database/ordinal.suite.mjs";
import facetIndex from "./repo/database/facet-index.suite.mjs";
import serialization from "./repo/database/serialization.suite.mjs";
import database from "./repo/database/database.suite.mjs";
import querySpec from "./repo/query/query-spec.suite.mjs";
import query from "./repo/query/query.suite.mjs";
import mutation from "./repo/mutation/mutation.suite.mjs";
import mutationValidation from "./repo/mutation/mutation-validation.suite.mjs";
import hidden from "./repo/scenario/hidden.suite.mjs";

/**
 * 後端各領域。每個領域有自己的 fixtures 工廠（setup）與 suite 清單。
 * 目前只有 repo；未來 collection / image 等後端模組可各加一筆。
 */
const DOMAINS = [
  {
    name: "repo",
    setup: createRepoFixtures,
    suites: [bitmap, ordinal, facetIndex, serialization, database, querySpec, query, mutation, mutationValidation, hidden],
  },
];

const filter = process.argv[2]?.toLowerCase();
const match = (suite) => !filter || suite.name.toLowerCase().includes(filter);

const loader = await createLoader();
const { t, state } = createAsserter();

try {
  for (const domain of DOMAINS) {
    const selected = domain.suites.filter(match);
    if (!selected.length) continue;

    say(`\n━━ 領域：${domain.name} ━━`);
    const h = await domain.setup(loader);

    for (const suite of selected) {
      say(`\n── ${suite.name} ──`);
      try {
        await suite.run(t, h);
      } catch (e) {
        state.fail++;
        state.failures.push(`${suite.name} (threw)`);
        say(`  ✗ suite threw: ${e?.stack ?? e}`);
      }
    }
  }
} finally {
  await loader.dispose();
  say(`\n=== ${state.pass} passed, ${state.fail} failed ===`);
  if (state.failures.length) say(`failed: ${state.failures.join(", ")}`);
  // markDirty() 會排 500ms 防抖 flush 吊住 event loop，必須顯式 exit。
  process.exit(state.fail > 0 ? 1 : 0);
}
