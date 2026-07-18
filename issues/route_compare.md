# Compare 頁面路由 — 內部邏輯沙盒審查

審查範圍：`src/routes/compare/**`（`+page.server.ts`、`+page.svelte`、`cards/*`、`header/*`、`list/*`）。
依審查限制，所有外部套件（`$lib/*`）、路由參數與 API 回傳結果皆視為 100% 正確，僅分析目標模組內部的狀態機、副作用時機、事件處理與條件渲染。

---

## 1. 結構簡述

```
compare/
├── +page.server.ts                 (load: 依 URL 查詢 items/total)
│
└── +page.svelte                    (根：pending / pinnedIds / pinnedRecords 狀態 + 事件處理器)
    │
    ├── header/Toolbar.svelte       (onquery / onshuffle / onrefresh 轉發)
    │   ├── header/Filters.svelte           (query 衍生自 page.url.searchParams)
    │   │   ├── header/FilterButton.svelte  (顯示 advancedCount 徽章)
    │   │   └── header/FilterPopover.svelte (標籤/評等子表單 + 點外部關閉)
    │   └── header/Actions.svelte           (重新整理 / 抽選張數 / 隨機抽選)
    │
    ├── list/Panel.svelte           (左側收合面板容器 + 全域 CSS 變數控制)
    │   └── list/List.svelte
    │       ├── list/ListHeader.svelte      (顯示 total)
    │       └── list/ListItems.svelte       (虛擬清單 + pinnedSet)
    │           └── list/ListItem.svelte    (每列：釘選 toggle 按鈕)
    │
    └── cards/Cards.svelte          (依 pinnedRecords 渲染，keyed by record.id)
        └── cards/Card.svelte  (N 張)
            ├── cards/CardHeader.svelte     (取消釘選)
            └── cards/CardInfo.svelte       (評等/標籤唯讀顯示 + 編輯連結 + 取消提交)
```

資料流重點：
- `pinnedIds`：`+page.svelte` 內以 `$derived` 衍生自 `page.url.searchParams.get("pinned")`，但在事件處理器中被直接覆寫（可覆寫 derived 模式），再透過 `updatePinnedSearchParams()` 寫回 URL。
- `query`（篩選條件）：`Filters.svelte` / `FilterPopover.svelte` 皆各自以 `$derived` 直接衍生自 `page.url.searchParams`，沒有本地覆寫層，變更完全依賴 `goto()` 導航完成後才回饋。
- `pending`：`+page.svelte` 的單一全頁鎖，只在 `handleRefresh` / `handleRevert` 中被設置與檢查，`handleQuery`（篩選）與 `handleShuffle`（隨機抽選）、`handleTogglePin`/`handleUnPin`（釘選切換）皆不參與此鎖。

---

## 2. 內部 Bug 審查

- **篩選變更的 lost update 競態**：`Filters.svelte`／`FilterPopover.svelte` 中所有變更處理器（`handleSearch`、`handleSortChange`、`handleOrderChange`、`handleRatingChange`、`handleRatingOpChange`、`createHandleTagsChange`）都是以 `$derived` 自 `page.url.searchParams` 取得的 `query` 為底稿建構下一個 `ImageQuery`，再交給 `+page.svelte` 的 `handleQuery` 觸發 `goto(..., { replaceState: true })`。`goto` 是非同步且未被等待，而 `page.url`（進而 `query`）要等到該次導航完成才會更新。若使用者在前一次 `goto` resolve 之前又觸發另一次篩選互動（例如連續切換兩個標籤，或標籤後緊接著調整評等），後一次呼叫會基於尚未更新的舊 `query` 快照建構查詢字串，並以 `replaceState:true` 整個覆蓋 URL，導致前一次的篩選變更被靜默丟棄。

- **多重導航互不協調**：`handleQuery` 完全不讀取也不設置 `pending`，因此其觸發的 `goto` 可以與 `handleRefresh`、`handleRevert` 內部各自的 `goto` 同時在途；三者互不知情，最終只有最後 resolve 的那個導航決定畫面上的 URL 與資料，其餘導航所代表的使用者操作意圖會被無聲地覆蓋/捨棄。

- **孤兒 pinned id 無法再被移除**：`pinnedRecords` 由 `pinnedIds.map(id => recordsById.get(id)).filter(r => r !== undefined)` 產生，任何不存在於目前 `data.items`（受篩選/排序影響）中的已釘選 id 會被直接過濾、不渲染任何卡片。但「取消釘選」按鈕位於 `CardHeader`，只會隨著實際渲染出的卡片出現；一旦某個 pinned id 因篩選條件改變而從 `data.items` 消失，使用者將再也無法透過任何 UI 互動移除該 id，它會永久停留在 `pinnedIds` 與 URL 的 `pinned` 參數中，除非使用者觸發「隨機抽選」整批覆蓋。

- **`Panel.svelte` 的視窗寬度 `$effect` 只會執行一次**：該 effect 內讀取的是原生 `window.innerWidth`，不是任何 Svelte 響應式來源，因此 Svelte 不會追蹤到任何依賴，effect 只在元件掛載當下執行一次。使用者掛載頁面後才將視窗由桌面寬度縮小到 600px 以下，不會重新觸發此自動收合邏輯（沒有對應的 `resize` 事件監聽）。

- **全域 CSS 變數的副作用沒有清理**：同一個 `$effect` 與 `handleTogglePanel` 都直接對 `document.documentElement` 讀寫 CSS 自訂屬性 `--left-panel-width`，這是跨路由共用的全域可變狀態。`Panel.svelte` 卸載（離開 `/compare`）時沒有任何清理（`$effect` 未回傳清理函式），上一次設定/移除的收合狀態會滲漏並殘留給之後掛載的其他頁面或元件。

- **`pinnedIds` 未去重，破壞 keyed-each 的唯一鍵假設**：`pinnedIds` 直接由 `page.url.searchParams.get("pinned")` 以逗號切割取得，沒有任何去重處理。若 `pinned` 參數中出現重複 id，`Cards.svelte` 的 `{#each pinnedRecords as record (record.id)}` 會拿到重複的 key，違反 Svelte keyed-each 要求鍵值唯一的前提，可能導致取消釘選或重新渲染時對應到錯誤的卡片。

- **`handleRevert` / `handleRefresh` 缺少例外處理路徑**：兩者內部的非同步呼叫（`handleRevert` 的 `await api.del(...)` 與兩者共有的 `await goto(...)`）只被包在 `try { ... } finally { pending = false; }`，沒有對應的 `catch`。一旦這些呼叫本身拋出例外（而非回傳邏輯失敗的結果），例外會成為未處理的 rejection：`pending` 雖會經由 `finally` 正確重置，但使用者不會收到任何錯誤提示（`handleRevert` 只有在 `!res.ok` 分支才會顯示錯誤 toast），流程也會在該處直接中斷。

---

## 3. Edge Case 清單

- [ ] 篩選結果為 0 筆圖片 -> [已解決]
- [ ] 尚未釘選任何圖片時渲染 Cards -> [已解決]
- [ ] 已釘選的 id 不存在於目前 data.items（篩選後消失） -> [未解決]
- [ ] URL 的 pinned 參數含重複 id -> [未解決]
- [ ] 隨機抽選張數大於目前可用圖片池數量 -> [已解決]
- [ ] 圖片池為空時觸發隨機抽選 -> [已解決]
- [ ] shuffleKey 為 undefined 時觸發隨機抽選 -> [已解決]
- [ ] 隨機抽選結果與目前釘選集合完全重疊 -> [已解決]
- [ ] pending 為 true 時仍可對釘選/取消釘選按鈕操作 -> [未解決]
- [ ] pending 為 true 時仍可觸發篩選變更或隨機抽選 -> [未解決]
- [ ] 連續快速切換多個篩選條件（標籤/評等/排序） -> [未解決]
- [ ] 篩選導航進行中同時觸發「重新整理」或「取消提交」 -> [未解決]
- [ ] 取消提交 API 回傳失敗（res.ok 為 false） -> [已解決]
- [ ] 取消提交流程中途拋出例外（非邏輯失敗） -> [未解決]
- [ ] 重新整理流程中途拋出例外 -> [未解決]
- [ ] 取消提交確認對話框中途取消 -> [已解決]
- [ ] 連續快速點擊「重新整理」按鈕 -> [已解決]
- [ ] 對同一張卡片連續快速點擊「取消提交」 -> [已解決]
- [ ] 排序欄位切換為 random 時排序方向選單應鎖定 -> [已解決]
- [ ] 評等篩選由特定數值切回「全部」 -> [已解決]
- [ ] FilterPopover 開啟時點擊面板內部元件（TagInput/Select） -> [已解決]
- [ ] FilterPopover 開啟時按下 Escape 鍵 -> [已解決]
- [ ] FilterPopover 開啟時點擊觸發按鈕本身以外的頁面任意處 -> [已解決]
- [ ] 視窗掛載後才從桌面寬度縮小至 600px 以下 -> [未解決]
- [ ] 手動點擊「開合圖庫列表」與行動裝置自動收合邏輯互相覆蓋 -> [未解決]
- [ ] 離開 /compare 後全域 CSS 變數 --left-panel-width 殘留狀態 -> [未解決]
- [ ] 釘選卡片數量多到需要橫向捲動 -> [已解決]
- [ ] 篩選/排序變更後虛擬清單捲動位置未重置 -> [未解決]
