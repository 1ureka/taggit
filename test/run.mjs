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
import queryImages from "./repo/query/query-images.suite.mjs";
import queryTags from "./repo/query/query-tags.suite.mjs";
import queryUnion from "./repo/query/query-union.suite.mjs";
import queryTagCounts from "./repo/query/query-tag-counts.suite.mjs";
import mutation from "./repo/mutation/mutation.suite.mjs";
import mutationValidation from "./repo/mutation/mutation-validation.suite.mjs";
import mutationTagChanges from "./repo/mutation/tag-changes.suite.mjs";
import hidden from "./repo/scenario/hidden.suite.mjs";

import { createImageFixtures } from "./image/fixtures.mjs";
import imageResources from "./image/resources.suite.mjs";
import imageFormats from "./image/formats.suite.mjs";
import imageBlurhash from "./image/blurhash.suite.mjs";
import imageMetadata from "./image/metadata.suite.mjs";
import imageProcessor from "./image/processor.suite.mjs";
import imageServer from "./image/server.suite.mjs";

import { createUtilsFixtures } from "./utils/fixtures.mjs";
import utilsVirtualize from "./utils/virtualize.suite.mjs";

import { createApiFixtures } from "./api/fixtures.mjs";
import apiGuards from "./api/guards.suite.mjs";
import apiCollection from "./api/collection.suite.mjs";
import apiFiles from "./api/files.suite.mjs";
import apiRecordsRead from "./api/records-read.suite.mjs";
import apiRecordsWrite from "./api/records-write.suite.mjs";
import apiRecordsBatch from "./api/records-batch.suite.mjs";
import apiTags from "./api/tags.suite.mjs";
import apiTagCounts from "./api/tags-counts.suite.mjs";
import apiMaintenance from "./api/maintenance.suite.mjs";

/**
 * 後端各領域。每個領域有自己的 fixtures 工廠（setup）與 suite 清單。
 * 目前有 repo、image、utils 與 api；未來 collection 等後端模組可各加一筆。
 *
 * api 領域直接載入 `+server.ts` 並呼叫裡頭的 GET / POST / …，因此擺在最後：
 * 它會重設 Database / ImageLibrary 的單例來測未就緒的守衛，不該影響其他領域。
 */
const DOMAINS = [
  {
    name: "repo",
    setup: createRepoFixtures,
    suites: [bitmap, ordinal, facetIndex, serialization, database, querySpec, queryImages, queryTags, queryUnion, queryTagCounts, mutation, mutationValidation, mutationTagChanges, hidden],
  },
  {
    name: "image",
    setup: createImageFixtures,
    suites: [imageResources, imageFormats, imageBlurhash, imageMetadata, imageProcessor, imageServer],
  },
  {
    name: "utils",
    setup: createUtilsFixtures,
    suites: [utilsVirtualize],
  },
  {
    name: "api",
    setup: createApiFixtures,
    suites: [apiGuards, apiCollection, apiFiles, apiRecordsRead, apiRecordsWrite, apiRecordsBatch, apiTags, apiTagCounts, apiMaintenance],
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
