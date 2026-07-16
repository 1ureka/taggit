# `/tagger` 現行實作 vs 原型（taggit `tagger-b`）差異報告

> 研究範圍：新專案 `src/routes/(app)/tagger/**` 全部檔案 vs 舊專案 `src/routes/tagger-b/**` 全部檔案，逐檔讀完後比對。

## 一、功能缺口（原型有、新專案完全沒有）

| 功能 | 原型位置 | 現況 |
| --- | --- | --- |
| **圖章模式** | `logic/stamp.ts`、`inspector/StampTool.svelte`、`list/StagedGrid.svelte` 的拖曳套用邏輯 | 完全未遷移，是本輪 temp.md 的規劃對象 |
| **上傳圖片按鈕** | `list/Toolbar.svelte` 的「加入圖片」+ `logic/api.ts` 的 `uploadFiles()`（呼叫 `POST /api/staged`） | 新專案 `header/Toolbar.svelte` 無此按鈕。後端 `POST /api/staged` 本身完好存在，但**全 `src/` 找不到任何呼叫它的前端程式碼**，端點目前是孤兒 |
| **單張即時提交** | `inspector/Inspector.svelte` 的 `oncommit` + `+page.svelte` 的 `handleCommitCurrent`，可在檢視單張時直接提交，不必進審查清單 | `InspectorFooter.svelte` 只有「清空草稿」「刪除此張」，一律要走 `ReviewModal` |
| **全部鍵盤快捷鍵** | `+page.svelte` 的 `handleWindowKeydown`：`Ctrl/Cmd+S` 開審查、`←/↑`/`→/↓` 切換上一張下一張、`Esc` 依序退圖章模式／關檢視器 | 新專案 `+page.svelte` 只掛 `onbeforeunload`，**沒有任何 `onkeydown`**（已 grep 確認） |
| **圖章徽章／退出圖章模式 UI** | `list/StagedGrid.svelte` 的 `.stamp-badge` | 隨圖章模式一起消失 |

## 二、架構／資料流差異（新專案的主動改良）

- **杜絕 `$effect` 做字典/選取集合同步**：原型用 `$effect`+`untrack` 讓 `drafts` 跟 `data.stagedFiles` 同步增刪、讓 `currentFile` 在檔案消失時自動清空。新專案兩者都改成「原始意圖 state 不清除，畫面讀來源過濾後的 derived」（見 memory `tagger-dataflow-pattern`）。`wall/StagedGrid.svelte` 仍保留一個 `$effect`，但那是捲動 DOM 副作用，不是狀態同步，性質不同、不違反原則。
- **ReviewModal 勾選狀態管理方式整個換掉，且有一個行為差異值得注意**：原型 `ReviewModal.svelte` 內部自帶 `$effect`，每次「開啟瞬間」自動全選所有可提交項目、清空上次失敗紀錄。新專案把 `checkedFiles`（`SvelteSet`）提升到 `+page.svelte`，`handleReviewOpen` 只清 `failures`，**完全不碰 `checkedFiles`**——已讀 `+page.svelte:119-122` 確認。
  **實際影響**：使用者第一次打開審查清單時，新專案是「全部未勾選」，必須手動全選或逐張勾；原型是「一打開就自動勾好」。這不確定是刻意決定還是重構時的副作用遺漏，**列入待收斂問題**。
- **ReviewEntry 建構抽成純函式**：原型在 `+page.svelte` inline `$derived` 手刻物件；新專案抽成 `review/reviewEntry.ts`（`buildReviewEntry`/`computeNewTags`/`toggleEntry`/`toggleAllEntries`），是架構升級，非缺口。
- **TagInput 改遠端查詢**：新專案 `$lib/widgets/TagInput.svelte` 自打 debounce 查詢 API，取代原型吃靜態 `authoringTags` 陣列；`+page.server.ts` 也因此只回傳 `existingTagNames`（字串陣列）而非完整 `Tag[]`。屬合理封裝改善。
- **Import 呈現方式改變**：原型用全域 `withProgressToast` 顯示進度；新專案在 `ImportModal` 內自包 `progress`/`result` 狀態顯示（因為全域 toast 完成訊息寫死「完成」，無法顯示「成功 N、跳過 M」細節），**且 modal 提交後不會自動關閉**（原型是 `open = false` 自動關），需要使用者手動按「關閉」。這是已知決策（見 memory `phase0-status` 第四輪），非遺漏。

## 三、UI/UX 差異（新專案主動新增／修改，原型沒有）

### 3.1 新增：Lightbox 上一張/下一張切換
原型的大圖預覽只是純展示（`Modal`+`ImageCanvas`+檔名 caption），完全沒有切換能力；新專案新增了 `onprev`/`onnext`（見 memory `phase0-status` 第五輪，第一版用方向鍵被使用者否決，改成純按鈕）。

### 3.2 發現的 bug：Lightbox 頁碼／按鈕 disabled 是 off-by-one

已直接讀源碼確認，不是猜測：

- `+page.svelte:56` 算 `activeIndex`（Inspector 用）：`data.stagedFiles.indexOf(activeFile) + 1` → **1-based**。
- `+page.svelte:68` 算 `lightbox.index`（Lightbox 用）：`data.stagedFiles.indexOf(lightboxFile)` → **0-based，沒有 `+1`**。
- `Lightbox.svelte:33` 直接把這個 0-based `index` 當「第幾張」顯示：`` `${index} / ${total}` ``（第一張會顯示「0 / N」，不是「1 / N」）。
- `Lightbox.svelte:48` 上一張按鈕：`status={index <= 1 ? "disabled" : undefined}` —— 因為 `index` 是 0-based，第一張是 `index=0`（正確鎖住），但**第二張是 `index=1`，也會被誤鎖住**（`1 <= 1` 為真），使用者在第二張圖時「上一張」按鈕會被錯誤禁用。
- `Lightbox.svelte:59` 下一張按鈕：`status={index >= total ? "disabled" : undefined}` —— `index` 最大值是 `total - 1`（0-based），`total - 1 >= total` **恆為假**，代表下一張按鈕**永遠不會顯示 disabled**，包含在最後一張時（`navigateLightbox` 的 `Math.min` 會讓實際導覽正確地停在最後一張、不會報錯，但按鈕視覺上不會鎖住，造成「按了沒反應」的觀感）。

**修法很單純**：把 `+page.svelte:68` 的 `lightbox.index` 也改成 `+ 1`（跟 `activeIndex` 一致），`Lightbox.svelte` 的兩個 disabled 判斷式不用改（`index <= 1`／`index >= total` 在 1-based 下語意就是對的）。列入待收斂問題（是否本輪順手修）。

### 3.3 卡片牆改用虛擬化 masonry
新專案 `wall/StagedGrid.svelte` 用 `$lib/virtualizer/masonry.svelte`（真正的視窗虛擬化，`masonryItems = visibleItems`，螢幕外卡片不掛載 DOM）+ `wall/config.ts` 的 breakpoints 動態欄數，取代原型單純的 CSS `grid-template-columns: repeat(auto-fill, minmax(150px, 1fr))`。帶來「Inspector 開啟時卡片牆重新排版」的能力，原型沒有這行為。此差異與圖章模式規劃有關，已在 temp.md 中評估過對拖曳套用邏輯無實質影響（詳見 temp.md 第六節）。

## 四、資料夾/檔案結構對照表

| 原型（`tagger-b/`） | 新專案（`(app)/tagger/`） | 備註 |
| --- | --- | --- |
| `logic/draft.ts` | `inspector/draft.ts` | 且原本 `logic/api.ts` 的 `commitDrafts` 併入此檔 |
| `logic/api.ts`（`commitDrafts`/`uploadFiles`/`importRecords` 三合一） | 拆散：`commitDrafts`→`inspector/draft.ts`；`importRecords`→`header/import.ts`；`uploadFiles`→**未遷移** | 依使用情境分拆，而非集中 `logic/` |
| `logic/stamp.ts` | 無對應 | 隨圖章功能消失，是 temp.md 的規劃對象 |
| `list/`（`Toolbar`/`SessionProgress`/`StagedGrid`） | `header/`（`Toolbar`/`SessionProgress`/`ImportModal`/`ImportGuide`/`import.ts`）＋`wall/`（`StagedGrid`/`StagedCard`/`StagedCardInfo`/`config.ts`） | `list/` 依「頂部工具列」vs「卡片牆本體」一分為二；卡片也拆得更細 |
| `modals/ImportModal.svelte`（自帶邏輯） | `header/ImportModal.svelte`（純展示）+ `ImportGuide.svelte` | 開關/pending 狀態上提到 `+page.svelte` |
| `modals/ReviewModal.svelte`（單檔全內聯） | `review/`：`ReviewModal`/`ReviewHeader`/`ReviewList`/`ReviewFooter`/`ReviewImpact`/`reviewEntry.ts` | 拆成 6 個檔案，型別/純函式獨立 |
| `inspector/Inspector.svelte`（含 `StampTool`） | `inspector/`：`Inspector`/`InspectorHeader`/`InspectorFields`/`InspectorFooter`/`Lightbox`（新增） | 圖章工具目前缺席 |
| `+page.svelte` 內聯的 lightbox | `inspector/Lightbox.svelte` | 抽成獨立元件 |

## 五、已知技術債／尚未定案

- `migration.md:161` 與 `:183-189`：Phase 3 的 API 契約是 `api/proto/staged-batch`，「轉正時改名 `api/staged/commit` 之類正式路徑」——目前 `inspector/draft.ts` 仍呼叫 `/api/proto/staged-batch`，尚未轉正，是已知在案的技術債。**此為每個 Phase 的完成定義第 4 條，`/tagger` 目前尚未達成。**
- 原型 `list/StagedGrid.svelte` 空狀態文字提示「使用『加入圖片』上傳，或直接把檔案丟進收藏目錄的 `images/` 資料夾」；新專案空狀態只剩「暫存區目前沒有圖片」一句——因為上傳按鈕本身沒遷移，提示文字連帶消失，屬功能缺口的連帶影響。

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
| `lab/(showcase)/(display)/linear-progress/+page.svelte` | 87 | 提及舊原型 `tagger-b` 作為歷史脈絡引用 | 展示頁說明文字（無須改，歷史引用） |

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

## 七、待與使用者收斂的問題（詳見對話中的 AskUser）

1. `ReviewModal` 第一次開啟不再自動全選——是否為刻意決定，還是要補回原型的自動全選行為？
2. Lightbox 頁碼/按鈕 disabled 的 off-by-one bug（3.2 節）——是否本輪順手修？
3. 上傳圖片按鈕（及孤兒的 `POST /api/staged`）、單張即時提交、全部鍵盤快捷鍵——這些缺口是否本輪一起補，還是留到之後？
4. `/tagger` → `/staged` 改名時機：本輪先做，還是等圖章模式做完再一起收尾？
