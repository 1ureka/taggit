/**
 * @file run-all.mjs
 * 測試進入點：起一台 Vite server，依序跑所有 suite，彙總 pass/fail，以 exit code 表達成敗。
 *
 * 跑法：
 *   node ./testing-scripts/run-all.mjs
 *   node ./testing-scripts/run-all.mjs hidden      # 只跑名稱含 "hidden" 的 suite
 *
 * 每個 suite 是一支 *.suite.mjs，預設匯出 { name, run(t, h) }。
 */

import { createHarness, createAsserter, say } from "./_harness.mjs";

import bitmap from "./bitmap.suite.mjs";
import ordinal from "./ordinal.suite.mjs";
import facetIndex from "./facet-index.suite.mjs";
import serialization from "./serialization.suite.mjs";
import database from "./database.suite.mjs";
import querySpec from "./query-spec.suite.mjs";
import query from "./query.suite.mjs";
import mutation from "./mutation.suite.mjs";
import mutationValidation from "./mutation-validation.suite.mjs";
import hidden from "./hidden.suite.mjs";

const SUITES = [bitmap, ordinal, facetIndex, serialization, database, querySpec, query, mutation, mutationValidation, hidden];

const filter = process.argv[2]?.toLowerCase();
const selected = filter ? SUITES.filter((s) => s.name.toLowerCase().includes(filter)) : SUITES;

const h = await createHarness();
const { t, state } = createAsserter();

try {
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
} finally {
  await h.dispose();
  say(`\n=== ${state.pass} passed, ${state.fail} failed ===`);
  if (state.failures.length) say(`failed: ${state.failures.join(", ")}`);
  // markDirty() 會排 500ms 防抖 flush 吊住 event loop，必須顯式 exit。
  process.exit(state.fail > 0 ? 1 : 0);
}
