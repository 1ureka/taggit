# 匯入紀錄改為專屬引導 Modal

> 匯入紀錄按鈕不再直接打開檔案總管，而是先出現與本 app 相同風格的 modal 說明格式要求等的引導說明文字。

## 目標

新流程：**點擊「匯入紀錄」→ 打開 modal → 閱讀引導並「暫時」選擇檔案（尚未送出）→ 使用者確認沒問題後才按下「匯入」→ 開始實際匯入。**

這次不是把現有的純文字 `requestConfirm` 訊息提早顯示（見上一版計畫），而是做一個**專屬的新元件**，理由：

- 引導內容要有更好的排版（規則列表、圖示），不是一段純文字。
- 選擇檔案的地方**不是按鈕**，而是 modal 內的一個暫存區（drag & drop + 點擊皆可），選檔後只是「暫存＋預覽」，還沒有觸發匯入；要使用者在同一個畫面看過預覽、確認無誤後，自己按下「匯入」才會真正送出。
- 這種「選檔 → 預覽 → 二次確認才送出」的互動比通用的 `ConfirmModal`（一段文字 + 取消/確認兩個按鈕）複雜得多，硬塞進去只會讓 `ConfirmModal` 變成大雜燴；因此這裡建立一個新的、專屬 tagger 頁面的 modal 元件，直接建立在共用的 `Modal.svelte` 殼上（跟 `ConfirmModal.svelte` 一樣的做法：包一層 `Modal`，內容自己刻），而不是透過 `requestConfirm` 的全域事件匯流排。

## 現況

- 「匯入紀錄」是 `<label class="btn-outlined">` 包住 `visually-hidden` 的 `<input type="file" accept=".json">`（[tagger/+page.svelte:152-162](../src/routes/tagger/+page.svelte#L152-L162)），點擊直接觸發 OS 原生檔案選取窗。
- 選檔後才進入 `handleImportChange`（[taggerList.svelte.ts:163-251](../src/routes/tagger/taggerList.svelte.ts#L163-L251)）：讀檔 → `JSON.parse` → 檢查非空物件 → `requestConfirm` 顯示規則文字 + 筆數 → 確認後 POST `/api/committed`，以 SSE 顯示進度（`withProgressToast`，[dom.ts:73-114](../src/lib/components/dom.ts#L73-L114)）。
- `requestConfirm` / `ConfirmModal` 是**全域單例**、事件匯流排驅動（`window` CustomEvent，[dom.ts:48-53](../src/lib/components/dom.ts#L48-L53)、[overlay/ConfirmModal.svelte](../src/lib/components/overlay/ConfirmModal.svelte)），設計給任何頁面共用的簡單「文字 + 取消/確認」場景，不適合塞入拖放暫存區這種頁面專屬、狀態較多的 UI。
- 專屬 modal 已有前例可循：首頁的 `BrowseModal`（[home/browseModal.svelte.ts](../src/routes/(home)/browseModal.svelte.ts)）就是「頁面本地、非全域單例」的 modal 邏輯類別，本項目採同樣的檔案組織方式（`*.svelte` + 同名 `*.svelte.ts` class，僅該頁面 import）。

## 元件與檔案結構

新增兩個檔案，皆放在 `src/routes/tagger/`（頁面本地，不需要注冊為全域單例）：

- **`importGuideModal.svelte.ts`** — `ImportGuideModal` class，管理：
  - `open`（modal 開關）
  - `file: File | null` ＋ 解析預覽狀態（見下方「暫存區狀態」）
  - `pending`（正式匯入中）
  - 方法：`handleOpenClick`、`handleFileSelected(file)`（暫存＋client-side 解析預覽，不打 API）、`handleConfirmImportClick`（真正送出，複用現有的 POST `/api/committed` + SSE 邏輯）、`handleClose`（關閉並清空暫存狀態）
- **`ImportGuideModal.svelte`** — 純渲染，包一層 `Modal.svelte`，內容依下方設計刻版面。

`taggerList.svelte.ts` 的異動：

- `TaggerListActions.handleImportChange`（[taggerList.svelte.ts:163](../src/routes/tagger/taggerList.svelte.ts#L163)）目前混合了「解析」與「送出」兩件事，拆成兩段，分別給 `ImportGuideModal` 呼叫：
  - 解析段（純 client-side，`file.text()` → `JSON.parse` → `isRecord` 非空檢查）保留原本的錯誤訊息，回傳結果供 modal 顯示預覽或錯誤，不呼叫 API。
  - 送出段（POST `/api/committed` + SSE 進度 + `invalidateAll`）維持原邏輯不變，只是觸發時機從「選檔後自動執行」改成「使用者按下 modal 內的匯入按鈕才執行」。
- 舊的、選檔後才彈出的 `requestConfirm`（[taggerList.svelte.ts:186-189](../src/routes/tagger/taggerList.svelte.ts#L186-L189)）整段移除——引導與確認都已經在新 modal 裡完成，不需要再問一次。

`tagger/+page.svelte` 的異動（[+page.svelte:152-162](../src/routes/tagger/+page.svelte#L152-L162)）：

- 「匯入紀錄」的 `<label>` + 隱藏 `<input>` 整組換成一個普通 `<button class="btn-outlined" onclick={importGuide.handleOpenClick}>`。
- 頁面某處（footer 旁）加上 `<ImportGuideModal {importGuide} />`（或直接把 `importGuide` state 建在 `+page.svelte` 頂層再傳入）。

## 設計（因 draft 未指定視覺，這裡直接定案，沿用既有 CSS tokens）

Modal 沿用 `Modal.svelte` 的殼（`--bg-card` 背景、`--border-style` 邊框、`calc(var(--radius)*2)` 圓角），內容分三段：

**1. Header**：`IconDatabase` + 標題「匯入紀錄」，下方一行 `--text-muted` 的副標「選擇符合格式的 JSON 檔案，批次覆寫圖片的名稱／標籤／評分」。

**2. 規則列表**（取代原本一整段純文字）：一排 `--text-muted`、`--font-size-body2` 的小行，每行「圖示 + 一句話」，例如：

```
IconPhotoFilled   紀錄的 key 必須對應 images/ 中的實際檔名，不存在的圖片將被跳過
IconTagFilled     tags 為字串陣列，重複／空白／逗號會被自動整理
IconStarFilled    rating 可省略，範圍 0–5（整數）
IconAlertTriangleFilled（--color-warning）  已存在的紀錄會被覆寫，請確認來源檔案正確
```

每行 `display:flex; gap:0.5rem; align-items:flex-start`，圖示固定 16px、對齊第一行文字。這一段本身**不是**互動元件，純資訊呈現，視覺上比原本的一大段 `white-space:pre-line` 文字（[ConfirmModal.svelte:26-32](../src/lib/components/overlay/ConfirmModal.svelte#L26-L32)）更容易掃視。

**3. 檔案暫存區（dropzone，非按鈕）**：規則列表下方一個獨立區塊，三種狀態各自的樣式：

- **idle**（尚未選檔）：`border: 2px dashed var(--border)`、`border-radius: var(--radius)`、置中的 `IconUpload` + 文字「點擊或拖曳 JSON 檔案到此處」（`--text-dim`）。整個區塊可點擊（觸發隱藏的 `<input type="file" accept=".json" class="visually-hidden">`）也接受 `ondragover`/`ondrop`。
- **dragover**：邊框變 `var(--accent)` 實線、背景 `var(--bg-hover)`，給出「放開以選擇」的視覺回饋。
- **staged**：
  - 解析成功 → 邊框 `var(--color-success)`，內容改成「檔名 + `IconCheck` + 『N 筆紀錄』」，右側一個小的 `IconX`（`btn-ghost btn-sm`）可清除重選。
  - 解析失敗（非合法 JSON / 非物件 / 空物件）→ 邊框 `var(--destructive)`，內容顯示錯誤原因（沿用現有錯誤文案：「無法解析 JSON 檔案」／「JSON 必須是非空的物件」），同樣有清除重選的按鈕。

這個暫存區本身沒有任何「送出」的意味——選檔／拖放只會觸發 client-side 解析與預覽，**不會**呼叫任何 API，符合「使用者可以先暫時選擇檔案，看過沒問題再自己按匯入」的需求。

**4. Footer**：兩個按鈕，`取消`（`btn-outlined`，關閉 modal 並清空暫存狀態）與 `匯入`（`btn-primary`，僅在暫存區為「解析成功」狀態時可點擊，否則 `disabled`）。按下「匯入」後才真正呼叫 `handleConfirmImportClick`。

## 互動細節

- 暫存區的點擊與拖放都導向同一個「處理檔案」的內部方法：接住 `File`（`input.files[0]` 或 `event.dataTransfer.files[0]`）後跑 client-side 解析，更新暫存狀態；`ondragover` 需 `event.preventDefault()` 才能讓 `drop` 生效；`drop` 時同樣要 `preventDefault()` 避免瀏覽器預設把檔案在分頁中開啟。
- 拖放不會套用 `accept` 限制，需自行檢查副檔名（`.json`）或 MIME，非 JSON 檔案直接視為「解析失敗」狀態，訊息可為「請選擇 .json 檔案」。
- 「匯入」按下後：
  - 立即把 modal 關閉（或短暫顯示 disabled + loading 態再關閉——建議直接關閉，理由見下方決策），接著沿用現有的 `withProgressToast` 全域進度 toast 顯示 SSE 進度、完成後 `invalidateAll()`。這與現有「加入圖片」上傳的體驗一致，不用在 modal 裡重刻一套進度 UI。
- 關閉 modal（取消 / 背景點擊 / Esc，`Modal.svelte` 本身已處理 overlay click 與 Escape）一律清空暫存的 `file` 與解析狀態，下次打開是全新的 idle 狀態。
- 正式匯入進行中（`pending`）時 modal 理論上已經關閉（見上），不需要處理「匯入中還能不能關閉 modal」的情境。

## 需要決策

- **按下「匯入」後 modal 是否維持開啟顯示進度，還是直接關閉、交給全域 toast？**（建議：直接關閉＋沿用現有 `withProgressToast`。理由：與「加入圖片」等既有長時間操作的體驗一致，不必為這個功能重刻一套進度 UI，減少維護面。）
- **暫存區是否支援多檔案？**（建議：否，維持單一 JSON 檔案，`multiple` 不開啟，符合現有 API `/api/committed` 一次吃一份 JSON 物件的設計。）

## 風險 / 注意

- 這是本地、頁面專屬的 modal（只有 tagger 頁用得到），**不要**比照 `ConfirmModal`/`Toast` 做成全域單例掛在 `+layout.svelte`；直接在 `tagger/+page.svelte` 內實例化、傳入 `ImportGuideModal.svelte` 即可，維持模組邊界最小化。
- 檔案讀取（`file.text()`）與 `JSON.parse` 在使用者選檔／拖放的當下同步執行，大檔案可能有短暫卡頓；這與現有 `handleImportChange` 的既有行為相同，不在本次範圍內優化。
- 拖放事件記得只在 dropzone 區塊內攔截，不要在 `window` 層級攔截 `dragover`/`drop`（避免影響頁面其他拖放行為，例如 compare 頁的比較滑桿）。

## 驗收

- 點擊「匯入紀錄」：開啟新設計的 modal，可見規則列表（圖示＋逐行說明，非一大段文字）與下方的檔案暫存區（視覺上是虛線區塊，不是按鈕）。
- 尚未選擇檔案時，「匯入」按鈕為 disabled。
- 點擊暫存區或拖放合法 JSON 檔案：暫存區顯示檔名與紀錄筆數，邊框轉為成功色，「匯入」按鈕轉為可點擊；此時**尚未**發送任何請求。
- 選擇/拖放非法內容（壞掉的 JSON、非物件、空物件、非 `.json` 檔）：暫存區顯示對應錯誤訊息與錯誤色邊框，「匯入」按鈕維持 disabled。
- 點擊「取消」或背景關閉：不送出任何請求，暫存狀態清空；重新打開 modal 回到 idle。
- 點擊「匯入」：modal 關閉，SSE 進度、成功/跳過筆數 toast、完成後列表刷新，行為與現況一致。
