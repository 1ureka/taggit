# /compare 遷移與新設計計畫（分析用，尚未實作）

> 規格參考 taggit 舊專案 `routes/compare-a/**`（editor-c 轉生的並排畫布原型），但**定位重設**：compare-a 是「帶編輯能力的並排畫布」，新 /compare 是**純瀏覽/比較路由**——卡片沒有任何編輯功能、沒有草稿概念，修改一律經卡片底部的「編輯」連結去 /editor。本輪與使用者收斂的決定全部記錄於此。**這次只是計畫，尚未動任何程式碼。**

## 一、定位與範圍

- compare 是瀏覽類型路由：從篩選結果隨機抽 N 張（或從左側列表手動釘選）並排比較，看細節用每張卡片各自的 pan/zoom。
- **自 compare-a 移除的東西（已確認全部移除）**：每張卡片的欄位編輯（名稱/評等/標籤輸入）、「標籤 → 全部畫布」廣播、ReviewModal、Ctrl+S、dirty 離開防護（沒有草稿就沒有 dirty）。compare-a 的 `proto.ts`（Draft 模型、saveDrafts）與 `ReviewModal.svelte` 整個不搬。
- **補回 compare-a 缺失的能力**：左側列表的篩選與排序（原型只有陽春的搜尋＋評等下拉）、左側列表可開關（與主頁探索面板同一套設計）。
- 快捷鍵：**全部拿掉**（compare-a 的 Space 抽選、Ctrl+S 皆不做）——延續 tagger Lightbox 收斂時對 window 級鍵盤監聽的否決，互動只靠按鈕，Tab 到按鈕後用原生 Space/Enter 觸發。

### 對 migration.md Phase 5 的偏離（以本文件為準，不回改 migration.md）

- migration.md 說 compare 的資料契約是「一次取回完整 committedFiles + authoringTags、互動純前端、API 用 api/proto/committed-batch」。**全部作廢**：編輯移除後不需要 authoringTags 與 committed-batch（留給 Phase 6 editor）；清單改走 URL 真相源＋伺服器查詢（見下）。
- migration.md 說每 Phase 要把用到的 api/proto 端點轉正——compare 根本不用任何 proto 端點，唯一的寫入是既有正式端點 `DELETE /api/committed/[filename]`，所以本 Phase 沒有轉正工作。（使用者已另行定調：API 整理統一延後到所有頁面遷移完成後。）

## 二、資料流

### URL 是查詢的唯一真相源（與主頁同款）

主頁探索面板的「比較」按鈕本來就是 `href={`/compare${page.url.search}`}`（`(home)/panel/ExploreButtons.svelte`）——篩選參數天生就會帶過來，所以 compare 的列表查詢直接沿用主頁模式：

- `+page.server.ts`：`ImageQuery.fromSearchParams(url.searchParams)`，但覆寫 `limit: 0` 取回**完整篩選結果**（列表與抽選池都需要全量；主頁 masonry 本來就整包下發，量級相同）。回傳 `items`、`total`。
- 篩選/排序變動：比照 `(home)/panel/ExploreFields.svelte` 的 `apply()`——組 `ImageQuery` 寫回 URL（`goto` + `replaceState: true, noScroll: true, keepFocus: true`），load 重跑。
- 好處：hidden 遮蔽、搜尋語意、標籤 AND 全部由後端 `Query` 統一處理，前端零重複實作；與主頁的查詢語意保證一致。

### 釘選（畫布）也進 URL，但與列表篩選分離

畫布與列表是兩件事（已與使用者確認方向）：**篩選變動不影響已釘選的卡片**。

- 釘選狀態存 URL：`?pinned=a.jpg,b.png`（比照主頁 DetailModal 的 `modal` 參數模式）。釘選/取消釘選/抽選用 `replaceState` 讀寫，**不重跑 load**（0.8 效能鐵律：切換項目純前端）。
- `+page.server.ts` 額外解析 `pinned` 參數，**無視篩選條件**逐 id 用 `Query.getImage(id)` 查回 `pinnedRecords`（不存在的 id 靜默略過）——重整（F5）、分享連結後畫布仍在；invalidateAll（取消提交後）自然修剪已消失的紀錄。
- 前端遵循 tagger-dataflow-pattern：URL 的 pinned ids 是原始意圖；渲染用的 `pinnedRecords` 是 derived——以「釘選當下從列表拿到的 record + load 回傳的 pinnedRecords」合成 lookup（一個普通 Map 快照，load 資料到達時以新值為準），URL 中解析不到 record 的 id 不渲染也不主動清除。
- 參數相容性已確認：`ImageWhere.KEYS`/`ListOptions.KEYS` 都不含 `pinned`，`ExploreFields` 式的 `apply()` 用 `toSearchParams(page.url.searchParams)` 保留非查詢參數，篩選變動不會洗掉 pinned。

### 寫入操作只有一個

「刪除」按鈕＝**取消提交**（已確認，不做「連檔案永久刪除」）：`requestConfirm()`（`$lib/widgets/confirm-events`，同 tagger 慣例）確認後 `DELETE /api/committed/[filename]`——紀錄刪除、檔案回到暫存區——成功後自 URL 的 pinned 移除該 id、`invalidateAll()`、`addToast`。這是唯一觸發 invalidate 的互動（另有 toolbar 的手動重新整理）。

## 三、版面與元件

```
┌─toolbar────────────────────────────────────────────┐
│ [🔍搜尋] [排序▾][降冪▾] [⛭篩選•2]   [抽3張▾][隨機抽選][⟳] │
├──────────┬─────────────────────────────────────────┤
│ 左列表    │  卡片   卡片   卡片        （畫布 dock）    │
│ (虛擬化)  │                                          │
└──────────┴─────────────────────────────────────────┘
```

### toolbar（篩選一定在這裡，已定案）

採「搜尋＋排序常駐、進階收 Popover」：

- 常駐：`SearchInput` widget（定寬，Enter 提交即 apply）＋排序 `Select` 兩顆（欄位/方向，選項同主頁：時間/評分/名稱/隨機＋升降冪，隨機時方向 disabled）。
- 進階：一顆 `IconFilter` icon 按鈕開 `Popover`，內放「包含標籤 `TagInput`、排除標籤 `TagInput`（facet scope 同主頁作法）、評等（運算子＋值兩顆 Select）」；有作用中的進階條件時按鈕上顯示數字徽章。變更即 apply（與主頁 onchange 行為一致）。
- 右側：抽選張數 `Select`（2/3/4/6，沿用 compare-a）＋「隨機抽選」primary 按鈕（`IconArrowsShuffle`）＋重新整理 ghost icon 按鈕（`IconReload`，比照 tagger Toolbar）。
- responsive：常駐控件少，窄視窗只需收縮搜尋框寬度；Popover 是浮層不佔行。這正是選擇此方案而非全欄位橫排的原因。

### 左側列表

- 用 `$lib/virtualizer/list.svelte.ts` 虛擬化（固定行高），取代 compare-a 的「顯示更多＋80」分批渲染。
- 列表項：`sm` 縮圖＋名稱（ellipsis）＋釘選狀態。**hover 時浮現釘選圖示**（使用者將自行補一組更像圖釘的 pushpin icon，含釘選/取消兩態）；整個列表項本來就可點（點擊＝toggle 釘選），hover 圖示只是視覺提示，不影響鍵盤操作。已釘選項有常駐標記（pushpin 實心態＋accent 樣式）。
- 開關：照抄主頁模式——`left-panel-spacer` + 絕對定位面板 + `InverseRadius` 開關鈕 + `--left-panel-width` CSS 變數（`(home)/+page.svelte:98-188` 整段樣式語彙）。**沿用同一個全域變數**：主頁與 compare 的左面板開關狀態互通（都是「左側輔助面板」概念，跨頁記住開關是合理行為）；若走查後覺得應各自獨立，改成 `--compare-panel-width` 即可，成本一行。
- 空結果：列表顯示「沒有符合條件的圖片」。

### 畫布（dock）與卡片

- dock 橫向排列、`overflow-x: auto`；卡片 `flex: 1 1 0` ＋ `min-width`（約 320px，實作時調校）——抽 2~3 張時均分滿版，張數多時到達 min-width 後橫向捲動。
- 卡片結構（使用者定案，由上而下）：
  1. **header 列**：名稱＋檔名（caption 字級、mono）＋取消釘選 ghost icon 按鈕（justify-end，用新 pushpin icon）。
  2. **圖片區**：`ImageCanvas`（pan/zoom，`xl` 尺寸），填滿扣除其餘列的剩餘高度。實作前先讀 `lab/(showcase)/(display)/image-canvas` use case（CLAUDE.md 鐵律）；用法比照 tagger `inspector/Lightbox.svelte`（`resetKey` + `<img>` child）。
  3. **評等列**：`Rating` readonly。
  4. **標籤列**：`TagChips` `nowrap`——單行、右側 mask 漸隱收尾，與主頁 MasonryImage 的 mask 概念一致。**info 區因此每張卡片高度大致相同**（等高是設計目標，名稱/標籤都單行 ellipsis/mask，不允許換行撐高）。
  5. **按鈕列**：「編輯」`ButtonLink`（`IconEditFilled`，`/editor?currentId=<id>` 並帶上當下 URL 篩選參數——理由同主頁 DetailModal 的 `recordHref`：讓 editor 的統一查詢與此處一致，hidden 標籤圖片不會被再次遮蔽）＋「刪除」`Button variant="destructive"`（`IconArrowBackUpDouble` 或相似，取消提交流程見上）。
- 空畫布：置中提示「按『隨機抽選』抽 N 張並排比較，也可以從左側列表釘選」＋caption 副行。

### 隨機抽選

- 從**當前篩選結果**（`data.items`）隨機抽 N 張（不重複），**直接取代**目前全部釘選（寫 URL `pinned`，replaceState）。池空時 `addToast({ message, variant: "error" })`。
- 抽選不打後端（池已在前端），與 compare-a 行為一致；與現行 /compare 的「invalidateAll 重抽」不同——那是因為現行版把 random 放在 SQL 端，新版池在前端就不需要。

## 四、檔案結構（0.8 慣例）

```
src/routes/(app)/compare/
├── +page.svelte          # 狀態編排：URL pinned 讀寫、record lookup、抽選
├── +page.server.ts       # ImageQuery（limit 0）＋ pinned 解析
├── toolbar/
│   ├── Toolbar.svelte    # 常駐控件＋抽選群
│   └── FilterPopover.svelte
├── list/
│   └── CompareList.svelte  # 虛擬化列表＋InverseRadius 開關（含面板殼）
└── dock/
    └── CompareCard.svelte  # 單張卡片（header/canvas/info/actions）
```

- 無 presenter class；`.core.svelte.ts` 不出現在路由層。
- 樣式只用 token；`hsl(from …)` 推導；light/dark 都走查。

## 五、實作前必讀的 lab use case（CLAUDE.md 鐵律）

| 積木/widget | lab 展示頁 |
| --- | --- |
| SearchInput 組合 | `lab/(showcase)/(inputs)/search-input` |
| TagInput（Combo+Chip） | `lab/(showcase)/(inputs)/combo-tags` |
| Select | `lab/(showcase)/(inputs)/select` |
| Popover 行為 | `lab/(showcase)/(floating)/tooltip-scroll`、`menu-*`（Popover 定位語彙） |
| ImageCanvas | `lab/(showcase)/(display)/image-canvas` |
| Chip / TagChips | `lab/(showcase)/(display)/chip` |
| Button 變體 | `lab/(showcase)/(actions)/button-variants`、`button-compositions` |
| ConfirmDialog / requestConfirm | `lab/(showcase)/(widgets)/confirm-dialog` |

## 六、風險與未決（實作時就地決定，不阻塞）

- **卡片 min-width 與 dock 均分策略的具體數字**：走查時對真實裝置寬度調校。
- **ImageCanvas 多實例**：4~6 個 pan/zoom canvas 同時掛 `xl` 圖的記憶體/解碼壓力，若卡就降 `lg`/`md` 或懶載入，實測再說。
- **pushpin icons**：使用者自補；補齊前可暫用 `IconCheckFilled`（compare-a 的 pin-mark 作法）佔位。
- **排序=隨機時的語意**：URL `sort=random` 下 load 每次重跑順序都變，列表會跳動——可接受（主頁同樣行為），抽選本身不受影響。

## 七、驗收清單（使用者自行走查）

1. 主頁設好篩選 → 點「比較」→ compare 列表即為同一組篩選結果（含 hidden 遮蔽行為一致）。
2. toolbar 搜尋/排序/進階 Popover 變更 → 列表即時更新、URL 反映、徽章數正確；已釘選卡片不受影響。
3. 釘選 3 張 → F5 → 畫布仍在；改篩選讓某釘選圖不在結果中 → 卡片仍在。
4. 隨機抽選：取代全部釘選；池空時 toast 錯誤；抽選不觸發整頁 load（Network 無 document/data 請求）。
5. 卡片：pan/zoom 可用、✕ 不隨縮放位移、標籤單行 mask、各卡 info 區等高；「編輯」連到 /editor 且帶篩選參數。
6. 「刪除」：requestConfirm → 取消提交成功 → 卡片消失、列表更新、該圖出現在 /tagger 暫存區。
7. 左面板開關與主頁一致（同一顆 InverseRadius 鈕手感），且在主頁關閉後進 compare 保持關閉（共用變數行為）。
8. light/dark 走查；Tab 順序合理、Escape 只關 Popover 不做其他事；全程無 window 級鍵盤監聽。
9. `npm run check`、`npm run build`、`npm run test` 全綠。
