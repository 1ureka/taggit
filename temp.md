# 圖章模式（Stamp Mode）實作規劃

> 目標：在新專案 `/tagger`（未來 `/staged`）重新實作舊專案 `tagger-b` 的圖章模式，邏輯可抄、markup 全新，並符合新專案已定案的資料流慣例（見 memory `tagger-dataflow-pattern`／`derived-overwrite-pattern`／`widgets-wrap-use-cases`）。
> 本文件分兩部分：一、原始設計完整還原（先確認基準，避免規劃時漏掉細節）；二、新架構下的實作規劃。

---

## 一、原始設計完整還原

### 1.1 一句話心智模型

圖章模式解決的問題：**批次匯入待審圖片時，很多圖片共享同一組名稱/評等/標籤，使用者不想一張一張進 inspector 重複打字**。做法是把「目前正在編輯的暫存」釘選成一個可重複使用的樣板（圖章），用點擊或拖曳快速「蓋」到其他卡片的暫存上。圖章只作用在**尚未提交**的本地暫存（`Draft`），不直接呼叫後端 API，套用結果一樣要進審查 modal 才會真正送出。

### 1.2 生命週期

- **進入**：只能從 Inspector 內的 `StampTool` 觸發，按「以此張設為圖章」，條件是 `disabled={!isTouched(draft)}`（暫存必須「有動過」，但不要求 `isReady`／驗證通過）。
- **關閉 Inspector 不會退出圖章模式**——典型工作流是：inspector 釘選圖章 → 關 inspector 讓網格佔滿 → 在整個網格上點擊/拖曳連續蓋章 → 用徽章或 Esc 離開。
- **離開三種方式**：StampTool 面板「取消圖章」按鈕、`StagedGrid` 右上角浮動徽章本身可點擊、按 `Esc`。
- **Esc 優先權**：`handleWindowKeydown` 裡 `Escape` 先檢查 `stamp !== null`，若圖章模式啟用**只退出圖章模式並 return**，不連帶關閉 inspector；要再按一次才會關閉 inspector。原型註解明講原因：「圖章模式優先離開，避免蓋章蓋到一半誤觸 Esc 卻連檢視器都關掉」。
- 沒有鍵盤快速鍵可以「進入」圖章模式，只有滑鼠/觸控點擊。

### 1.3 啟用中的視覺提示（四層，全部在 `StagedGrid`）

1. **游標**：只有卡片可點擊區域套用 `cursor: copy`，不是全域游標，滑到卡片以外不變。
2. **卡片 title/aria-label**：變成「點擊或拖曳套用圖章：{摘要}」／「蓋上圖章：{file}」。
3. **容器外框**：`.grid-wrap.stamp-mode` 內縮描邊（`outline: 2px solid var(--accent); outline-offset: -2px;`），純被動提示、不可點擊。
4. **浮動徽章**：`position: absolute` 掛在網格最外層（獨立於會捲動的容器，**不隨網格捲動**），顯示摘要文字 + X 圖示，本身可點擊離開，`title="離開圖章模式（Esc 或點此）"`。

### 1.4 徽章機制

- 內容是 `summarizeStamp(stamp)`：依 `stamp.include` 動態組字串——勾了名稱顯示「「name」」、勾了評等顯示「★N」、勾了標籤顯示標籤清單或「（無標籤）」，用「・」串接；三個欄位都沒勾則顯示「未選擇任何欄位」。
- 徽章文字**即時反映** `StampTool` 面板三個 checkbox 的即時勾選狀態（`stamp.include.*` 是同一個 `$state` 物件的巢狀欄位，checkbox 直接雙向綁定，沒有中間層）。
- 徽章**不顯示** `count`（已套用次數）；`count` 只在 `StampTool` 面板文字「來源：「{sourceFile}」・已套用 {count} 張」中顯示，純供參考，不影響任何邏輯。

### 1.5 點擊/拖曳套用的行為與資料流

`+page.svelte` 只提供：
```ts
const handleStampApply = (file: string) => {
  if (!stamp || file === stamp.sourceFile) return;
  const d = drafts[file];
  if (!d) return;
  drafts[file] = applyStamp(stamp, d);
  stamp.count += 1;
};
```
**直接改寫該卡片的 `Draft`，逐張即時生效**，不是先暫存「圖章內容」再統一套用。

核心邏輯在 `StagedGrid` 的 pointer 事件，設計理念是「單點其實就是零移動的拖曳」：
- `pointerdown`：`preventDefault()`（防原生拖圖/選字）→ `dragging=true`、`strokeSet=new Set([file])`、`suppressClickFile=file` → 立刻套用第一張。
- `pointerenter`（拖曳中）：`stamp` 存在、`dragging` 為真、`e.buttons !== 0`、且該卡這次拖曳還沒套用過（`!strokeSet.has(file)`）→ 套用並記入 `strokeSet`（防同次拖曳來回掃過重複套用）。
- `click`：一般情況已被 `pointerdown` 套用過，用 `suppressClickFile` 抑制重複套用；但**鍵盤觸發**（Enter/Space 只產生 `click` 沒有 `pointerdown`）此時 `suppressClickFile !== file`，`click` 分支真正生效，讓鍵盤操作也能蓋章。
- `pointerup`（掛 `svelte:window`）：只重置 `dragging=false`，不清 `strokeSet`（下次 `pointerdown` 會重新賦值整個 Set）。
- **來源卡本身**：明確排除 `file === stamp.sourceFile`，點回來源卡是**完全靜默的 no-op**（不套用、不計數、無提示）。

`applyStamp` 合併規則：
```ts
export function applyStamp(stamp: Stamp, target: Draft): Draft {
  const next: Draft = { ...target };
  if (stamp.include.tags) next.tags = [...new Set([...target.tags, ...stamp.tags])];
  if (stamp.include.rating) next.rating = stamp.rating;
  if (stamp.include.name) next.name = stamp.name;
  return next;
}
```
- **標籤是合併**（union、去重），不覆蓋目標既有標籤。
- **評等、名稱是覆蓋型**，直接蓋掉目標值。
- 要不要套用某欄位是**釘選當下**決定（`stamp.include`），之後每次套用沿用同一組設定；但 `include` 是活的 `$state`，中途在面板調整只影響**接下來**的套用，不回溯已套用過的卡片。

### 1.6 `stamp.ts` 型別與函式

- **`type Stamp`**：
  - `sourceFile: string` — 純顯示用，套用時用來跳過來源卡。
  - `include: { name: boolean; rating: boolean; tags: boolean }` — 釘選當下決定，之後可即時調整（活引用，非快照）。
  - `name: string`、`rating: number`、`tags: string[]` — **釘選當下的快照**，與來源卡的 draft 完全解耦（來源卡之後被提交/清除/刪除都不影響已釘選的圖章）。
  - `count: number` — 已套用次數，僅供 UI 顯示。
- **`createStamp(sourceFile, draft): Stamp`**：`include` 預設全 `true`。**`name` 有 fallback**：`draft.name.trim() || stripExt(sourceFile)`——就算來源卡名稱欄位空白，圖章的 `name` 也會 fallback 成來源檔名去副檔名，不會是空字串。
- **`applyStamp(stamp, target): Draft`**：純函式，不修改傳入物件。
- **`summarizeStamp(stamp): string`**：渲染 include 狀態成一行摘要，供卡片 title 與徽章共用。

### 1.7 與其他機制的互動

- **與單張 inspector 編輯**：互不排斥，可同時發生；`stamp` 是全頁面唯一一份全域狀態，`Inspector`/`StampTool`/`StagedGrid` 共享同一顆。
- **與 Review Modal**：完全沒有特殊感知——套用後的卡片跟手動編輯的卡片在審查列表裡長得一樣，沒有「這欄被圖章蓋過」的視覺區分，也沒有 old→new 箭頭對照。安全網完全依賴使用者在送出前用審查 modal 檢查一遍（原型 `draft.md`：「不做 hover 預覽，覆蓋是否符合預期交給審查 modal 把關」）。
- **與合併式標籤驗證**：`applyStamp` 不繞過任何驗證，套用後仍可能觸發 `problemOf` 警告（例如套用後仍 0 標籤）。

### 1.8 已知邊界情況（原型程式碼可推導出，非顯式 TODO，建議延續）

1. 名稱欄位永遠有值：勾選名稱套用時，若來源卡名稱空白，所有被蓋章的卡片會被寫入「來源檔名去副檔名」這個具體字串——無法用圖章「批次清空名稱」。
2. 圖章是快照、與來源卡解耦：來源卡之後的任何變動不會同步回已釘選圖章。
3. `include` 是活物件，中途調整只影響後續套用，同一輪圖章模式內前後蓋的卡欄位組合可能不同，無提示。
4. 點來源卡本身完全靜默，無 toast/視覺回饋。
5. 「以此張設為圖章」只檢查 `isTouched`，不檢查 `isReady`，允許把驗證不通過的暫存釘成圖章散播出去，下游靠各卡自己的驗證擋。
6. 一次只能有一個圖章來源，換源必須先手動取消，沒有「一鍵重新釘選」捷徑。
7. 拖曳套用純用原生 Pointer Events，未特別處理觸控裝置。

**這 7 條建議全部原封不動延續**，除非收斂時使用者特別要求改變。

---

## 二、新架構下的實作規劃

### 2.1 型別與純函式：直接複製，無需改動

`Stamp`、`createStamp`、`applyStamp`、`summarizeStamp` 是完全跟 Svelte 無關的 pure TS，新舊專案的 `Draft` 型別一致（`name`/`rating`/`tags`，已核對 `inspector/draft.ts`），邏輯可以近乎原封不動搬過來，不涉及 `$state`/`$derived` 相關的架構差異。

**建議放置位置**：新建 `(app)/tagger/stamp/` 資料夾，放 `stamp.ts`（型別+純函式）+ `StampTool.svelte`（釘選/設定面板，掛在 Inspector 內）+ `StampBadge.svelte`（浮動徽章，掛在 StagedGrid 外層）。

理由：圖章橫跨既有的 `inspector/`（觸發、設定）與 `wall/`（套用、徽章顯示）兩個資料夾，不天然屬於任一方；比照 `review/` 是「橫跨 +page 與多個顯示位置的獨立關注點」自成一個資料夾的前例（0.8 慣例：資料夾用有意義命名，不巢狀）。**這點列入待收斂問題**，若使用者偏好併入既有 `wall/` 或 `inspector/` 也可。

### 2.2 狀態持有與資料流（比照 `tagger-dataflow-pattern`）

- `let stamp = $state<Stamp | null>(null)` 留在 `+page.svelte`。定位上它不是「來源過濾」型的 state（不像 `active`/`lightboxFile` 需要用 `data.stagedFiles.includes(...)` 過濾失效值），而是類似 `reviewOpen`/`importOpen` 的「模式旗標」——是否為 null 就是進出圖章模式的唯一判準，沒有失效問題（因為 `Stamp` 本身是快照，來源卡消失也不影響它，見 1.8 的第 2 點）。
- **來源卡被刪除的情況**：若 `currentFile === stamp.sourceFile` 時使用者按「刪除此張」，不影響 `stamp` 內容（快照解耦），只是 `sourceFile` 顯示文字會指向一個已不存在的檔名。這是原型既有設計的必然結果（見 1.8 第 2 點），延續即可，不算新架構要解決的問題。
- **傳遞方式**：不用 `bind:`，`stamp` 以唯讀 prop 往下傳。Svelte 5 的 `$state` 物件是共享 proxy 參照，子元件即使拿到的是「唯讀 prop」，只要不是 `$bindable()`，依然可以直接 mutate 巢狀欄位（如 `stamp.include.tags = true`）並讓所有持有同一參照的元件同步反應——這不是漏洞，是 Svelte 5 深層響應式的正常行為。因此：
  - **identity 變更**（`stamp = createStamp(...)` 或 `stamp = null`）必須經由明確 callback：`onstamppin: (file, draft) => void`、`onstampunpin: () => void`。這符合 memory `tagger-dataflow-pattern` 的原則——父層需要在賦值當下做別的事（`+page` 要呼叫 `createStamp`）就該用單向 prop + callback，不能讓子層直接改頂層變數。
  - **巢狀欄位調整**（`StampTool` 面板三個 checkbox 切換 `include.name/rating/tags`）不改變 `stamp` 是否為 null、無其他副作用，可以讓 `StampTool` 直接拿到 `stamp`（非 null 時）原地寫入 `stamp.include.xxx`，不需要額外 callback——這跟原型 `bind:include` 的效果一致，只是不需要 Svelte 的 `bind:` 語法糖，普通 prop 傳遞就夠。
- **StagedGrid** 需要：`stamp: Stamp | null`（唯讀，算 outline/游標/徽章文字用）、`onstampapply: (file: string) => void`（對應 `handleStampApply`，寫回 `+page` 的 `drafts`）、離開用的 `onstampunpin`（徽章 X 與 `StampTool` 取消按鈕共用同一支函式，若做 Esc 則也共用）。

### 2.3 進入/釘選（Pin）

- **UI 位置**：建議 `StampTool.svelte` 掛在 `Inspector.svelte` 的 `InspectorFields` 與 `InspectorFooter` 之間，是否要合併進 `InspectorFooter` 或独立一塊，列入待收斂問題。
- 按鈕「以此張設為圖章」，`disabled={!isTouched(draft) || pending}`。**`pending` 檢查是新架構新增的守衛**，原型沒有這條——因為原型沒有新專案這種「審查中/匯入中/刪除中都統一設 `pending=true`」的全域忙碌旗標；新專案現有的清空草稿/刪除按鈕都會 respect `pending`，圖章操作理應一致，避免跟其他非同步操作互相干擾。列入待收斂問題（是否要挋 pin/apply 都擋 pending，還是維持跟原型一樣不擋）。
- `onstamppin(file, draft)` 對應 `+page` 的 handler：`stamp = createStamp(file, draft)`。

### 2.4 離開（Unpin / Esc）—— **本節是最大的開放問題，需與使用者收斂**

三種離開方式沿用：`StampTool` 內「取消圖章」按鈕、徽章本身可點擊、Esc。前兩種是單純 callback，跟新架構沒有衝突，可以直接做。

**Esc 是衝突點**：新專案目前 `/tagger` **完全沒有任何 window 級 `keydown` 監聽**——不只圖章模式，連原型有的 `Ctrl/Cmd+S` 開審查、方向鍵切換上一張/下一張，新專案都還沒做（見 temp2.md 第一節功能缺口）。且已有明確前例：Lightbox 的上一張/下一張，第一版做成 `svelte:window onkeydown` 監聽方向鍵，**被使用者否決**，理由是「註冊在 window 上的按鍵監聽太容易跟其他快捷鍵衝突」，改為純按鈕方案（memory `phase0-status` 第五輪）。

但圖章模式的 Esc 在原型裡不是裝飾性功能——它有精心設計的優先權（先退圖章模式、不連帶關 inspector），是明確的 UX 意圖，跟方向鍵切換這種「順手加分」的功能性質不同。三個選項：

- **A**：破例為圖章模式加 window keydown，只服務 Esc、只處理「先退圖章模式再退 inspector」這一條優先權邏輯，不牽動其他快捷鍵。
- **B**：不做 Esc，圖章模式離開只靠 `StampTool` 取消按鈕與徽章點擊——與 Lightbox 的既有決定保持一致（新專案目前對「window 級鍵盤監聽」的立場是能不用就不用）。
- **C**：這輪不處理圖章模式的 Esc，留到之後「全部鍵盤快捷鍵」（Ctrl+S、方向鍵、Esc 優先權）作為單獨一輪一次性重新設計，避免這次先開一個只服務單一功能的 window keydown、之後又要為其他快捷鍵重新調整優先權邏輯。

### 2.5 套用邏輯（Click / Drag-to-stroke）

- 直接複製 `pointerdown`/`pointerenter`/`click`/`pointerup` 四事件協同邏輯到 `StagedCard.svelte`，邏輯不變（見 1.5）。
- **已驗證虛擬化不影響去重邏輯**：`wall/StagedGrid.svelte` 用 `$lib/virtualizer/masonry.svelte` 做真正的視窗虛擬化（讀過 `masonry.svelte.ts` 原始碼確認 `masonryItems = visibleItems`，螢幕外卡片不掛載 DOM），但因為 `strokeSet` 是用**檔名字串**當 key（不是 DOM 節點參照），就算拖曳中卡片因捲動重新掛載/卸載也不影響去重——這不是問題，不需要額外處理。
- **有一個原型沒有、新架構會出現的次要行為差異**：原型 `list/` 不虛擬化，所有卡片都在 DOM 中，理論上可以捲動同時拖曳連續蓋到目前視窗外的卡片；新專案因為虛擬化，使用者無法對螢幕外的卡片連續蓋章（必須先捲動讓卡片進入可視範圍，且拖曳到視窗邊緣不會自動捲動）。影響很小（使用者原本也不太可能一路拖到螢幕外），**不建議特別處理 auto-scroll**，僅記錄此差異。
- `StagedCard.svelte` 目前是 `<button>`，只有 `onclick={() => onselect(filename)}` 一個回呼。圖章模式下 click 語意要整個替換成「套用圖章」而非「開啟 inspector」，需新增 props：`stamp: Stamp | null`（唯讀，算 title/aria-label/cursor class 用）、`onstampapply: (file: string) => void`，並依 `stamp !== null` 分支切換 `onclick` 打的目標函式（`onstampapply` 而非 `onselect`）。
- 來源卡跳過邏輯（`file === stamp.sourceFile` no-op）不變。

### 2.6 視覺呈現對應到既有元件庫（比照 `widgets-wrap-use-cases` 原則）

- **游標 `cursor: copy`**：純 CSS，在 `StagedCard` 的 button 上依 `stamp !== null` 套 class，不需要元件。
- **容器 outline**：純 CSS，在 `StagedGrid` 的 `<section>` 上依同一條件套 class，不需要元件。
- **浮動徽章**：建議用既有 `Chip`（`$lib/components/display/Chip.svelte`）顯示 `summarizeStamp` 文字，搭配一顆 `Button variant="ghost" padding="icon"` 放 `IconX` 做關閉，兩者包在 `position: absolute` 的 wrapper 內，掛在 `StagedGrid` 最外層（比照原型 `grid-outer`，不隨捲動移動）。這個組合沒有恰好對應的 `/lab` use case（`(display)/chip` 只示範單獨使用 Chip），但 `Chip` + ghost icon `Button` 的組合方式，跟現有 `Lightbox.svelte`（`Chip` 顯示頁碼 + 同排 `Button ghost padding=icon` 做關閉/切換）高度相似，可視為沿用既有 lab 用法的組合方式，不算自創形狀。

### 2.7 與其他機制互動：延續原型設計，無架構衝突

- 與 Review Modal：不特殊感知，沿用（1.7 節）。
- 與合併式標籤驗證：不繞過，沿用。
- 1.8 節七條已知邊界情況：建議全部原封不動延續。

---

## 三、待與使用者收斂的問題（AskUser 待辦，摘要）

1. **Esc 退出圖章模式**：選 2.4 節 A/B/C 三個選項哪一個？
2. **StampTool 面板放置位置**：獨立區塊 vs 整合進 `InspectorFooter`？
3. **資料夾放置**：新建 `stamp/` vs 併入既有 `wall/`／`inspector/`？
4. **`pending` 是否擋 pin/apply 操作**：擋（新架構新增守衛）vs 不擋（跟原型一致）？

（另有 temp2.md 第七節的 4 個問題，兩份文件的問題會在對話中一次用 AskUser 收斂，不重複列出。）
