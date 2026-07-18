# 圖章模式（Stamp Mode）實作規劃

> 目標：在新專案 `/staged`）重新實作舊專案 `tagger-b` 的圖章模式，邏輯可抄、markup 全新，並符合新專案的資料流慣例。
> 本文件分兩部分：一、原始設計完整還原（先確認基準，避免規劃時漏掉細節）；二、新架構下的實作規劃。

---

## 一、原始設計完整還原

### 1.1 一句話心智模型

圖章模式解決的問題：**批次匯入待審圖片時，很多圖片共享同一組名稱/評等/標籤，使用者不想一張一張進 inspector 重複打字**。做法是把「目前正在編輯的暫存」釘選成一個可重複使用的樣板（圖章），用點擊快速「蓋」到其他卡片的暫存上。圖章只作用在**尚未提交**的本地暫存（`Draft`），不直接呼叫後端 API，套用結果一樣要進審查 modal 才會真正送出。

> 注意，拖曳沒有要實現

### 1.2 生命週期

- **進入**：只能從 Inspector 內的 `StampTool` 觸發，按「以此張設為圖章」，條件是 `disabled={!isTouched(draft)}`（暫存必須「有動過」，但不要求 `isReady`／驗證通過）。
- **關閉 Inspector 不會退出圖章模式**——典型工作流是：inspector 釘選圖章 → 關 inspector 讓網格佔滿 → 在整個網格上點擊/拖曳連續蓋章 → 用徽章或 Esc 離開。(但是進入圖章模式不自動關閉 inspector!)
- **離開方式**：StampTool 面板「取消圖章」按鈕、`StagedGrid` 右上角浮動徽章本身可點擊。

### 1.3 啟用中的視覺提示（四層，全部在 `StagedGrid`）

1. **游標**：只有卡片可點擊區域套用 `cursor: copy`，不是全域游標，滑到卡片以外不變。
2. **卡片 tooltip(not title)/aria-label**：變成「點擊套用圖章」／「蓋上圖章：{file}」。
3. **整體容器外框**：`.grid-wrap.stamp-mode` 內縮描邊（`outline: 2px solid var(--accent); outline-offset: -2px;`），純被動提示、不可點擊。
4. **浮動徽章**：採用新專案的 Popover 組件，獨立於會捲動的容器，**不隨網格捲動**，顯示摘要文字 + X 圖示，本身可點擊離開，`tooltip="離開圖章模式"`。

### 1.4 徽章機制

- 內容是 `summarizeStamp(stamp)`：依 `stamp.include` 動態組字串——勾了名稱顯示「「name」」、勾了評等顯示「★N」、勾了標籤顯示標籤清單或「（無標籤）」，用「・」串接；三個欄位都沒勾則顯示「未選擇任何欄位」。
- 徽章文字**即時反映** `StampTool` 面板三個 checkbox 的即時勾選狀態（`stamp.include.*` 是同一個 `$state` 物件的巢狀欄位，checkbox 直接雙向綁定，沒有中間層）。
- 徽章**不顯示** `count`（已套用次數）；`count` 只在 `StampTool` 面板文字「來源：「{sourceFile}」・已套用 {count} 張」中顯示，純供參考，不影響任何邏輯。

### 1.5 點擊套用的行為與資料流

**直接改寫該卡片的 `Draft`，逐張即時生效**，不是先暫存「圖章內容」再統一套用。

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
> 不應該在有 SSR 可能下在模組層級寫 $state，我不確定你是否是這個意思，但我提醒一下
- **與 Review Modal**：完全沒有特殊感知——套用後的卡片跟手動編輯的卡片在審查列表裡長得一樣，沒有「這欄被圖章蓋過」的視覺區分，也沒有 old→new 箭頭對照。安全網完全依賴使用者在送出前用審查 modal 檢查一遍（原型 `draft.md`：「不做 hover 預覽，覆蓋是否符合預期交給審查 modal 把關」）。
- **與合併式標籤驗證**：`applyStamp` 不繞過任何驗證，套用後仍可能觸發 `problemOf` 警告（例如套用後仍 0 標籤）。

### 1.8 已知邊界情況（原型程式碼可推導出）

1. 名稱欄位永遠有值：勾選名稱套用時，若來源卡名稱空白，所有被蓋章的卡片會被寫入「來源檔名去副檔名」這個具體字串——無法用圖章「批次清空名稱」。
> 這是錯誤的
2. 圖章是快照、與來源卡解耦：來源卡之後的任何變動不會同步回已釘選圖章。
3. `include` 是活物件，中途調整只影響後續套用，同一輪圖章模式內前後蓋的卡欄位組合可能不同，無提示。
> 與第四題是同個問題
4. 點來源卡本身完全靜默，無 toast/視覺回饋。
> 可以增加 addToast 回饋
