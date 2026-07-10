# poc 測試腳本

依 [`TESTING.md`](../TESTING.md) 的做法：不引入測試框架，用 Vite 的 `ssrLoadModule`
直接載入 `src/lib/poc/` 的 TypeScript 原始碼（$lib alias、`.ts` 解析、server-only 的
`fs` import 皆與正式環境一致），在同一支 Node 進程內完成載入、執行、斷言、清理。

## 跑法

```bash
# 全部 suite
node ./testing-scripts/run-all.mjs

# 只跑名稱含關鍵字的 suite（例如 hidden）
node ./testing-scripts/run-all.mjs hidden
```

exit code：全通過 0，有失敗 1（可配合 CI）。

## 檔案

| 檔案 | 測什麼 |
| --- | --- |
| `_harness.mjs` | 基礎建設：Vite 載入器、斷言器（`eq`/`ok`/`throws`）、db 隔離工具（`freshDb`/`seedFile`/`putImage`）、console 靜音 |
| `run-all.mjs` | 進入點：起一台 server、依序跑所有 suite、彙總結果、`process.exit` |
| `bitmap.suite.mjs` | `BitSet`：跨字組運算、擴容、clone、AND/ANDNOT/OR、`andSize`、`values` |
| `ordinal.suite.mjs` | `OrdinalRegistry`：序號指派、墓碑不重用、`needsCompaction`、`live` |
| `facet-index.suite.mjs` | `FacetIndex`：tag 位元圖增刪、`ratingRange` 夾制、`clampRating` |
| `serialization.suite.mjs` | `parseDBData` v1/v2 相容、寬容跳過壞紀錄、`TagMetaCodec` |
| `database.suite.mjs` | `Database`：真相 CRUD、`replaceIndex`/`rebuild`、壓實觸發、稀疏 tag meta |
| `query-spec.suite.mjs` | 值物件 `fromSearchParams`/`toSearchParams` /`with`、`search-params` 純函式 |
| `query.suite.mjs` | `Query`：篩選、排序、分頁、`tags`/`facets`（不含 hidden） |
| `mutation.suite.mjs` | `Mutation`：commit/update/remove/rename/delete/setMeta、驗證、樂觀併發、`last_tag` |
| `hidden.suite.mjs` | **hidden 標籤的完整情境**：images 遮蔽、解鎖、facet 解鎖投影計數、動態切換 |

## 慣例

- 落地檔一律走 `os.tmpdir()`，`dispose()` 時清乾淨，不碰專案內或真實 `db.json`。
- 每條斷言 label 要能單獨說明「測什麼」，`FAIL` 時印 `got`/`want`。
- 加新 suite：新增 `*.suite.mjs`（`export default { name, run(t, h) }`），並在
  `run-all.mjs` 的 import 與 `SUITES` 陣列登記。
