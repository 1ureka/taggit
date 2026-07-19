# Home 頁面路由（`(home)`）— 內部邏輯沙盒審查

審查範圍：`src/routes/(home)/**`（`+page.server.ts`、`+page.svelte`、`wall/*`、`panel/*`、`detail/*`）。
依審查限制，所有外部套件（`$lib/*`、`Masonry`、`Modal`、`imgSrc`、`ImageQuery`/`ImageWhere`/`ListOptions`）、路由參數與 API/DB 查詢結果皆視為 100% 正確且符合預期，僅分析目標模組內部的狀態機、副作用時機、事件處理與條件渲染。

---

## 1. 結構簡述

```
(home)/
├── +page.server.ts                 (load: items / total；資料庫未載入時 redirect → /settings)
│
└── +page.svelte                    (根：layout/columns、detail modal 狀態、左側面板收合)
    │   state 來源：
    │     - page.state（{modal, modalClose}，由 replaceState 寫入，shallow routing）
    │     - page.url.searchParams（modal 參數，僅作 SSR 首次取值的備援）
    │   derived: layout / columns / record / recordHref
    │   effect:  行動裝置寬度時強制收合左側面板（一次性，見 Bug 3）
    │   handler: handleSelect / handleModalClose（replaceState）、handleTogglePanel
    │
    ├── wall/
    │   ├── MasonryWall.svelte           (Masonry 版面 + empty 狀態 + onselect 轉發)
    │   │   └── MasonryImage.svelte          (純展示卡片，onclick → onselect(id))
    │   ├── ScrollButton.svelte          (捲動監聽 + popover 顯示；show 衍生內含副作用，見 Bug 5)
    │   └── config.ts                    (breakpoints：欄數 / padding / gap)
    │
    ├── panel/
    │   ├── ExplorePanel.svelte          (容器 + bind:columns 轉發 + 面板收合按鈕宿主)
    │   ├── ExploreFields.svelte         (search/tags/rating/sort 表單；唯一的 apply()→goto 提交點，見 Bug 1、2)
    │   ├── ColumnSelect.svelte          (欄數選單，bind:columns，見 Bug 4)
    │   └── ExploreButtons.svelte        (播放／比較連結，直接讀 page.url.search)
    │
    └── detail/
        └── DetailModal.svelte           (native <dialog> 詳情；handleTagSelect 另開一條獨立 goto，見 Bug 2)
```

資料流重點：

- **`record`（detail modal 是否開啟）**：`+page.svelte` 的 `$derived.by`，優先讀 `page.state.modal`（CSR／shallow routing 寫入），退回讀 `page.url.searchParams.get("modal")`（SSR 首次載入備援）。開／關皆透過 `replaceState()`（shallow routing），全程不觸發 `load` 重跑。
- **篩選條件（search/tags/rating/sort/order）**：`ExploreFields.svelte` 內以可覆寫的 `$derived` 個別宣告，來源皆為 `ImageQuery.fromSearchParams(page.url.searchParams)`；使用者互動（`bind:value`/`bind:tags`）先就地覆寫本地值，再由共用的 `apply()` 一次性組出查詢字串、呼叫 `goto()` 寫回 URL，`load` 重跑後兩者才重新對齊。
- **`columns`（圖片牆欄數）**：`+page.svelte` 依視窗寬度用斷點表衍生預設值，`ColumnSelect.svelte` 透過雙向綁定就地覆寫，純前端狀態，不寫回 URL。

---

## 2. 內部 Bug 審查

- **`ExploreFields` 的欄位是裸 `$derived` 直接掛在 `page.url.searchParams` 下，沒有本地緩衝／echo 比對，會被自己稍早、較慢完成的 `goto()` 覆蓋**：`search`/`includedTags`/`excludedTags`/`ratingKey`/`ratingOpKey`/`sortKey`/`orderKey`（`panel/ExploreFields.svelte:15-21`）皆是 `$derived(query.where.xxx)` 形式，`query` 本身衍生自 `page.url.searchParams`（`panel/ExploreFields.svelte:13`）。使用者輸入（`SearchInput`/`TagInput` 的 `bind:value`/`bind:tags`）會就地覆寫這些可覆寫的 `$derived`，但覆寫值只在其依賴（`query`，進而是 `page.url.searchParams`）不變時才會保留。`apply()`（`panel/ExploreFields.svelte:29-46`）呼叫 `goto()` 是非同步的，且呼叫端完全不等待前一次 `goto()` resolve、也沒有任何停用輸入框的機制（`SearchInput`/`TagInput` 在導覽期間仍可繼續輸入）。只要使用者在前一次 `apply()` 觸發的 `goto()` 尚未 resolve 前又觸發下一次輸入（例如連續打字、連續增刪標籤），一旦較早那次 `goto()` 之後才真正完成、使 `page.url.searchParams` 變動，`query`／`search` 等衍生值會被重新計算並用「較舊」的 URL 值覆蓋使用者這段期間已經打好、但還沒被送出的最新本地值——即使當下已經有一個較新的 `apply()`/`goto()` 正在等待中。這正是本模組沒有採用 `syncedSearchParam`/`syncedQuery` 一類 echo 緩衝機制、單純裸用可覆寫 `$derived` 所會踩到的亂序覆蓋問題。
> 真實問題

- **模組內存在多個彼此不協調、互不等待的導覽呼叫點，覆寫彼此的 URL／清空彼此的 `page.state`**：`+page.svelte` 的 `handleSelect`/`handleModalClose`（`+page.svelte:48-59`，`replaceState`）、`ExploreFields.apply()`（`panel/ExploreFields.svelte:45`，`goto`）、`DetailModal.handleTagSelect`（`detail/DetailModal.svelte:47-49`，`goto`）三者各自獨立建構 URL 並各自呼叫導覽 API，彼此不知道對方是否有呼叫在途，也都沒有互相等待或取消。三者呼叫 `goto()`/`replaceState()` 時也都沒有帶入 `state: page.state`，一旦有任何一次 `goto()` 完成，`page.state` 會被重置，連帶使當下若有已開啟的 detail modal（其開關狀態依賴 `page.state.modal`，見 `+page.svelte:25-34`）在使用者毫無關閉意圖的情況下被靜默關閉；另外 `ExploreFields.apply()` 建構新 URL 時是以 `page.url.searchParams` 當作基底（`panel/ExploreFields.svelte:43`）保留「未管理」的參數（例如 `modal`），但 `page.url` 在 shallow routing 之後不會再被 `replaceState` 更新，一旦 `apply()` 呼叫當下 `modal` 已經透過 `replaceState` 寫進 `location` 但尚未反映到 `page.url`，套用篩選條件送出的新 URL 就會把 `modal` 參數整個漏掉。三者資源競爭、覆寫的具體結果完全取決於哪個非同步呼叫最後 resolve，是純粹依賴時機、不會報錯的靜默狀態遺失。
> 根據 docs/structure.md 重寫後應該會消失

- **`+page.svelte` 內強制收合左側面板的 `$effect` 讀取非響應式的 `window.innerWidth`，只會在掛載時執行一次**：`+page.svelte:63-67` 的 `$effect(() => { if (window.innerWidth < 600) {...} })` 直接讀取瀏覽器原生 `window.innerWidth`，而非同檔案 `+page.svelte:17` 已在用、真正具響應性的 `innerWidth.current`（`svelte/reactivity/window`）。因為這個 effect 沒有讀取任何 rune，Svelte 不會在視窗尺寸改變時重新執行它，行為上等同於只在初次掛載時跑一次的 `onMount`。結果是：頁面於桌面尺寸掛載後，使用者再把視窗縮小跨過 600px 斷點，面板不會被自動收合；反之若在行動裝置尺寸掛載、之後放大視窗，面板會維持強制收合（`--left-panel-width` 被鎖在 `"0px"`），不會自動恢復展開，只能靠 `handleTogglePanel` 手動切換來間接「修正」。
> 預期行為，不是 bug

- **`columns` 的使用者手動選擇，會在視窗尺寸跨越版面斷點時被靜默覆蓋**：`columns` 宣告為 `$derived(layout.cols)`（`+page.svelte:21`），`layout` 本身是依 `innerWidth.current` 對照 `breakpoints` 表算出的物件（`+page.svelte:16-19`）。`ColumnSelect.svelte` 透過 `bind:columns` 鏈路（`panel/ExplorePanel.svelte:13,23` → `panel/ColumnSelect.svelte:21`）讓使用者手動覆寫這個可覆寫的 `$derived`，但覆寫值只在 `layout`（其依賴）維持不變時才保留。只要視窗尺寸調整跨越任一斷點門檻（不需要使用者主動去動欄數設定，單純調整視窗大小、或側邊工具列擠壓可視寬度都可能觸發），`layout` 重新計算出新的物件，`columns` 的覆寫值就會被直接丟棄、退回該斷點的預設欄數，使用者先前手動選擇的欄數設定在不知情下被重置。
> 預期行為，不是 bug

- **`ScrollButton.svelte` 的 `show` 衍生值內含副作用（呼叫 `showPopover()`），把命令式 DOM 操作綁在 `$derived` 的重算時機上**：`show`（`wall/ScrollButton.svelte:22-29`）宣告成 `$derived.by`，但其計算本體在滿足 `scrollTop > 300` 時會直接呼叫 `popoverEl?.showPopover()`。`$derived` 理應是純粹的值計算，這裡卻讓一個具備真實副作用的指令式呼叫綁定在 Svelte 內部的相依追蹤／重算排程上，而不是使用專門處理副作用的 `$effect`。由於捲動事件在超過門檻後仍會持續觸發（`scrollTop` 持續變動），只要 `scrollTop` 仍大於 300，這段函式本體就會隨每次捲動反覆重新執行、反覆嘗試呼叫 `showPopover()`（雖有 `:popover-open` 判斷擋下重複呼叫本身不拋錯，但呼叫時機已完全交給 Svelte 的重算排程決定，而非顯式的「開啟」意圖）；同時 `showPopover()` 這個「開啟」動作與其內容（`{#if show}` 區塊的 `fly` 轉場子節點）究竟何時真正掛載，兩者的時序不再由同一處程式碼保證同步，是把「讀取／計算」與「寫入／執行」耦合在一起的內部狀態管理問題。
> 預期行為，不是 bug

> modal shallow routing 改成與 compare 路由一樣不特別用 page.state

> (home)/wall 改名為 (home)/cards，但組件名稱不用變，ScrollButton 的放置位置可以再思考，/panel, /detail 這兩個名稱也可以再思考，還沒收斂
