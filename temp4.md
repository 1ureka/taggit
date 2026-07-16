# /tags 遷移與新設計計畫（分析用，尚未實作；不含 /tags/cleanup）

> 規格參考 taggit 舊專案 `routes/tags-d/**`（拖放合併畫布，已勝出原型）。畫布互動概念保留，但**資料流全面重設計**：使用者本輪定調「減少 page load」——tags-d 那套「layout 一次取回完整 committedFiles + allTags、其後互動純前端」**作廢**，標籤池改伺服器分頁、審查預覽與懸停預覽圖改查詢式。巢狀工具頁 `/tags/cleanup`（tags-c 清理助手）不在本報告範圍。**這次只是計畫，尚未動任何程式碼。**

## 一、定位與本輪新增能力

- /tags 是標籤層級的整理工作區：把標籤拖進右側「合併堆／刪除區／顯隱切換區」排程操作，經審查 modal 前後對照後批次送出（`POST /api/proto/tags-batch`，現成端點，執行順序 deletes → renames → hidden 語意不變）。
- 本輪新增、tags-d 沒有的三件事（皆使用者提出）：
  1. **左池標籤懸停 tooltip**：以 snippet 展開顯示——元資訊（名稱、使用數、hidden 徽章；資料就在列表項上，**立即顯示**）＋該標籤的 **4 張預覽圖**（評等最高，同分依提交時間新→舊；已確認）。預覽圖查詢完成前顯示 loading 佔位 snippet。這同時回應了 draft.md 懸而未決的「這個標籤掛在哪些圖片上，在畫布裡怎麼被滿足」。
  2. **右側每個區塊角落的 open-external 按鈕**：以區塊內全部標籤 **AND** 查詢回主頁（已確認維持 AND，即使近似名合併堆交集可能很小——「確認共現」本身有價值；後端 `includedTags` 就是 AND 且 hidden 標籤在被明確 include 時豁免遮蔽，語意剛好正確）。**新分頁開啟**（`target="_blank"`）——畫布上未送出的排程不會因導航而觸發警告或遺失。
  3. **標籤池分頁**：純文字 chip 難以虛擬化，改分頁（100 個/頁，已確認）。
- 快捷鍵**全部拿掉**（tags-d 的 window 級 Ctrl+S 與 Escape 皆不做，與 tagger/compare 一致）：清空選取改為一顆可見按鈕（選取數 > 0 才顯示），審查靠 toolbar 按鈕。

### 對 migration.md Phase 4 與 tags-d 的偏離（以本文件為準）

- 「layout 層一次取回 committedFiles + allTags，其後互動純前端」→ **作廢**（減少 page load）。`+layout.server.ts` 不再扛共用資料；/tags 用自己的 `+page.server.ts` 只載標籤第一頁。cleanup 屆時自行決定資料流（tags-c 的 suggest.ts 靠全量掃描，遷移時大概也要改成查詢式），本報告不處理。
- 「該路由用到的 api/proto 端點完成轉正改名」→ **延後**：使用者定調新端點一律先放 `/api/proto`，等所有頁面遷移完成後才做全站 API 整理。
- tags-d 用 `$effect` 掃 allTags 修剪畫布失效成員 → **移除**（見畫布一節）；這同時符合已確立的 tagger-dataflow-pattern（拒用 $effect 同步、原始意圖 state 不主動清除）。

## 二、資料流（全查詢式）

### 標籤池：伺服器分頁（現成 GET /api/tags，零新後端）

- `+page.server.ts`：回第 1 頁——`TagQuery`（`universe: "all"`、`sort: "count"`、`order: "desc"`、`limit: 100`、`page: 1`）＋ `total`。`universe: "all"` 維持 tags-d 決定（要能管理 count 0 的殘留標籤）。
- 之後所有池互動走 client fetch `GET /api/tags`（`TagQuery.toSearchParams()` 組參數）：
  - 搜尋（`name` 子字串）：輸入去抖後查詢。
  - 排序 `Select`：使用數降冪／名稱升冪。
  - 顯隱篩選 `Select`：全部／僅隱藏／僅可見（`hidden` 參數；已確認要有——管理情境常要找隱藏標籤）。
  - 翻頁：上一頁/下一頁＋「n / N 頁」指示，翻頁後池捲回頂部。
- 分頁/搜尋/排序狀態**純前端**（不進 URL）；搜尋/排序/篩選變動一律回到第 1 頁。
- 併發防護：查詢帶遞增序號，只採納最後一次發出的回應（去抖已擋掉大部分，序號擋 out-of-order）。

### 畫布：本地排程 state，標籤攜帶快照

- 畫布 state 與 tags-d 同構：`groups: { id, canonical, members }[]`、`deleteList`、`toggleList`，變更集由畫布推導（`changeset.ts` 的純函式可整組搬，`projectImageTags`/`projectedCounts`/`emptiedImages` 這三個需要全量 committedFiles 的預覽函式**不搬**——由新預覽端點取代）。
- 沒有全量 `tagByName` 字典了：標籤被拖入/加入畫布**當下快照** `{ name, count, hidden }`（拖放的 dataTransfer 或點選備援時 chip 上都有這份資料）。畫布顯示用快照；快照的 count 可能過期——審查 modal 開啟時預覽端點會回最新值，送出時後端以現實為準，可接受。
- **不做自動修剪**：畫布成員只在「送出成功」與「手動移出」時移除；標籤已被外部改掉的情況由送出結果的逐筆錯誤（not_found 等）呈現在審查 modal。
- dirty 防護：畫布有排程時 `beforeunload`＋`beforeNavigate`（照 tagger 已定案的雙軌方案：原生擋分頁關閉；SPA 導航 `nav.cancel()` → `requestConfirm` → bypass 旗標 → `goto`）。不用 tags-d 的 `window.confirm`。

### 變更集預估：新端點，畫布即時＋審查 modal 共用（已確認）

- **`POST /api/proto/tags-preview`**（與 `tags-batch` 對仗；名稱屬 proto 等級，API 整理時再定）。入：與 tags-batch 相同形狀的變更集 `{ deletes, renames, hidden }`；出（供兩處共用）：
  - 逐標籤現況：`{ name: { exists, count, hidden } }`（審查條目的「已不存在」驗證與最新 count）。
  - 合併預估：每個 rename 目標的套用後張數（後端用位圖索引算，便宜且精確）。
  - 清空警告：每個 delete 造成「失去最後一個標籤」的圖片數。
- 呼叫時機：畫布變動**去抖**（~300ms）後查一次，更新合併堆的「→ N 張」即時預估（查詢中顯示前值＋pending 樣式或省略號）；審查 modal 開啟時再查一次確保最新。
- 前端 `changesetEntries` 改為以「本地變更集 × 預覽回應」組審查條目；純本地可判的問題（名稱不合法、rename 目標互指、目標被排入刪除）維持前端即時驗證，不等端點。

### 懸停預覽圖：hover 才查＋Map 快取

- 端點放 **`/api/proto`**（已確認）。建議形狀：**通用查詢 `GET /api/proto/committed-query`**，吃 `ImageQuery` 參數（此處用 `includedTags=<tag>&sort=rating&order=desc&limit=4`），回 `items`＋`total`——比專用端點多一點通用性，tags 頁也順便用 `total` 交叉顯示；API 整理階段再決定正式形狀與去留。
- 前端 `pool/previews.ts`：`Map<tagName, ImageWithId[] | "loading">` 快取——同 session 同標籤不重查；`tags-batch` 送出成功後整個清空（標籤內容已變）。
- 觸發：chip 的 mouseenter/focus 去抖（~150ms）後發查詢（滑過一整排 chip 不噴請求）；tooltip 的顯示則交給既有 `tooltip` attachment（openDelay 機制），兩者互不干涉。
- 縮圖用 `imgSrc(id, "sm")`；預覽圖本身載入前有 blurhash/佔位底色。

## 三、tooltip snippet 設計

- 用全域 `Tooltip` 的 **Snippet content**（`tooltip.core.svelte.ts` 已支援 `content: string | Snippet`；用法見 `lab/(showcase)/(floating)/tooltip-behavior` 的 `richContent` 範例）。頁面定義一個零參數 snippet，閉包讀 `hoveredTag` state 與 previews 快取——快取狀態變化時 tooltip 內容 reactive 更新，天然涵蓋「元資訊立即、預覽圖後到」：

```
┌─tooltip──────────────┐
│ 標籤名  ×123  [隱藏]   │   ← meta：來自列表項的 Tag 資料，立即
│ ┌──┐┌──┐┌──┐┌──┐     │   ← 預覽圖 ×4：快取 miss 時先渲染
│ └──┘└──┘└──┘└──┘     │      loadingDisplay 佔位方塊
└──────────────────────┘
```

- `{#if entry === "loading"}` → `{@render loadingDisplay()}`（四個固定尺寸的佔位方塊，脈動樣式）；載入完成換成縮圖列；查無圖（count 0）顯示「無已提交圖片」caption。
- 已知視覺注意點：全域 Tooltip 的氣泡是反色底（`background: var(--color-text)`），縮圖會落在反色氣泡內——先照用（相框感可接受），走查不行再在 snippet 內自帶底色/內距微調，**不另起浮層系統**。

## 四、版面與元件

```
┌─toolbar──────────────────────────────────────────────┐
│ N 標籤 · 3 已選 · 5 待送出  [清空選取] [⟳][清理工具][檢視變更(5)] │
├──────────────────────────────┬───────────────────────┤
│ 池：[🔍搜尋][排序▾][顯隱▾]      │ 右板（23rem，捲動）        │
│  [chip][chip][chip]…          │ ┌新合併堆（拖放目標）┐      │
│  （100/頁，flex-wrap）         │ ┌合併堆 A     ⧉ ✕┐       │
│                               │ ┌刪除區       ⧉ ┐        │
│  ◀ 上一頁   3 / 12   下一頁 ▶  │ ┌顯隱切換區    ⧉ ┐        │
└──────────────────────────────┴───────────────────────┘
```

- **toolbar**：比照 tagger `header/Toolbar.svelte` 語彙——左側資訊（標籤總數、選取數、待送出數 badge）；右側「清空選取」（選取數 > 0 才顯示）、重新整理 ghost（重跑當前池查詢＋失效預覽快取）、「清理工具」ButtonLink（`/tags/cleanup`，本輪只保留連結位、目標頁不做）、「檢視變更（N）」primary。
- **池**（左，flex-1）：控制列（SearchInput＋排序 Select＋顯隱 Select）＋chip 流式排列＋底部分頁列。chip 沿用 tags-d 的資訊密度：名稱（ellipsis）＋count＋hidden 徽章（外觀交給 `Chip`/`TagChips` 的既有語彙，hidden 統一用 `IconAlertTriangleFilled` 徽章——與 TagChips widget 現狀一致）；狀態樣式：selected／in-group／in-delete／in-toggle（placement map 查詢，**獨立於分頁**——翻頁後放置狀態標記依然正確）。chip 可拖（draggable）也可點（toggle 選取）。
- **分頁列**：上一頁/下一頁 `Button`＋「n / N」指示（`Chip` 或 caption 文字）。無現成 Pagination 積木——先做頁面局部組合，證明通用後再依 widgets-wrap-use-cases 慣例升格。
- **右板**（23rem，捲動）：結構照 tags-d——「新合併堆」放置區（＋「把選取的 N 個變成一堆」備援按鈕）、各合併堆（canonical `TextInput`＋成員 chips＋星號指定 canonical＋「→ N 張」預估＋解散）、刪除區、顯隱切換區（各有「加入選取」備援按鈕）。**每個區塊角落新增 open-external icon 按鈕**：`ButtonLink` ghost/icon，`href = /?${new ImageWhere({ includedTags: members }).toSearchParams()}`，`target="_blank" rel="noopener"`；合併堆一顆（全成員）、刪除區/顯隱區各一顆（該區全部標籤）、成員為空時 disabled。icon 目前庫裡沒有 external-link——依 0.7 慣例用相似的（候選 `IconLink`）或由使用者自補。
- **審查 modal**：頁面本地元件（比照 tagger 對 ReviewModal 不做 widget 的決策），內容照 tags-d 的 TagReviewModal 語彙——操作類型徽章（合併/重命名/刪除/隱藏/取消隱藏）、舊→新 del/ins、預估數字（來自 preview 端點）、problem/失敗訊息、逐筆勾選與捨棄、部分失敗後保留失敗項。markup 全新（Modal＋Checkbox＋Chip＋Button 積木）。

## 五、檔案結構（0.8 慣例）

```
src/routes/(app)/tags/
├── +page.svelte           # 畫布 state 編排、dirty 防護
├── +page.server.ts        # 標籤第 1 頁＋total
├── pool/
│   ├── TagPool.svelte     # 控制列＋chip 流＋分頁列
│   ├── pool.ts            # /api/tags client fetch（去抖、序號）
│   └── previews.ts        # hover 預覽查詢＋Map 快取
├── board/
│   ├── MergeGroup.svelte
│   ├── Zone.svelte        # 刪除區/顯隱區（同構，props 區分）
│   └── dnd.ts             # dataTransfer 協定＋dropping 高亮
├── review/
│   └── ReviewModal.svelte
└── logic/
    └── changeset.ts       # 變更集模型＋純本地驗證（自 tags-d 搬，去掉全量預覽函式）
```

新後端（皆 `/api/proto`，暫不轉正）：

| 端點 | 用途 |
| --- | --- |
| `POST /api/proto/tags-preview` | 變更集預估（合併後張數、清空警告、逐標籤現況） |
| `GET /api/proto/committed-query` | 通用 ImageQuery 查詢（本頁用於懸停預覽圖 top-4） |
| `POST /api/proto/tags-batch` | 既有，批次送出（不動） |

後端測試：兩個新端點比照 `test/` 現有 proto 端點測試補齊。

## 六、實作前必讀的 lab use case（CLAUDE.md 鐵律）

| 積木/widget | lab 展示頁 |
| --- | --- |
| Tooltip snippet content | `lab/(showcase)/(floating)/tooltip-behavior`（richContent 範例） |
| Chip | `lab/(showcase)/(display)/chip` |
| SearchInput 組合 | `lab/(showcase)/(inputs)/search-input` |
| Select | `lab/(showcase)/(inputs)/select` |
| TextInput（canonical 輸入） | `lab/(showcase)/(inputs)/type-field` |
| Modal | `lab/(showcase)/(floating)/modal` |
| Checkbox | `lab/(showcase)/(inputs)/checkbox` |
| ConfirmDialog / requestConfirm | `lab/(showcase)/(widgets)/confirm-dialog` |
| LinearProgress（若送出要進度） | `lab/(showcase)/(display)/linear-progress` |

## 七、風險與未決（實作時就地決定，不阻塞）

- **preview 端點回應形狀細節**（欄位命名、emptied 是否附樣本 id）：實作時定，proto 等級允許粗糙。
- **反色 tooltip 氣泡內的縮圖視覺**：走查再調，方案見第三節。
- **拖曳與 tooltip 的互動**：dragstart 時應立即關 tooltip（mouseleave 通常會觸發，若殘留再補 dispatch 清除事件）。
- **選取跨頁**：選取集合獨立於分頁，翻頁後看不到但仍選取——toolbar 的選取數與「清空選取」按鈕使其可控；若走查覺得反直覺再改為翻頁清空。
- **open-external icon**：庫內無 external-link，使用者自補或用 `IconLink`。
- **/tags 入口**：本輪不處理（導航面板 navItems 目前無此項，屆時與導航重整一起做）。
- **OR 查詢**：open-external 維持 AND；「ImageWhere 支援 anyTags/OR」記為 API 整理階段的候選項，不在本輪。

## 八、驗收清單（使用者自行走查）

1. 進 /tags：只載入標籤第 1 頁（Network 佐證 payload 不含 committedFiles）；池顯示 100 顆 chip＋正確總數/頁數。
2. 搜尋去抖、排序/顯隱篩選即查即回、變動回第 1 頁；翻頁捲回頂部；快速連打不出現舊回應覆蓋新回應。
3. 懸停 chip：meta 立即顯示；首次懸停預覽區為 loading 佔位、載畢換 4 張「評等最高」縮圖；再次懸停同標籤不發新請求（快取）；count 0 標籤顯示空狀態。
4. 拖放與點選備援：建堆/入堆/刪除區/顯隱區/拖回池全部可用；chip 的放置狀態標記在翻頁後仍正確。
5. 合併堆「→ N 張」在畫布變動去抖後更新；審查 modal 的預估與警告（失去最後標籤）數字正確；名稱不合法等本地驗證即時出現。
6. 每個區塊的 open-external：新分頁開主頁、URL 為 includedTags AND、含 hidden 標籤時圖片可見（豁免語意）；畫布排程不受影響。
7. 送出：部分失敗時失敗項留在 modal 與畫布、成功項自畫布移除；送出成功後懸停預覽快取失效（重查）。
8. dirty 防護：有排程時關分頁觸發原生攔截、SPA 導航觸發 requestConfirm；確認離開後不殘留。
9. 全程無 window 級鍵盤監聽；「清空選取」按鈕只在選取數 > 0 顯示。
10. light/dark 走查；`npm run check`、`build`、`test`（含兩個新端點的後端測試）全綠。
