# Tags 頁面路由 — 內部邏輯沙盒審查

審查範圍：`src/routes/tags/**`（`+page.server.ts`、`+page.svelte`、`header/*`、`chips/*`、`zone/*`、`review/*`、`logic/*`）。
依審查限制，所有外部套件（`$lib/*`、`api`、`imgSrc`、`requestConfirm`、`tooltip`）、路由參數與 API 回傳結果皆視為 100% 正確且符合預期，僅分析目標模組內部的狀態機、副作用時機、事件處理與條件渲染。

---

## 1. 結構簡述

```
tags/
├── +page.server.ts                 (load: items / total；池固定含 count 0 標籤，limit 預設 100)
│
└── +page.svelte                    (根：全頁狀態中樞 + 所有事件處理器)
    │   state:  pending / reviewOpen / failures / deleteList / hiddenList /
    │           dragging / draggingOver / groups(SvelteMap) / checkedTags(SvelteSet) /
    │           selectedTags(SvelteMap) / timers(plain Map，debounce/seq 表)
    │   derived: chipStatus / reviewEntries
    │
    ├── header/
    │   ├── Toolbar.svelte           (組合 Filters + Actions；handleQuery 轉發查詢字串)
    │   ├── Filters.svelte           (搜尋 / 排序 / 隱藏篩選 → onchange(TagQuery))
    │   └── Actions.svelte           (重新整理 / 清理工具連結 / 「檢視變更」按鈕)
    │
    ├── chips/
    │   ├── Pool.svelte              (標籤池容器 + 拖放目標 "pool")
    │   │   ├── Chips.svelte             (捲動至頂 $effect；逐一渲染 Chip)
    │   │   │   └── Chip.svelte              (可拖曳來源；hover 顯示 ChipTooltip)
    │   │   │       └── ChipTooltip.svelte      (150ms 去抖後呼叫 requestPreview)
    │   │   └── Pagination.svelte        (page 讀寫 URL search params)
    │   └── previews.ts              (previewCache：模組層級單例快取)
    │
    ├── zone/                        (aside：建立合併堆 / 既有合併堆 / 刪除區 / 隱藏區，皆為拖放目標)
    │   ├── ZoneContainer.svelte         (dropping 樣式；轉發 ondragover/ondragleave/ondrop)
    │   ├── ZoneHeader.svelte            (加入選取中的標籤 / 解散整組)
    │   ├── ZoneBodyCreate.svelte        (建立合併堆按鈕)
    │   ├── ZoneBodyGroup.svelte         (bind:rename；chip 移除／設為 canonical)
    │   ├── ZoneBodyDelete.svelte        (刪除區 chip 列表)
    │   └── ZoneBodyHidden.svelte        (隱藏切換區 chip 列表)
    │
    ├── review/
    │   ├── ReviewModal.svelte           (entries.length === 0 顯示空狀態)
    │   │   ├── ReviewHeader.svelte
    │   │   ├── ReviewList.svelte            (bulkSelectionState 由 checkedCount/readyCount 衍生；inert 遮罩)
    │   │   │   └── ReviewListItem.svelte        (勾選 / 捨棄 / problem 顯示)
    │   │   │       └── ReviewImpact.svelte         (依 kind 顯示影響敘述)
    │   │   └── ReviewFooter.svelte          (取消 / 送出；文字與 disabled 皆用 checked prop)
    │   └── reviewEntry.ts                (buildReviewEntries / toggleEntry / toggleAllEntries)
    │
    └── logic/
        ├── changeset.ts              (changesetFromBoard：畫布 → TagChangeset，僅送出當下呼叫一次)
        └── api.ts                    (submitChangeset：POST tags-batch，回傳 name→錯誤 的 Map)
```

資料流重點：

- **畫布（`groups` / `deleteList` / `hiddenList`）是唯一可寫資料源**：`chipStatus`、`reviewEntries` 全部由它衍生。同一標籤只能落在一處，靠 `detachTag` 在任何轉移前先行移除來保證互斥。
- **`checkedTags`（Review Modal 勾選）**：`handleReviewOpen` 不會重置它（允許跨開合保留選取），但只要呼叫到 `detachTag`，函式內第一行就會無條件 `checkedTags.clear()`——不論被移除的標籤是否真的在勾選集合裡。
- **`pending`（全頁鎖）**：只在 `handleReviewSubmit`、`handleRefresh` 兩處設置，`beforeNavigate` / `onbeforeunload` 的離開判斷只看 `reviewEntries.length`，`Actions.svelte` 的「檢視變更」按鈕也只看 `touchedCount`。
- **`timers`（合併堆張數查詢的 debounce/seq 表）**：以 `group.id` 為 key，只在元件整體卸載的 `$effect` cleanup 中被清空；群組被拆解或標籤被移出的路徑都沒有對應清理。

---

## 2. 內部 Bug 審查

- **篩選 / 排序 / 隱藏條件改變時未重置分頁頁碼**：`Filters.svelte` 的 `handleSearch`（22–24）、`handleSortChange`（26–30）、`handleFilterChange`（32–36）都是以「保留目前 `query.list` 或 `query.where`、只覆寫變動欄位」的方式建立新 `TagQuery`，從未把 `list.page` 重置為 1；`Toolbar.svelte` 的 `handleQuery`（27–30）也只是原樣轉發。若使用者停留在第 3 頁時變更搜尋字／排序／隱藏篩選，新條件下若結果不足 3 頁，`+page.server.ts` 仍會用舊的 `page` 去查，導致 `Pool`/`Chips` 顯示「沒有符合的標籤」，而 `Pagination` 同時顯示「第 3 / 1 頁 · 共 N 個」——實際上有符合條件的標籤，只是被卡在不存在的頁碼上看不到。
> 真實問題

- **`handleRefresh` 缺少 `catch`**：`+page.svelte:329–342` 只有 `try { … } finally { pending = false; }`。`invalidateAll()` 若拋出例外，`pending` 會經 `finally` 正確解鎖，但整個流程靜默中斷、不會有任何錯誤提示給使用者。
> 真實問題

- **`beforeNavigate` / `onbeforeunload` 未將 `pending` 納入離開判斷**：`beforeNavigate`（348–367）僅在 `reviewEntries.length > 0` 時才 `nav.cancel()`；`handleBeforeUnload`（344–346）同樣只檢查 `reviewEntries.length`。`handleRefresh` 進行中（`pending = true`）時若畫布是空的（`reviewEntries.length === 0`），使用者可以直接切換路由，`handleRefresh` 裡「等待 200ms → `invalidateAll()` → `clearPreviews()` → `addToast(...)`」這段延續會在離開後的新頁面情境下繼續跑完，對已卸載/已切換路由的狀態寫入 `pending = false` 並跳出「標籤列表已更新」的跨頁 toast。即使 `reviewEntries.length > 0` 觸發了確認框、使用者確認離開，`goto(to.url.href)` 也會在 `handleRefresh` 的 in-flight 續程仍未完成時就先行導覽，效果相同。
> 真實問題

- **`onbeforeunload` 只呼叫 `e.preventDefault()`，未設定 `e.returnValue`**：`handleBeforeUnload`（`+page.svelte:344–346`）僅 `e.preventDefault()`；部分瀏覽器要求同時設定 `e.returnValue` 才會實際顯示離開確認對話框。
> 目前沒有問題，但可以順便加

- **`Actions.svelte` 的「檢視變更」主按鈕未納入 `pending`**：`Actions.svelte:38` 的 `status` 只判斷 `touchedCount === 0`，而同一元件內「重新整理」按鈕（26）明確用 `pending` 控制 `status="pending"`。當 `handleRefresh` 進行中、畫面上並無任何遮蔽元素時，「檢視變更」仍可點擊並執行 `handleReviewOpen`（`+page.svelte:280–283`，本身也未檢查 `pending`）開啟 Review Modal；但 `handleReviewClose`（285–287）以 `if (!pending) reviewOpen = false` 擋住關閉，`ReviewFooter` 的「取消」按鈕同時因 `status={pending ? "disabled" : undefined}` 呈現不可點擊，使用者在這段期間內完全無法關閉剛打開的 Modal。
> 真實問題

- **`detachTag` 無條件 `checkedTags.clear()`，被審查清單內的「捨棄」動作牽連**：`detachTag`（`+page.svelte:110–128`）第一行就是 `checkedTags.clear()`，不論被移除的標籤是否存在於任何群組/區域、也不論它是否真的在 `checkedTags` 裡。`ReviewListItem` 的「捨棄」按鈕（Review Modal 內、`discardable={!pending}` 全程可用）觸發 `handleReviewDiscard(tag)`（297–299）→ `detachTag(tag)`。也就是說，使用者在 Review Modal 中勾選了多筆操作後，只要對其中「任何一筆」按下捨棄，整個 `checkedTags` 集合會被整批清空，其餘已勾選但未捨棄的項目也會一併變成未勾選——而不是只移除被捨棄的那一筆。
> 真實問題，但問題本身不用解決，因為之後會實現每次打開審查 modal 時都自動全選可選取的項目

- **`checkedCount` 取自原始 `checkedTags.size`，與逐列 `entry.checked` 的資料來源不一致，在「全部送出失敗」時會脫節**：`+page.svelte:442` 傳給 `ReviewModal` 的 `checkedCount={checkedTags.size}`，但每列的勾選狀態（`ReviewListItem` 用的 `entry.checked`）是由 `reviewEntry.ts:90–96` 的 `finish()` 依 `checkable && checkedTags.has(name)` 算出。`handleReviewSubmit`（301–325）只有在 `okNames`（送出成功者）非空時才逐一呼叫 `detachTag(n)` 清空 `checkedTags`（311–312）；若這次送出的項目「全部失敗」（`okNames.length === 0`），這個清空迴圈完全不會執行，`checkedTags` 原封不動保留所有原本勾選的名稱，即使這些項目的 `problem` 已因 `failures[name]` 變成「送出失敗：…」而 `checkable = false`、逐列 checkbox 也因此顯示未勾選。結果是 `ReviewFooter.svelte:20` 的送出按鈕仍以 `checked`（即這個過期的 `checkedTags.size`）顯示「送出 N 筆操作」且 `status` 未落入 `disabled` 分支（因 `checked !== 0`），呈現一顆看起來可點擊、數字不為零的按鈕，實際點擊後 `handleReviewSubmit` 用逐列 `entry.checked` 重新計算出 `names = []` 而靜默不做任何事。
> 資料流問題，目前 tags 由於架構問題，資料流極為混亂，設計新資料流時希望能更加正交、減少重複事實等

- **`timers`（合併堆張數查詢的 debounce/seq 表）在群組被拆解時未同步清除**：`queryMergeCount`（`+page.svelte:79–105`）每次呼叫都會 `timers.set(group.id, { timer, seq })`，但 `dissolveGroup`（157–160）與 `detachTag` 中「成員清空即刪除群組」的分支（119–123）都只 `groups.delete(group.id)`，從未對應 `timers.delete(group.id)` 或 `clearTimeout`。若群組被拆解／解散時仍有一個 200ms 的查詢計時器在途，該計時器到期後仍會照常對已從 `groups` 移除的 `group` 物件發出 `/api/proto/tags-union-count` 請求並寫回 `group.mergeCount`（等同於對一個已離開畫面、不再被任何回應式來源引用的物件做無意義的網路請求與寫入）。由於 `timers` 只在整個元件卸載的 `$effect` cleanup（72–76）才會被遍歷清空，只要使用者在同一次頁面停留期間持續建立/拆解合併堆，`timers` 這個 plain `Map` 的 key 會隨群組數量無界累積，不會隨群組被拆解而回收。
> 真實問題

- **（次要）`ZoneContainer` 的 `ondragleave` 未區分子元素進出，`dropping` 樣式可能閃爍**：`+page.svelte:210–212` 的 `ondragleave` 只要目前 `draggingOver === zone` 就直接歸零，沒有用 `e.relatedTarget` / `contains()` 排除「進入區域內部子元素（按鈕、輸入框、chip）」所觸發的 `dragleave`。由於 `dragenter`/`dragleave` 是會冒泡的原生事件，拖曳中的指標掃過 `ZoneBodyGroup`/`ZoneHeader` 內部這些子元素時，容易先觸發 `dragleave`（`draggingOver` 被清空、`dropping` 樣式移除）再被下一次 `dragover`（`+page.svelte:205–208`）重新設回，造成邊框/背景高亮閃爍。
> 真實問題，不確定描述是否真實，但我之前測試時的確偶有閃爍

- **（次要）`previewCache` 為模組層級單例，只在頁內動作時清空，跨路由重新進入後可能顯示過期預覽**：`chips/previews.ts` 的 `previewCache`（16）是 `SvelteMap` 模組單例，作者已自行標註 `TODO: 不該這樣寫，太危險`（14）。目前只有 `handleReviewSubmit`、`handleRefresh` 兩處會呼叫 `clearPreviews()`；若標籤實際內容是透過本路由以外的流程改變（例如在其他路由提交了新圖片、影響某標籤的張數與代表圖），使用者離開 `/tags` 又重新進入時，`previewCache` 並不會因為重新掛載而重置，`requestPreview`（24–43）的 `if (previewCache.has(tag)) return;` 會直接沿用同一個 session 中殘留的舊資料，懸停預覽可能顯示與伺服器現況不一致的縮圖。
> 該 TODO 已過時，但的確，改為 context module 而非 pure module 也沒壞處 (何為 context/pure 可參考 docs/structure.md)

> Pagination 不夠完善，應該整體置中，包括上下頁切換，並新增切換到底，且上下頁切換到底都是 icon button，共四個，icon 採用 IconChevronDown 與 IconChevronRightPipe 轉向製作，轉向請直接寫在 icon 的 style，不要額外包 dom

> 打開審查清單時要自動全選

> 翻頁會導致草稿狀態消失

> 頁面應該以伺服器回傳為準，目前有機會出現錯誤的 Pagination 資料
