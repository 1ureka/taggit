# Staged 頁面路由 — 內部邏輯沙盒審查

審查範圍：`src/routes/staged/**`（`+page.server.ts`、`+page.svelte`、`cards/*`、`header/*`、`inspector/*`、`review/*`）。
依審查限制，所有外部套件（`$lib/*`、`Masonry`、`requestConfirm`、`api`、`imgSrc`）、路由參數與 API 回傳結果皆視為 100% 正確，僅分析目標模組內部的狀態機、副作用時機、事件處理與條件渲染。

---

## 1. 結構簡述

```
staged/
├── +page.server.ts                 (load: stagedFiles / existingTagNames)
│
└── +page.svelte                    (根：全頁狀態中樞 + 所有事件處理器)
    │   state:  pending / drafts / active / reviewOpen / failures /
    │           importOpen / importProgress / importResult /
    │           lightboxFile / checkedFiles(SvelteSet)
    │   derived: fileCount / touchedFiles / activeFile / activeIndex /
    │            reviewEntries / newTags / readyCount / lightbox
    │
    ├── header/
    │   ├── Toolbar.svelte           (轉發 onrefresh / onreview / onimport)
    │   │   └── SessionProgress.svelte  (blockedCount / untouchedCount / ratio 衍生)
    │   ├── ImportModal.svelte       (依 result / pending 三態切換內容)
    │   │   └── ImportGuide.svelte      (檔案輸入 + onimport)
    │   └── import.ts                (importRecords：SSE 串流解析)
    │
    ├── cards/
    │   ├── Cards.svelte             (Masonry 版面 + 捲動至 activeFile 的 $effect)
    │   │   └── Card.svelte             (每張：draft ?? emptyDraft，衍生 touched/problem)
    │   │       └── CardInfo.svelte        (檔名 / 標記 / 評等 / 標籤數)
    │   └── config.ts               (breakpoints / INSPECTOR_WIDTH / CARD_SIZE)
    │
    ├── inspector/
    │   ├── Inspector.svelte         (bind:draft 綁定 drafts[activeFile])
    │   │   ├── InspectorHeader.svelte  (activeIndex / fileCount / onclose)
    │   │   ├── InspectorFields.svelte  (bind name/rating/tags；顯示 problemOf)
    │   │   └── InspectorFooter.svelte  (清空草稿 / 刪除此張)
    │   ├── Lightbox.svelte          (大圖預覽 + prev/next)
    │   └── draft.ts                 (emptyDraft / problemOf / isTouched / isReady /
    │                                 stripExt / commitDrafts)
    │
    └── review/
        ├── ReviewModal.svelte       (checkedCount / checkableCount 衍生)
        │   ├── ReviewHeader.svelte
        │   ├── ReviewList.svelte       (bulkSelectionState + inert 遮罩)
        │   │   └── ReviewListItem.svelte  (勾選 / 縮圖預覽 / 名稱編輯 / problem)
        │   └── ReviewFooter.svelte     (submitStatus 衍生)
        │       └── ReviewImpact.svelte    (newTags 顯示)
        └── reviewEntry.ts           (buildReviewEntry / computeNewTags /
                                      toggleEntry / toggleAllEntries)
```

資料流重點：

- **`drafts`（本地暫存）**：`+page.svelte` 內唯一的可寫資料源，`Record<string, Draft>`。開檔時經 `setActiveFile` 以 `??= emptyDraft()` 延遲建立、不主動清除失效 key。`Cards`/`Inspector`/`review` 全部以此為根，向下傳遞或以 `bind:draft` 綁定 `drafts[activeFile]`。
- **`活躍檔（active → activeFile）`**：`active` 是使用者原始意圖（string | null），`activeFile` 為 `$derived`，額外要求 `data.stagedFiles.includes(active)`；因此檔案被提交/刪除而離開清單時，`activeFile` 自動回落為 `null`、Inspector 收合。
- **`reviewEntries`**：`$derived` 自 `touchedFiles` 逐張 `buildReviewEntry`，同時混入 `checkedFiles.has(f)`（勾選）與 `failures[f]`（上次提交失敗原因）。`newTags`、`readyCount`、Review Modal 的 `checkedCount/checkableCount` 全部再由它二次衍生。
- **`pending`**：單一全頁鎖，於 `handleReviewSubmit`、`handleImportFile`、`handleDeleteFile`、`handleRefresh` 中設置與檢查。`checkedFiles`（SvelteSet）與 `failures` 為提交流程的殘留狀態，僅在 `handleReviewOpen` 時 `failures` 被重置、成功項目才從兩者移除。

---

## 2. 內部 Bug 審查

- **`handleDeleteFile` 缺少 `catch`，傳輸層例外靜默且未處理**：`handleDeleteFile`（`+page.svelte:205–231`）只包 `try { ... } finally { pending = false; }`。當 `await api.del(...)` 本身拋出例外（而非回傳 `!res.ok`）時，沒有任何 `catch` 攔截：成功與 HTTP 失敗都有 toast，唯獨拋例外這條路徑不會給使用者任何提示，並成為未處理的 rejection。這與 `handleReviewSubmit`（`+page.svelte:110`）、`handleImportFile`（`+page.svelte:191`）皆備有 `catch` 明顯不一致。
> 真實問題

- **`handleRefresh` 同樣缺少 `catch`**：`handleRefresh`（`+page.svelte:243–253`）只有 `try/finally`，`invalidateAll()` 若拋例外，`pending` 雖經 `finally` 正確解鎖，但流程靜默中斷、無錯誤提示。
> 真實問題

- **`handleRefresh` 的延遲延續會在離開路由後仍執行**：`handleRefresh` 先 `await setTimeout(200ms)` 再 `await invalidateAll()`（`+page.svelte:247–248`）。此操作不會弄髒 `drafts`，而 `beforeNavigate`／`onbeforeunload` 的攔截條件都只看 `touchedFiles.length`，因此使用者可在這 200ms 內離開此路由。延遲結束後，延續仍會對「已切換的新路由」呼叫 `invalidateAll()`、跳出「暫存列表已更新」toast，並在已卸載的元件上寫回 `pending = false`。
> 真實問題

- **in-flight 操作不阻擋導覽，確認離開後仍產生跨頁副作用**：提交／匯入／刪除在 `await` 期間雖持有 `pending = true`，但這無法阻擋導覽——`beforeNavigate`（`+page.svelte:259–275`）與 `onbeforeunload`（`+page.svelte:255–257`）都只依 `touchedFiles`。若提交進行中（此時待提交檔仍為 touched）經 `beforeNavigate` 確認離開，其中 `drafts = {}` 已清空、`goto` 已啟動；但 `handleReviewSubmit` 的 `commitDrafts(...)` 早在呼叫當下就已快照好 payload，resolve 後仍會執行 `delete drafts`／`checkedFiles.delete`／toast／`invalidateAll`，在新頁面上產生「已提交 N 張」等跨頁 toast 與非預期的資料 invalidate，並對已卸載元件寫狀態。
> 真實問題，應該將 pending 與 touchedFiles 一起考量，而不是只考量 touchedFiles

- **primary 審查按鈕未納入 `pending`，可在無遮蔽時疊開 Modal**：Toolbar「檢視待提交的變更」按鈕的 `status` 只判斷 `touchedCount === 0`（`Toolbar.svelte:45`），而 refresh、import 兩顆按鈕都有 `pending` 造成的 disabled。當 `handleDeleteFile` 或 `handleRefresh` 進行中（`pending = true` 且此時畫面上並無遮蔽用的 Modal），此按鈕仍可點擊並觸發 `handleReviewOpen`（`+page.svelte:117–120`）開啟 Review Modal；但 `handleReviewClose`（`+page.svelte:151–153`）以 `pending` 擋住關閉，導致 Review Modal 於操作結束前無法關閉、submit 也被鎖住。
> 真實問題

- **`handleImportFile` 內 `let data` 遮蔽了元件 prop `data`（PageData）**：`+page.svelte:173` 宣告的區域變數 `data` 指向解析後的 JSON 物件，遮蔽了 `+page.svelte:24` 的頁面 `data` prop。目前函式內未引用到 prop 故無立即錯誤，但這是易誤用的命名遮蔽——日後若在此函式內誤寫 `data.stagedFiles`，取到的會是 JSON 內容而非頁面資料，型別上也可能不被察覺。
> 不算 bug，且按照 docs/structure.md 重構後自然消失

- **`handleDeleteFile` 的鎖／索引取得跨越確認框（latent）**：`handleDeleteFile` 的 `if (activeFile === null || pending) return` 檢查在 `await requestConfirm(...)` 之前，真正 `pending = true` 卻在確認之後（`+page.svelte:206–215`）；確認框開啟期間全域鎖並未持有。且 `idx`／`next` 是在確認 resolve 後才由 `data.stagedFiles` 計算（`+page.svelte:212–213`），若這段期間 `stagedFiles` 被其他非同步流程改動，將以過期索引推算「下一張」。因 `requestConfirm` 為 modal 遮蔽了多數並發入口，窗口實務上大半被遮蔽，故列為 latent 的鎖／取值時序問題。
> 不確定是否要改，需要討論改了的代價是什麼，是否可接受

- **`beforeNavigate` 的 `requestConfirm(...).then(...)` 未接 `.catch`**：`+page.svelte:269–274` 只處理 resolve 分支，確認流程若 reject 會成為未處理的 rejection，且導覽已被 `nav.cancel()` 取消、不再有後續補救。
> requestConfirm 在設計上就沒有打算拋錯

- **`onbeforeunload` 只 `preventDefault()`、未設 `returnValue`**：`handleBeforeUnload`（`+page.svelte:255–257`）僅呼叫 `e.preventDefault()`。部分瀏覽器需要一併設定 `e.returnValue` 才會顯示離開確認對話框（此點偏瀏覽器行為，列為觀察）。
> 目前沒遇到問題，不確定是否算 bug

- **（次要）`isReady` 為死代碼**：`draft.ts:38` 匯出的 `isReady` 在整個模組內無任何引用（可提交判斷各處改用 `problemOf(...) === null`），屬未使用的匯出。

> [!IMPORTANE] 注意，該檔案本身對於 staged 路由已過時，因為 staged 已經重寫過，但 tags 路由因為也有著類似的使用者流程，可能很多問題是類似的，因此保留做為參考
