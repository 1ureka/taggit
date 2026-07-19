# Settings 頁面路由 — 內部邏輯沙盒審查

審查範圍：`src/routes/settings/**`（`+page.server.ts`、`+page.svelte`、`sections/*`、`storage/*`）。
依審查限制，所有外部套件與模組（`$lib/collection`、`$lib/database`、`$lib/image/server`、`$lib/utils/request`（`api`）、`$lib/utils/shared`、`$lib/utils/storage`、`$lib/components/*`、`$lib/widgets/confirm-events`（`requestConfirm`）、`$app/navigation`、`$app/state`）、路由參數與 API/load 回傳結果皆視為 100% 正確，僅分析目標模組內部的狀態機、副作用時機、事件處理與條件渲染。

---

## 1. 結構簡述

```
settings/
├── +page.server.ts                 (load: collectionRoot / cacheStats / databaseLoaded)
│
└── +page.svelte                    (根：導覽 + scroll-spy 狀態中樞)
    │   state:   mainEl / activeId
    │   derived: sections（依 databaseLoaded 決定是否含 images / maintenance 兩區塊）
    │
    ├── sections/
    │   ├── CollectionSection.svelte    (圖片集路徑表單 + 路徑歷史瀏覽)
    │   │   state:   inputValue（可覆寫 derived）/ saving / errorMessage /
    │   │            history / historyIndex / draft（一般變數，非 $state）
    │   │   derived: alert（來自 page.url 的 ?alert 參數）/ historyHint
    │   │
    │   ├── CacheSection.svelte         (快取統計 + 元資料完整性檢查/補算)
    │   │   state:   cacheEntries/cacheBytes（可覆寫 derived）/ cacheBusy /
    │   │            metaMissing / metaChecking / metaFixing
    │   │   derived: metaBusy / metaResult
    │   │   └── ToolCard.svelte             (純展示殼層，被三個 section 共用)
    │   │
    │   ├── MaintenanceSection.svelte   (缺失記錄檢查/刪除 + 備份下載)
    │   │   state:   missingList / missingBusy / backupBusy
    │   │   derived: missingResult
    │   │   └── ToolCard.svelte             (同上)
    │   │
    │   └── ToolCard.svelte             (純展示，無內部狀態，Icon/title/description/children/actions/result)
    │
    └── storage/
        └── path-history.ts             (getPathHistory / pushPathHistory / clearPathHistory，純函式 + localStorage)
```

資料流重點：

- **`sections`／`activeId`**：`+page.svelte` 的 `sections` 由 `data.databaseLoaded` 衍生出導覽項目；`activeId` 則由 `mainEl` 的 `scroll` 事件手動計算（比對各 `section-${id}` 元素相對 `mainEl` 頂端的位置）。`handleNavClick` 只呼叫 `scrollIntoView`，不直接寫 `activeId`，高亮完全依賴後續的 scroll 事件回推。
- **三個 section 元件彼此獨立**：`CollectionSection`、`CacheSection`、`MaintenanceSection` 之間不共享任何狀態，僅共用 `ToolCard` 展示殼層與 `$lib/utils/request` 的 `api`；各自的忙碌旗標（`saving`/`cacheBusy`/`metaChecking`/`metaFixing`/`missingBusy`/`backupBusy`）互不影響。
- **`CollectionSection` 的歷史瀏覽狀態機**：`history`/`historyIndex`/`draft` 是本模組中唯一橫跨多個事件處理器（`handleKeydown` 的 ArrowUp/ArrowDown、`handleInput`、`handleClearHistory`、`handleSubmit`）互相影響的內部狀態；其餘 section 的忙碌旗標都是單一 handler 自產自消，不跨事件互動。

---

## 2. 內部 Bug 審查

- **六個非同步事件處理器皆無 `try/catch`，`api.*` 若拋出例外會讓忙碌旗標永久卡住**：以下處理器一律是 `busyFlag = true; const res = await api.xxx(...); busyFlag = false; if (res.ok && res.data) {...} else {...}` 的結構，`busyFlag = false` 只會在 `await` 正常 resolve 時執行：
  - `CollectionSection.svelte:85-104`（`handleSubmit`，鎖 `saving`）
  - `CacheSection.svelte:20-32`（`handleClearCache`，鎖 `cacheBusy`）
  - `CacheSection.svelte:50-60`（`handleMetaCheck`，鎖 `metaChecking`）
  - `CacheSection.svelte:62-77`（`handleMetaFix`，鎖 `metaFixing`）
  - `MaintenanceSection.svelte:23-33`（`handleMissingCheck`，鎖 `missingBusy`）
  - `MaintenanceSection.svelte:35-52`（`handleMissingDelete`，鎖 `missingBusy`）

  若 `api.*` 本身 reject（而非回傳 `{ ok: false }`），對應的 `busyFlag = false` 永遠不會執行到，按鈕會永久停在 `pending`/`disabled` 狀態，且不會有任何 toast 提示錯誤。同一模組內 `MaintenanceSection.svelte:58-84` 的 `handleBackup` 則正確使用了 `try/catch/finally` 包住整段流程，顯示這是模組內處理方式不一致，而非刻意為之的設計選擇。
> 真實問題

- **`MaintenanceSection` 的「開始檢查」按鈕在刪除操作進行中會誤顯示 `pending`**：`missingBusy`（`MaintenanceSection.svelte:15`）是 `handleMissingCheck` 與 `handleMissingDelete` 共用的單一旗標，但「開始檢查」按鈕的 `status`（`MaintenanceSection.svelte:94`）只寫 `missingBusy ? "pending" : undefined`，沒有像 `CacheSection.svelte:117,126` 那樣以 `metaChecking`/`metaFixing` 分別判斷是哪個操作在忙碌。因此使用者刪除缺失記錄時，「開始檢查」按鈕會顯示成自己正在執行中，儘管實際上是刪除操作在跑。
> 說實話當前這種 UX 實現有點遭，所以不只是 bug，這種兩階段的設計我都希望重做，請使用 AskUser 等工具給我一些建議

- **`handleMissingDelete` 的鎖定發生在確認框之後，確認期間 `missingBusy` 仍為 `false`**：`MaintenanceSection.svelte:35-52` 先檢查 `missingList === null` 直接 return，接著 `await requestConfirm(...)`，只有使用者確認後才把 `missingBusy` 設為 `true`。在確認框顯示期間，「開始檢查」按鈕仍可點擊並觸發 `handleMissingCheck`，讓 `missingList` 在使用者確認刪除的同時被一份新的檢查結果覆寫；確認訊息文字（`確定要刪除 ${missingList.length} 個缺失記錄？`）所依據的數量，可能與確認當下、乃至實際送出刪除當下的 `missingList.length` 不一致。
> 與上面一個問題一樣，整個 UX 還待定

- **`CollectionSection` 的「清空」歷史按鈕沒有還原 `draft`／`inputValue`**：當使用者正在瀏覽歷史（`historyIndex >= 0`，輸入框顯示的是某筆歷史路徑而非使用者原本輸入）時點擊「清空」（`handleClearHistory`，`CollectionSection.svelte:77-81`），只重置了 `history = []` 與 `historyIndex = -1`，並未把 `inputValue` 還原為瀏覽歷史前暫存於 `draft` 的內容。使用者原本正在輸入、尚未送出的內容因此遺失，輸入框會停留在被清空前最後瀏覽到的那筆歷史路徑文字上，且沒有任何跡象顯示這是殘留的歷史文字而非使用者自己輸入的內容。
> 但我本來就是預期 "符合「我想用這筆資料，但刪除其他歷史」的直覺"，所以或許更好的說法是 當使用者按下清空時：清空所有歷史紀錄。把輸入框目前的文字，直接變成新的草稿 這樣嗎? 請使用 AskUser 等工具收斂

- **scroll-spy 效果掛載時不會主動計算一次 `activeId`**：`+page.svelte:26-46` 的 `$effect` 只呼叫了 `container.addEventListener("scroll", onScroll, ...)`，沒有像 `autoHide.svelte.ts`（player 模組）的 `handleActivity()` 那樣在設置監聽器後立即手動執行一次計算。若瀏覽器或 SvelteKit 在導覽回此頁時恢復先前的捲動位置（非最頂端），`activeId` 會停留在初始值 `"collection"`，直到使用者再次手動觸發 `scroll` 事件才會被校正，導致導覽列反白的區塊與畫面實際顯示的區塊短暫不一致。
> 這確實會導致導覽列狀態不一致。我提供了一份我以前寫的技術文件 `docs/scroll.md`。雖然它處理的是帶有 URL hash 的 side panel 滾動同步，但其核心思想是利用 Svelte 5 的 `$derived` 覆寫機制（或優雅的資料流宣告）來自然解決初始化與邊際情況。請閱讀 `docs/scroll.md`，並幫我評估：**我們目前的 scroll-spy 是否能參考這種優雅的宣告式思路進行重構，以徹底解決掛載時未主動計算與潛在的同步邊際問題？

---

## 3. Edge Case 清單

- [ ] `databaseLoaded = false` 時僅顯示「圖片集路徑」區塊，導覽/scroll-spy 僅含單一項目 -> [已解決]
- [ ] 送出圖片集路徑成功後 `invalidateAll`，`databaseLoaded` 由 false 轉 true，`sections` 新增兩個區塊 -> [已解決]
- [ ] `api.post`/`api.get`/`api.del` 拋出例外（非回傳 `!ok`）-> 忙碌旗標永久卡住、無錯誤提示 -> [未解決]
- [ ] 刪除缺失記錄確認框開啟期間點擊「開始檢查」-> `missingList` 被覆寫，確認訊息數字與實際不符 -> [未解決]
- [ ] 刪除缺失記錄進行中，「開始檢查」按鈕誤顯示 `pending` -> [未解決]
- [ ] 瀏覽路徑歷史（ArrowUp/ArrowDown）中途手動編輯輸入框 -> 正確脫離歷史瀏覽狀態 -> [已解決]
- [ ] 瀏覽路徑歷史中途點擊「清空」-> 使用者原始輸入遺失、輸入框殘留歷史文字 -> [未解決]
- [ ] 路徑歷史達到上限 15 筆後繼續新增 -> 自動裁切最舊一筆 -> [已解決]
- [ ] 清空快取後 `cacheEntries`/`cacheBytes` 覆寫為 0，直到下次 load 才回到伺服器統計值 -> [已解決]
- [ ] 元資料補算數量與檢查時的 `metaMissing` 不同步（並發變動）-> `Math.max(0, ...)` 防止負值，但顯示數字可能與伺服器實際不同步 -> [未解決/待確認]
- [ ] 從瀏覽器返回 `/settings` 且捲動位置被還原至非頂端 -> `activeId` 未同步更新 -> [未解決]
- [ ] 備份下載失敗（`res.ok` 為 false 或 `fetch` 拋例外）-> 皆有對應 toast（模組內唯一具備完整 `try/catch` 的操作）-> [已解決]
