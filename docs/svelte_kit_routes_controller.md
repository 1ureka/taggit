# Controller 架構取向

## 這份文件的定位

`docs/svelte_kit_routes.md` 規定的是**機制**：用 `setContext` / `getContext` 掛 class、
欄位優先 `private`、公開方法以 `handle*` 開頭、元件「狀態 in、事件 out」、邏輯收進 `logic/`。

這份文件規定的是**切法**：邊界要畫在哪裡、什麼該進 controller、什麼該留在模板。

兩者是正交的。**重寫前的 `staged` 完全符合機制卻依然難以維護**——
它有 `logic/` 資料夾、有 context、有 class、有 `handle*`，該有的都有。
問題全部出在邊界怎麼畫。所以看到一個頁面「已經照 `svelte_kit_routes.md` 寫了」，
不代表它的架構是好的。

以下所有反例都來自重寫前的 `staged`，可在 git 歷史中查證。

---

## 一、Controller 的四條原則

### 1. 刻意簡單化

一個 controller 應該可以用一句話說完它管什麼，而且那句話裡不該有「以及」。

> **反例**：`editor.svelte.ts`（157 行）同時管草稿狀態、目前編輯中的檔案、
> 永久刪除（含 confirm 對話框與 API 呼叫）、離頁守衛。四件事，四個變動理由。
>
> **改後**：拆成 `drafts` / `pointers` / `deletion` / `guard`，每個都能一句話說完。

檔案變多、總行數不減反增是正常的——重構的目的是重新分配職責，不是壓縮程式碼。
用行數衡量這種重構會得到錯誤結論。

### 2. 正交且單一職責

正交的意思是：改動 A 的內部實作，不需要打開 B。

判斷方法不是「它們看起來像不像同一件事」，而是**「它們會不會因為不同的原因而改變」**。
草稿的驗證規則會因為欄位需求而改；離頁守衛會因為導航行為而改。
兩者放同一個檔案，就是把兩個變動理由綁在一起。

> **反例**：舊 `review.svelte.ts` 同時是審查清單、標籤庫影響評估、提交流程。
> 想調整 debounce 時間得在審查勾選邏輯裡翻找。
>
> **改後**：`review`（清單與分批）/ `tag-impact`（影響評估）/ `submit`（提交）三個檔案。

**建立順序就是依賴圖。** `+page.svelte` 裡 `create*Context()` 的排列必須能線性排出來；
如果排不出來（出現循環），那不是「注入順序的問題」，而是邊界畫錯了。

### 3. 避免重複權威來源

同一個事實只能有一個地方說了算。這條原則有兩種違反方式，都要防：

**(a) 同一事實有多份計算**

> **反例**：`committed` 的 `guard.pendingCount` 是 `drafts.touchedFiles.length + reverts.markedFiles.length`，
> 而 `review.files` 是 `new Set([...同樣兩個來源])`。一個檔案同時有草稿與退回標記時，
> guard 算 2、review 算 1，離頁確認框與 ReviewTrigger 徽章互相打臉。
>
> **改後**：`guard` 直接讀 `review.totalCount`。唯一的計算點在 `review`，
> 並在該欄位上註明「同時是離頁守衛的依據，不可加入任何過濾」。

**(b) 同一狀態有多個擁有者**

> **反例**：`operations.pending` 是全頁共用鎖，但 `editor.handleDelete`、`review.handleSubmit`、
> `import.handleImportFile` 三個 controller 都直接寫 `this.operations.pending = true`。
> 誰負責解鎖？失敗路徑上誰漏了 `finally`？沒有人說得準。
>
> **改後**：`submit` / `deletion` / `import` / `refresh` 各自帶 `pending`，只有自己寫。
> 需要聚合的地方（`guard`）用 getter 讀取，不寫。

由此得到一條可機械檢查的規則：

> **controller 之間可以呼叫彼此的公開 `handle*`，但不可以寫彼此的欄位。**

`deletion.handleDelete` 呼叫 `pointers.handleSelect(next)` 與 `drafts.handleDiscardDraft([f])` 是對的；
舊 `editor.handleDelete` 寫 `operations.pending = true` 是錯的。

這條原則不限於 controller 之間。同一個「去副檔名的檔名」規則，
前端有 `stripExt`、後端有 `path.basename(f, extname(f).toLowerCase())`，
兩份實作對大寫副檔名的行為不一致，資料因此被污染。最後的解法一樣是砍掉一份。

### 4. 只暴露最少的方法

公開的方法愈少，別人能繞過你的不變式的路徑就愈少。

> **反例**：`editor.writeDraft(filename, draft)` 允許任何人整份覆寫任何草稿。
> 它存在的唯一理由是 `stamp` controller 要套用圖章。
> 有了它，`editor` 的「草稿寫入時自動判斷是否該捨棄」就形同虛設——繞過去就好了。
>
> **改後**：`drafts` 只暴露 `handleSetName` / `handleSetRating` / `handleSetTags` /
> `handleAddTags` / `handleRemoveTags` / `handleDiscardDraft` / `handleDiscardAll`，
> 全部走同一個 private `mutate()`，不變式無法被繞過。

兩個延伸做法：

- **讓單張與批次共用同一條寫入路徑。** `drafts` 的所有 handler 一律吃 `string[]`，
  單張情境傳 `[pointer.id]`。不需要為「批次」另開一套方法，也就不會有兩套行為漂移。
- **最小介面要持續維護，不是設計時做一次。** `drafts` 原本有 `tagDiffOf` / `fieldDiffOf`，
  在 `tag-impact` 簡化後它們退化成只有單一呼叫端、且回傳值恆定的空殼，於是移除。
  方法的呼叫端剩一個時，就該問它是否還該存在。

---

## 二、投影的規則

投影 = 把一或多個 controller 的狀態，組成某個元件當下要畫的形狀。

**投影屬於模板，不屬於 `logic/`。** 寫成元件裡的 `$derived` 或區域函式，不 export、通常也不需要具名型別。

> **反例**：`review-entry.ts` 匯出了 `ReviewEntry` 型別與 `buildReviewEntry()`。
> 一個只有單一消費者的顯示用形狀，被賦予了跨模組的公開 API，
> 之後任何欄位調整都變成「改型別 → 改 builder → 改元件」三步。
>
> **改後**：`buildEntry()` 直接寫在 `ReviewBody.svelte` 裡，不 export、不宣告型別。

投影**可以**很複雜甚至是重覆寫，這是刻意允許的：

- 可以很長。長到影響閱讀時，**單純為了長度而拆出子元件是正當的**——
  這是為了可讀性而拆，不是為了重用而拆。
- 可以組合數個 controller。`ReviewBody` 同時讀 `review` / `submit` / `drafts` / `pointers` / `selection`，
  這不是壞味道，這正是投影該做的事。
- 可以在不同元件裡重複類似的計算。**投影不需要去重。**

但複雜性只允許出現在「怎麼組」，不允許出現在「有幾種組法」：

> **同一種投影只能有一個構成方式。**
> 兩個元件如果都要呈現「一列待提交的變更」，那必須是同一段程式碼(可重覆)產出的，
> 不能各自用不同方式組——即使它只是顯示用的、即使只差一個欄位。
> 這仍然是重複權威來源，只是發生在投影層。

需要同一份投影的元件超過一個時，處理順序是：先問能不能由同一個父元件算好後往下傳；
不行才考慮把它上移。**上移到 controller 是最後手段**，而且上移的應該是「事實」而非「畫面形狀」。

---

## 三、診斷清單

接手一個舊頁面時，依序檢查以下項目。命中愈多，愈需要重畫邊界。

| 症狀 | 對應原則 |
| --- | --- |
| 有一個 controller 的檔名是 `editor` / `manager` / `state` / `operations` 這種泛稱 | 1 |
| 一個 controller 同時做「本地狀態」與「呼叫 API」與「開對話框」 | 1, 2 |
| 描述某個 controller 時必須用「以及」 | 1 |
| `create*Context()` 的排列順序講不出理由，或改順序就壞掉 | 2 |
| 某個 controller 的檔案裡出現另一個領域的關鍵字（守衛裡談草稿驗證、審查裡談 debounce） | 2 |
| 出現 `X.someField = ...` 這種跨 controller 的欄位賦值 | 3 |
| 兩個地方各自算出「同一個數字」（總數、可提交數、是否忙碌） | 3 |
| 存在一個全頁共用的 `pending` / `loading` / `busy`，且多人寫入 | 3 |
| 有一個方法只被一個 controller 呼叫，而且它的存在是為了繞過另一個方法的檢查 | 4 |
| 「單張」與「批次」是兩套獨立的寫入方法 | 4 |
| 元件裡出現 `bind:value={controller.someState.field}` 這種雙向綁定 | 4 |
| `logic/` 底下有 `*-entry.ts` / `*-view.ts` 這類只為顯示而存在的模組 | 投影 |
| 一個 controller 的存在理由是「為了做到某個缺失的通用能力」 | 見下 |

最後一項值得單獨說明。舊 `staged` 的 `stamp.svelte.ts`（圖章模式：釘選一份草稿，
在網格上點擊或拖曳連續套用）本質上是在補「沒有多選批次編輯」這個缺口，
為此引入了 `dragging` / `strokeSet` / `suppressClickFile` 一整套互動狀態，
以及前面提到的 `writeDraft` 破口。改成通用的多選 + 批次表單後，這個 controller 整個消失。

> **看到一個 controller 在實作一種很特別的互動時，先問它想達成的效果，
> 是不是某個通用機制的特例。**

---

## 四、同形 ≠ 共用

`staged` 與 `committed` 現在是同構的：同樣的資料夾、同樣的 controller 名稱、
大部分檔案逐字相同。但**刻意有兩處不共用**：

- `tag-impact`：`committed` 需要「淨變化 delta」因為它同時有標籤新增與移除；
  `staged` 只會新增、永遠不產生孤兒，寫成 35 行的專用版，而不是套用 95 行的通用版。
- `PanelFields` / `PanelBatchFields` / `PanelFooter`：兩頁各有一份。

判準是：

> **一個元件或模組如果必須用 `variant` 或旗標來區分「這是 A 頁的樣子 / 這是 B 頁的樣子」，
> 它就不該被共用。**

依此，`$lib/components/workflow/` 只留「殼與版面」（`ImageRecordPanel`、`ImageRecordPanelHeader`、
`ImageRecordCardWrapper` 等），「欄位內容與動作文案」一律歸各頁 `body/`。

追求同形是為了讓人在兩個頁面之間切換時不需要重新學習；
強行共用則是把兩個頁面的變動理由綁在一起，違反正交。**兩者不是同一件事。**

---

## 五、什麼不該是 controller

- **純傳輸邏輯** → `$lib/utils/`。SSE 的 fetch、錯誤解析、frame 拆解跟 `api.get/post` 同層級，
  抽成 `api.stream()` 之後，原本的 `import-api.ts` 整檔消失，controller 直接消費事件。
- **純呈現** → 元件。
- **只為顯示而存在的形狀** → 投影，見第二節。

反過來，`logic/` 裡出現非 controller 的檔案時要有明確理由。
重寫後的 `staged/logic/` 12 個檔案全部是 controller，沒有例外。

---

## 六、這份文件不主張什麼

- **不主張愈多 controller 愈好。** 拆分的依據是「變動理由不同」，不是數量。
  一個真的只做一件事的頁面，一個 controller 就夠。
- **不主張投影要去重、要抽象、要具名。** 投影的複雜度是自然的，壓抑它會把複雜度推進 controller。
- **不主張為了未來可能的需求預留擴充點。** `api.stream()` 之所以該抽，
  是因為它消除了**已經存在**的重複，不是因為「以後可能有別的串流端點」。
- **不主張兩個相似頁面要共用程式碼。** 見第四節。
