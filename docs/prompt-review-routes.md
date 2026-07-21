# 頁面拆分審查提示詞

本文件把每個路由（僅列出含 `+page.svelte` 者）拆成多份較小範圍的審查提示詞，取代「整頁一次審查」。拆分原則與沙盒限制沿用 [`docs/prompt_review_module.md`](./prompt_review_module.md)，差異只在於**每一份的審查範圍明確限縮到少數幾個檔案**，讓審查者能更深入檢查該範圍內的狀態機與副作用，而不會因為整頁範圍太大而漏掉細節。

## 拆分依據

- 依 [`docs/svelte_kit_routes.md`](./svelte_kit_routes.md) 描述的現行架構，每個路由的 `+page.svelte` 只負責依相依順序呼叫 `logic/` 底下各個 `create<Domain>Context()`。因此天然的拆分單位就是**每個 controller（context 領域）**，而非資料夾。
- 元件與 controller 常是多對多關係（例如一個元件同時 `getContext` 兩個不同領域）。這種元件會重複出現在多份提示詞中，每份只需專注在該次審查對應的那個 context 用法，其餘 context 一律視為外部依賴（100% 正確）。
- 以下情況不需要獨立成一份、也不在任何一份的審查範圍內：
  - `logic/page-data.svelte.ts`：純粹把 `load` 回傳的 `data` 包成 context，沒有狀態機或副作用，視為 100% 正確。
  - `+page.server.ts`：伺服器端 `load`，不屬於本文件鎖定的 client 端狀態/副作用/事件/條件渲染範疇。
  - 純樣式或無 `getContext` 的展示型元件（例如 `CardInfo.svelte` 之於純顯示），除非它出現在某個 controller 的元件清單中才會被納入。
- 每份提示詞最後都可能附一句「組裝順序檢查」，用來核對 `+page.svelte` 內 `create*Context()` 的呼叫順序是否符合各 controller 內部 `getXContext()` 的相依關係（相依關係已在各路由小節列出），這件事只需在該路由其中一份審查中做一次即可，不必每份重複。

## 建議份數總覽

| 路由 | 建議份數 | 理由 |
| --- | --- | --- |
| `(home)` | 3 | 3 個 controller（filter／layout／detail），彼此邊界清楚 |
| `compare` | 3 | 3 個 controller（filter／pinned／operations），pinned 與清單/卡片呈現合併看較完整 |
| `player` | 2 | 3 個 controller（playback／gesture／dock） |
| `settings` | 4 | 6 個 controller，依畫面既有的 3 個 section 分組，另加獨立的章節導覽（nav） |
| `staged` | 6 | 6 個 controller，彼此有明確單向相依（stamp/lightbox/review 依賴 editor），適合各自獨立審查 |
| `tags` | 6 | 7 個 controller，其中 operations 依賴 previews、被 board/review 依賴，併入 review 一起看較能追蹤操作鎖 |
| `tags/cleanup` | 4 | 5 個 controller（filter／samples／operations／schedule／review），operations 依賴 samples、被 schedule/review 依賴，併入 review 一起看較能追蹤操作鎖；schedule 承接離頁守衛，獨立成一份 |

輸出檔案建議統一寫到 `docs/review/<route>-<slug>.md`（資料夾若不存在請自行建立），避免多份審查互相覆蓋彼此的輸出。

---

## `(home)`（首頁 / 探索）

相依關係：`detail` 依賴 `filter`；`layout` 與 `filter` 互不相依。`+page.svelte` 建立順序為 `pageData → filter → layout → detail`。

### 1. filter（篩選／探索面板）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/(home)/logic/filter.svelte.ts
- src/routes/(home)/panel/Explore.svelte
- src/routes/(home)/panel/ExploreButtons.svelte
- src/routes/(home)/panel/ExploreFields.svelte
- src/routes/(home)/panel/ExploreHeader.svelte
- src/routes/(home)/panel/ExplorePanel.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getPageDataContext()（ExploreHeader 使用）
   - $lib/query-spec（ImageQuery、ImageWhere）、$lib/utils/search-params.svelte 的 syncedQuery
   - 路由參數、API 請求回傳結果
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/home-filter.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 2. layout（版面／欄數／Masonry）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/(home)/logic/layout.svelte.ts
- src/routes/(home)/panel/ColumnSelect.svelte
- src/routes/(home)/cards/MasonryWall.svelte
- src/routes/(home)/cards/ScrollButton.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getPageDataContext()（MasonryWall 使用）
   - svelte/reactivity/window 的 innerWidth、瀏覽器捲動/尺寸相關 API
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/home-layout.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 3. detail（詳情 Modal）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/(home)/logic/detail.svelte.ts
- src/routes/(home)/detail/DetailModal.svelte
- src/routes/(home)/cards/MasonryImage.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getFilterContext()、getPageDataContext()
   - $app/navigation 的 replaceState、$app/state 的 page
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。
4. **附帶檢查**：確認 `src/routes/(home)/+page.svelte` 中 `createFilterContext()` 是否確實排在 `createDetailContext()` 之前（detail 內部建構時會呼叫 `getFilterContext()`）。

## 輸出要求

請將完整分析寫入 `docs/review/home-detail.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

---

## `compare`（比對）

相依關係：`operations` 依賴 `pinned`。`+page.svelte` 建立順序為 `pageData → filter → pinned → operations`。

### 1. filter

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/compare/logic/filter.svelte.ts
- src/routes/compare/header/FilterButton.svelte
- src/routes/compare/header/FilterPopover.svelte
- src/routes/compare/header/Filters.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - $lib/query-spec 的 ImageQuery、$lib/utils/search-params.svelte 的 syncedQuery
   - 路由參數、API 請求回傳結果
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/compare-filter.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 2. pinned（釘選狀態 + 清單/卡片呈現）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/compare/logic/pinned.svelte.ts
- src/routes/compare/list/List.svelte
- src/routes/compare/list/ListHeader.svelte
- src/routes/compare/list/ListItem.svelte
- src/routes/compare/list/ListItems.svelte
- src/routes/compare/list/Panel.svelte
- src/routes/compare/cards/Card.svelte
- src/routes/compare/cards/CardHeader.svelte
- src/routes/compare/cards/Cards.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getPageDataContext()
   - $app/navigation 的 replaceState、$app/state 的 page
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/compare-pinned.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 3. operations（重新整理／取消提交 + 工具列）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/compare/logic/operations.svelte.ts
- src/routes/compare/cards/CardInfo.svelte
- src/routes/compare/header/Actions.svelte
- src/routes/compare/header/Toolbar.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getPinnedContext()（本檔案內部呼叫 handleUnpin，以及 Actions.svelte 顯示用）
   - $app/navigation 的 goto、API 請求回傳結果
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。
4. **附帶檢查**：確認 `src/routes/compare/+page.svelte` 中 `createPinnedContext()` 是否確實排在 `createOperationsContext()` 之前（operations 內部建構時會呼叫 `getPinnedContext()`）。

## 輸出要求

請將完整分析寫入 `docs/review/compare-operations.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

---

## `player`（播放器）

相依關係：`playback` 依賴 pageData；`gesture` 依賴 `playback`（透過 `getPlaybackContext()` 呼叫其 `handleTogglePlay`/`handleBoostStart`/`handleBoostEnd`、讀 `playing` 觸發反饋動畫）；`dock` 不依賴任何其他 controller。`+page.svelte` 建立順序為 `pageData → playback → gesture → dock`，`gesture` 的建構子內部會呼叫 `getPlaybackContext()`，因此必須晚於 `playback` 建立。

### 1. playback（播放狀態／引擎綁定／手勢判定／長按加速／連續播放）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/player/logic/player.core.ts
- src/routes/player/logic/playback.svelte.ts
- src/routes/player/logic/gesture.svelte.ts
- src/routes/player/logic/findMiddle.ts
- src/routes/player/strip/Strip.svelte
- src/routes/player/control/Dock.svelte
- src/routes/player/control/DockProgress.svelte
- src/routes/player/+page.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getPageDataContext()
   - $lib/image/client 的 blurhashStyle
   - $lib/utils/dom 的 isInEditable
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/player-playback.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 2. dock（控制列自動隱藏）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/player/logic/dock.svelte.ts
- src/routes/player/+page.svelte（僅 `{#if !dock.hideDock}` 這段條件渲染）

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - $lib/utils/shared 的 debounce
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/player-dock.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

---

## `settings`（設定）

相依關係：`nav`、`collection`、`cache` 依賴 `pageData`；`metadata`、`missing`、`backup` 彼此及與其他 controller 互不相依。`+page.svelte` 建立順序為 `pageData → nav → collection → cache → metadata → missing → backup`，彼此間沒有強制順序要求（皆各自獨立）。`ToolCard.svelte` 是無 context 的純展示元件，同時被 `CacheSection` 與 `MaintenanceSection` 使用，因此重複出現在第 2、3 份。

### 1. collection（圖片集路徑）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/settings/logic/collection.svelte.ts
- src/routes/settings/logic/path-history.ts
- src/routes/settings/sections/CollectionSection.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getPageDataContext()
   - $app/navigation 的 goto、$app/state 的 page、API 請求回傳結果、$lib/utils/storage 的 readJson/writeJson/removeKey
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/settings-collection.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 2. cache & metadata（圖片與快取）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/settings/logic/cache.svelte.ts
- src/routes/settings/logic/metadata.svelte.ts
- src/routes/settings/sections/CacheSection.svelte
- src/routes/settings/sections/ToolCard.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getPageDataContext()（cache.svelte.ts 使用）
   - API 請求回傳結果
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/settings-cache.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 3. maintenance（missing & backup，系統維護）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/settings/logic/missing.svelte.ts
- src/routes/settings/logic/backup.svelte.ts
- src/routes/settings/sections/MaintenanceSection.svelte
- src/routes/settings/sections/ToolCard.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - $app/navigation 的 goto、$app/state 的 page、API 請求回傳結果
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/settings-maintenance.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 4. nav（章節導覽／捲動同步）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/settings/logic/nav.svelte.ts
- src/routes/settings/nav/SectionNav.svelte
- src/routes/settings/+page.svelte（僅各 `<section>` 上的 `{@attach nav.observe}` 綁定部分）

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getPageDataContext()
   - $app/state 的 page、$app/navigation 的 replaceState、瀏覽器 IntersectionObserver API 本身行為
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/settings-nav.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

---

## `staged`（暫存區）

相依關係：`editor` 依賴 `operations`；`stamp`、`lightbox`、`review` 依賴 `editor`；`review` 同時依賴 `operations`；`import` 依賴 `operations`。`+page.svelte` 建立順序為 `pageData → operations → editor → stamp → lightbox → review → import`。

### 1. editor（草稿狀態機／欄位編輯／離頁守衛）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/staged/logic/editor.svelte.ts
- src/routes/staged/logic/draft.ts
- src/routes/staged/cards/Card.svelte（僅 editor 相關部分，stamp 相關部分不在本次範圍）
- src/routes/staged/cards/CardInfo.svelte
- src/routes/staged/cards/Cards.svelte（僅 editor 相關部分）
- src/routes/staged/cards/config.ts
- src/routes/staged/inspector/Inspector.svelte（僅 editor 相關部分，lightbox 相關部分不在本次範圍）
- src/routes/staged/inspector/InspectorFields.svelte
- src/routes/staged/inspector/InspectorHeader.svelte
- src/routes/staged/inspector/InspectorFooter.svelte（僅 editor 相關部分，stamp/operations 相關部分不在本次範圍）
- src/routes/staged/header/SessionProgress.svelte
- src/routes/staged/+page.svelte（僅 `beforeNavigate(editor.handleBeforeNavigate)` 與 `onbeforeunload={editor.handleBeforeUnload}` 這兩處綁定）

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getPageDataContext()、getOperationsContext()
   - $app/navigation 的 goto、$app/state 的 page、API 請求回傳結果
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/staged-editor.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 2. stamp（圖章模式）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/staged/logic/stamp.svelte.ts
- src/routes/staged/cards/StampBadge.svelte
- src/routes/staged/cards/Card.svelte（僅 stamp 相關部分）
- src/routes/staged/cards/Cards.svelte（僅 stamp 相關部分）
- src/routes/staged/inspector/InspectorFooter.svelte（僅 stamp 相關部分）

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getEditorContext()（包含其暴露的 draft 狀態與方法本身的正確性）
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug，特別是「圖章模式」如何跨多筆 draft 套用欄位值的一致性。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/staged-stamp.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 3. lightbox（圖片燈箱）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/staged/logic/lightbox.svelte.ts
- src/routes/staged/inspector/Lightbox.svelte
- src/routes/staged/inspector/Inspector.svelte（僅 lightbox 相關部分）

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getPageDataContext()、getEditorContext()
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/staged-lightbox.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 4. review（送審 Modal／差異計算／提交）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/staged/logic/review.svelte.ts
- src/routes/staged/logic/review-entry.ts
- src/routes/staged/review/ReviewFooter.svelte
- src/routes/staged/review/ReviewHeader.svelte
- src/routes/staged/review/ReviewImpact.svelte
- src/routes/staged/review/ReviewList.svelte
- src/routes/staged/review/ReviewListItem.svelte
- src/routes/staged/review/ReviewModal.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getPageDataContext()、getEditorContext()、getOperationsContext()、getLightboxContext()
   - `./draft` 的 commitDrafts/problemOf、$app/navigation 的 goto、API 請求回傳結果
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/staged-review.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 5. import（匯入流程）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/staged/logic/import.svelte.ts
- src/routes/staged/logic/import-api.ts
- src/routes/staged/header/ImportModal.svelte
- src/routes/staged/header/ImportGuide.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getOperationsContext()
   - $app/navigation 的 goto、$lib/utils/shared 的 formatError/isRecord
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug，特別是匯入進度（ImportProgress）更新與中途取消/失敗時的狀態收斂。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/staged-import.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 6. operations & 工具列（含組裝順序檢查）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/staged/logic/operations.svelte.ts
- src/routes/staged/header/Toolbar.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getEditorContext()、getImportContext()、getReviewContext()（Toolbar 使用）
   - $app/navigation 的 goto、API 請求回傳結果
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug，特別是 `pending` 操作鎖的設置/釋放是否所有路徑都成對。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。
4. **附帶檢查**：核對 `src/routes/staged/+page.svelte` 內 `create*Context()` 的呼叫順序，是否符合以下相依關係：`editor` 需在 `operations` 之後；`stamp`、`lightbox`、`review` 需在 `editor` 之後；`review`、`import` 需在 `operations` 之後。

## 輸出要求

請將完整分析寫入 `docs/review/staged-operations.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

---

## `tags`（標籤管理）

相依關係：`operations` 依賴 `previews`；`board` 依賴 `operations`；`drag` 依賴 `board` 與 `selection`；`review` 依賴 `board`、`operations`、`previews`。`+page.svelte` 建立順序為 `pageData → previews → operations → query → selection → board → drag → review`。`board.handleBeforeNavigate` 與 `board.handleBeforeUnload` 是本頁的離頁守衛，掛在 `+page.svelte`。

### 1. query（查詢／分頁／工具列）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/tags/logic/query.svelte.ts
- src/routes/tags/header/Filters.svelte（僅 query 相關部分，selection 相關部分不在本次範圍）
- src/routes/tags/header/Toolbar.svelte
- src/routes/tags/chips/Pagination.svelte
- src/routes/tags/chips/Chips.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getPageDataContext()、getSelectionContext()
   - $app/state 的 navigating、$lib/query-spec 的 TagQuery、$lib/utils/search-params.svelte 的 syncedQuery
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug，特別是換頁/篩選後 `Chips.svelte` 捲動歸零的時機是否正確。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/tags-query.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 2. selection（多選狀態）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/tags/logic/selection.svelte.ts
- src/routes/tags/header/Filters.svelte（僅 selection 相關部分）
- src/routes/tags/chips/Chip.svelte（僅 selection 相關部分，board/drag/previews 相關部分不在本次範圍）
- src/routes/tags/zone/ZoneBodyCreate.svelte（僅 selection 相關部分）
- src/routes/tags/zone/ZoneHeader.svelte（僅 selection 相關部分）

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getBoardContext()、getDragContext()、getPreviewsContext()（在共用元件中出現、但不屬於本次審查標的的部分）
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/tags-selection.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 3. previews（懸浮預覽）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/tags/logic/previews.svelte.ts
- src/routes/tags/chips/Chip.svelte（僅 previews 相關部分）
- src/routes/tags/chips/ChipTooltip.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - $lib/query-spec（ImageQuery、ImageWhere、ListOptions）、API 請求回傳結果
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug，特別是預覽快取（SvelteMap）的填充/淘汰時機、多次快速 hover 時是否有過期回應覆蓋新資料的問題。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/tags-previews.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 4. board（異動區看板：合併／刪除／隱藏 + 離頁守衛）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/tags/logic/board.svelte.ts
- src/routes/tags/zone/ZoneBodyCreate.svelte（僅 board 相關部分）
- src/routes/tags/zone/ZoneBodyDelete.svelte
- src/routes/tags/zone/ZoneBodyGroup.svelte
- src/routes/tags/zone/ZoneBodyHidden.svelte
- src/routes/tags/zone/ZoneHeader.svelte（僅 board 相關部分）
- src/routes/tags/+page.svelte（僅 `beforeNavigate(board.handleBeforeNavigate)` 與 `onbeforeunload={board.handleBeforeUnload}` 這兩處綁定）

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getOperationsContext()
   - $app/navigation 的 goto、$app/state 的 page、API 請求回傳結果
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug，特別是：
   - 合併區 `queryMergeCount` 的 debounce/seq 機制是否確實避免過期回應覆蓋
   - `removeGroup` 是否為清 timer 與移除資料的唯一入口、有無遺漏呼叫路徑
   - `detachTag` 在標籤同時可能落在多個區域時的邊界情況
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。
4. **附帶檢查**：核對 `src/routes/tags/+page.svelte` 內 `create*Context()` 的呼叫順序，是否符合以下相依關係：`operations` 需在 `previews` 之後；`board` 需在 `operations` 之後；`drag` 需在 `board`、`selection` 之後；`review` 需在 `board`、`operations`、`previews` 之後。

## 輸出要求

請將完整分析寫入 `docs/review/tags-board.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 5. drag（拖放機制）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/tags/logic/drag.svelte.ts
- src/routes/tags/zone/ZoneContainer.svelte
- src/routes/tags/chips/Pool.svelte
- src/routes/tags/chips/Chip.svelte（僅 drag 相關部分）

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getBoardContext()、getSelectionContext()（呼叫其方法時視為正確執行）
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug，特別是 `ondragover`/`ondragleave`/`ondrop` 之間 `overKey` 狀態的一致性、事件冒泡判斷（`relatedTarget`/`currentTarget`）是否正確、拖曳中途取消（如按 Esc）是否有殘留狀態。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/tags-drag.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 6. review & operations（送審／提交 + 全域操作鎖）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/tags/logic/review.svelte.ts
- src/routes/tags/logic/review-entry.ts
- src/routes/tags/logic/changeset.ts
- src/routes/tags/logic/operations.svelte.ts
- src/routes/tags/review/ReviewFooter.svelte
- src/routes/tags/review/ReviewHeader.svelte
- src/routes/tags/review/ReviewImpact.svelte
- src/routes/tags/review/ReviewList.svelte
- src/routes/tags/review/ReviewListItem.svelte
- src/routes/tags/review/ReviewModal.svelte
- src/routes/tags/header/Actions.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getBoardContext()、getPreviewsContext()（含其暴露的 `touchedCount`、`operations` 等衍生值）
   - $app/navigation 的 goto、API 請求回傳結果
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug，特別是 `operations.pending` 操作鎖的設置/釋放是否所有路徑都成對、`changeset` 送出後與看板狀態的收斂時機。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/tags-review.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

---

## `tags/cleanup`（標籤清理工具）

相依關係：`operations` 依賴 `samples`；`schedule` 依賴 `operations`；`review` 依賴 `schedule`、`operations`、`samples`；`filter` 依賴 `pageData`，與其他 controller 互不相依。`+page.svelte` 建立順序為 `pageData → samples → operations → schedule → filter → review`。`schedule.handleBeforeNavigate` 與 `schedule.handleBeforeUnload` 是本頁的離頁守衛，掛在 `+page.svelte`；`review.handleOpen` 也由 `+page.svelte` 的全域快捷鍵（Ctrl/Cmd+S）觸發。`logic/suggestions.ts`（建議引擎）只在 `+page.server.ts` 被呼叫，client 端各檔案僅引用其 `Suggestion` 型別，因此視為外部依賴、不在任何一份的審查範圍內。

### 1. filter（分類頁籤／忽略狀態 + 卡片牆虛擬化）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/tags/cleanup/logic/filter.svelte.ts
- src/routes/tags/cleanup/header/Filters.svelte
- src/routes/tags/cleanup/header/Toolbar.svelte
- src/routes/tags/cleanup/cards/Cards.svelte
- src/routes/tags/cleanup/cards/config.ts
- src/routes/tags/cleanup/cards/CardHeader.svelte（僅 filter 相關部分，schedule 相關部分不在本次範圍）

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getPageDataContext()
   - getScheduleContext()（CardHeader.svelte 內用於顯示「已排入」標記，僅供辨識、非本次審查標的）
   - $lib/utils/virtualize.svelte 的 Virtualizer、svelte/reactivity/window 的 innerWidth
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug，特別是分類頁籤切換後 `Virtualizer` 的 `items`（`layoutItems`）與底層 `filter.visible` 是否確實同步、忽略（dismiss）後的清單重算與虛擬化 windowing 邊界情況。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/tags-cleanup-filter.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 2. samples（建議卡片證據縮圖）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/tags/cleanup/logic/samples.svelte.ts
- src/routes/tags/cleanup/cards/CardSamples.svelte

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - $lib/query-spec（ImageQuery、ImageWhere、ListOptions）、API 請求回傳結果
   - $lib/image/client 的 imgSrc、blurhashStyle
   - `Suggestion` 型別（來自 `./suggestions`，純型別引用，建構邏輯屬伺服器端、不在本次範圍）
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug，特別是預覽快取（SvelteMap）的填充/淘汰時機、卡片因虛擬化快速捲入捲出可視範圍時，延遲請求（150ms）與快取狀態是否可能讓過期回應覆蓋新資料或重複發出請求。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/tags-cleanup-samples.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 3. schedule（標籤清理排程狀態機 + 離頁守衛）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/tags/cleanup/logic/schedule.svelte.ts
- src/routes/tags/cleanup/cards/Card.svelte
- src/routes/tags/cleanup/cards/CardFooter.svelte
- src/routes/tags/cleanup/cards/CardHeader.svelte（僅 schedule 相關部分，filter 相關部分不在本次範圍）
- src/routes/tags/cleanup/+page.svelte（僅 `beforeNavigate(schedule.handleBeforeNavigate)` 與 `onbeforeunload={schedule.handleBeforeUnload}` 這兩處綁定）

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getOperationsContext()（僅用於 `pending` 操作鎖判斷）
   - $app/navigation 的 goto、$app/state 的 page、confirm-events 的 requestConfirm、toast-events 的 addToast
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug，特別是「同一標籤只能有一種排程」時 `clear()` 是否所有寫入路徑（合併／刪除／隱藏）都有先呼叫、離頁守衛（`handleBeforeNavigate`／`handleBeforeUnload`）在「操作進行中」與「有未送出排程」兩種情況下的判斷與提示是否正確。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。

## 輸出要求

請將完整分析寫入 `docs/review/tags-cleanup-schedule.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```

### 4. review & operations（送審 Modal／差異計算／提交 + 全域操作鎖，含組裝順序檢查）

```
# 任務：獨立模組邏輯獨立沙盒審查（Sandboxed Code Review）

請針對以下範圍進行**純粹的內部邏輯審查**：
- src/routes/tags/cleanup/logic/review.svelte.ts
- src/routes/tags/cleanup/logic/review-entry.ts
- src/routes/tags/cleanup/logic/changeset.ts
- src/routes/tags/cleanup/logic/operations.svelte.ts
- src/routes/tags/cleanup/header/Actions.svelte
- src/routes/tags/cleanup/review/ReviewFooter.svelte
- src/routes/tags/cleanup/review/ReviewHeader.svelte
- src/routes/tags/cleanup/review/ReviewList.svelte
- src/routes/tags/cleanup/review/ReviewListItem.svelte
- src/routes/tags/cleanup/review/ReviewModal.svelte
- src/routes/tags/cleanup/+page.svelte（僅 `handleKeydown` 中 Ctrl/Cmd+S 觸發 `review.handleOpen()` 的部分）

## 審查核心限制

1. **隔離外部依賴**：完全假設以下皆 100% 正確、不需驗證：
   - getScheduleContext()（含其暴露的 `operations`、`touchedCount`、`statusOf`、`handleUndo` 等）
   - getSamplesContext()（僅呼叫 `clear()`）
   - $app/navigation 的 goto、API 請求回傳結果、toast-events 的 addToast
2. **專注內部狀態與流程**：只審查上述範圍內的邏輯、狀態機變化、副作用觸發時機、事件處理、條件渲染是否有 Bug，特別是 `operations.pending` 操作鎖的設置/釋放是否所有路徑都成對、送出後失敗匯總（`failures`）與排程狀態（透過 `schedule.handleUndo`）的收斂時機、`changeset.ts` 的 payload 轉換是否遺漏邊界情況。
3. **拒絕外部文件對比**：不比對遷移文件、規格書，純以當前程式碼靜態分析。
4. **附帶檢查**：核對 `src/routes/tags/cleanup/+page.svelte` 內 `create*Context()` 的呼叫順序，是否符合以下相依關係：`samples` 需在 `operations` 之前；`operations` 需在 `schedule` 之前；`schedule`、`operations`、`samples` 皆需在 `review` 之前。

## 輸出要求

請將完整分析寫入 `docs/review/tags-cleanup-review.md`，包含：
1. **結構簡述**：ASCII 方塊圖，範圍僅限上述檔案。
2. **內部 Bug 審查**：條列具體 Bug（Race Condition、記憶體洩漏、未處理例外、錯誤狀態更新等）。【禁止】給修復代碼或步驟，僅指出問題點。
```
