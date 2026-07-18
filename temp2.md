
## 六、命名稽核（供 `/tagger` → `/staged` 改名工程量評估）

**結論先講：API 層、型別、函式、元件命名完全沒有借用 `tagger` 這個詞**，改名成本極低。

全 `src/` 大小寫不敏感搜尋 `tagger`，命中 7 處（不含 `tagger/` 資料夾路徑本身）：

| 檔案 | 行號 | 內容 | 分類 |
| --- | --- | --- | --- |
| `(app)/tagger/+page.svelte` | 283 | `<title>Tagger</title>` | UI 文字（分頁標題，需改） |
| `(app)/(layout)/ModalTrigger.svelte` | 13 | TODO 註解提及 `/tagger`、`/editor` | 註解（可選改） |
| `(app)/(layout)/ModalTrigger.svelte` | 18 | `if (path === "/tagger") return "正在 審查圖片";` | 路由路徑字面值（需改） |
| `(app)/(layout)/ModalLinks.svelte` | 18 | 同上 TODO 註解 | 註解（可選改） |
| `(app)/(layout)/ModalLinks.svelte` | 22 | `if (path === "/tagger") return "/tagger";` | 路由路徑字面值（需改） |
| `(app)/(layout)/config.ts` | 18 | `href: "/tagger",` | `navItems` 導航設定（需改） |

`README.md` 第 9 行有「在 Tagger 上傳」，屬使用者文件敘述，改名後應同步更新。`migration.md` 提及 `tagger`/`tagger-b` 多處，屬規劃文件的敘述性引用，定案後可一併更新但不影響程式行為。

**沒有命中的地方（改名成本低的關鍵原因）**：
- 沒有任何函式名、型別名、變數名、元件名包含 `tagger`（`Draft`、`ReviewEntry`、`StagedCard`、`StagedGrid` 全部從一開始就用領域詞彙命名）。
- `src/lib/**`（widgets、components）零命中。
- `src/routes/api/**` 全部端點零命中——`api/staged/**`、`api/proto/staged-batch` 內部程式碼（函式名、log module 字串、URL 路徑）從頭到尾都用 `staged`，不是 `tagger`。

**改名所需動作**：
1. 資料夾改名 `src/routes/(app)/tagger/` → `src/routes/(app)/staged/`（主體工程量，路由層級操作）。
2. 同步 4 處路由路徑字面值（`config.ts:18`、`ModalTrigger.svelte:18`、`ModalLinks.svelte:22`、`<title>`）。
3. 可選：2 處 TODO 註解文字、`README.md`、`migration.md` 的敘述性引用。
4. API／型別／函式／元件命名完全不用動。

### `editor`/`committed` 命名現況檢查（Phase 6 預留）

- `api/committed/**`、`api/proto/committed-batch` 內部命名（`ItemResult`、`commitRecord`/`updateRecord`/`removeRecord`、log module 字串）全部一致用 `committed`，**沒有 `editor` 殘留**。
- `src/routes/(app)/editor/` 資料夾尚不存在，符合 Phase 6 未開始的現況。
- 已有的 forward-reference（`config.ts:25` 的 `href:"/editor"`、`ModalTrigger.svelte`/`ModalLinks.svelte` 的 `/editor` 分支、`(home)/+page.svelte`/`DetailModal.svelte` 的 `editorHref`、`+layout.server.ts` 的 `committedCount`）全部已正確使用 `editor`/`committed` 這組詞彙，**跟 `/tagger`→`/staged` 改名方向一致，Phase 6 開始時不會有命名債要還**。
