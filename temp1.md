# Review 批次化：實作總結

> 範圍：`routes/committed`。`staged`、`tags`、`tags/cleanup` 只受到共用元件改名的波及，行為未變。
> 本文記錄最終形狀、幾個不顯而易見的決策，以及待人工驗收的項目。

---

## 一、解決了什麼

審查清單的項目一多就出兩個問題：DOM 塞不下又無法虛擬化（每列高度取決於名稱長度、標籤 diff 行數、有無問題提示，事前算不出來），以及 `tags-impact` 把標籤名聯集塞進 querystring 而觸發 431。

做法**不是**把清單分頁顯示，而是替 review 這個環節定義處理容量：

- 草稿（drafts）與退回標記（reverts）可以無限多，不受限制。
- 但「審查並送出」一輪就是承擔某 25 份的責任。
- 使用者切換的不是視窗，而是**這一輪要承擔哪 25 份**。
- 因此在 review 內部，事實就是「這 25 份」——**批次外的項目對它而言不存在，而不是存在但被隱藏**。

正因為批次外不存在，所有下游的數字、勾選、影響評估才「本來就會對」，不需要各自加條件。`tag-impact` 尤其：它原本算的是「所有可送出項的標籤淨變化」，但使用者未必要送出全部，評估的東西跟即將發生的事情本來就對不齊；批次化之後它評估的正好是「按下送出會發生什麼」。這是語意變正確，不是副作用。

---

## 二、最終形狀

### 2.1 檔案

| 檔案 | 狀態 |
|---|---|
| `$lib/utils/pagination.core.ts` | **新增**。`Paginated<T>` 型別 + `paginate()` 純函式 |
| `$lib/utils/pagination.svelte.ts` | **新增**。`SveltePagination<T>` 響應式包裝 |
| `$lib/query/pagination.ts`、`$lib/query/result.ts` | **刪除**，內容提取到 `pagination.core.ts` |
| `$lib/query/{index,images,tags}.ts` | `QueryResult` → `Paginated`，改 import；`index.ts` 對外的型別轉出刪除（無使用者） |
| `$lib/components/review/ReviewList.svelte` | 收斂成三插槽的捲動容器 |
| `$lib/components/review/ReviewListHeader.svelte` | **新增**。全選列 + 頁碼提示 |
| `$lib/components/review/ReviewListFooter.svelte` | **新增**。換頁列，`batches <= 1` 自我隱藏 |
| `committed/logic/review.svelte.ts` | 事實來源改為本批；新增分批投影與四個換批 handler |
| `committed/header/ReviewBody.svelte` | 改成 snippet 組合；新增 `handleBackToEdit` |
| `committed/header/ReviewModal.svelte` | 徽章改讀 `totalCount` |
| `staged`、`tags`、`tags/cleanup` 的 `ReviewModal.svelte` | 只跟著改名與 snippet 組合，行為不變 |

### 2.2 分頁工具的兩層

沿用專案既有的 `virtualize.core.ts` / `virtualize.svelte.ts` 配對慣例。

`paginate()` 與結果型別原本住在 `$lib/query/`，但它們與查詢引擎無關，卻害得任何想用分頁的人都要跨進 `$lib/query` 的內部抓實作。提取之後 `$lib/query` 與 `pagination.svelte.ts` 兩邊都只是它的下游，方向平行。

型別更名為 `Paginated<T>`。**沒有取更直覺的 `Page<T>`，因為 `@sveltejs/kit` 已經導出同名型別**（`page` state 的型別），在這個專案裡撞名會很難讀。

```ts
class SveltePagination<T> {
  constructor(getItems: () => T[], size: number) {}
  get items(): T[];    // 當前這一塊
  get page(): number;  // 已 clamp
  get pages(): number;
  get total(): number;
  set(page: number): void;   // 唯一的 mutator，允許越界
}
```

- **收整個陣列而非收 total。** 若收 total，total 與被切的陣列是兩個獨立輸入，可以對不上；收陣列則結構上不可能對不上。而且 `paginate()` 的回傳形狀 `{ items, total, page, pages }` 與這個 class 完全一致，直接 `return paginate(...)` 就好，是真的複用演算法本體。
- **邊界全部交給 `paginate()` 的 `clampedPage`。** `set()` 允許傳越界的頁碼，讀 `page` 一定合法，所以呼叫端不必判斷邊界，送出後清單縮短導致的越界也自動處理。
- **`size <= 0` 等於不分頁**（`pages` 恆為 1），下游的自我隱藏規則因此自動生效。
- **通用層維持 `page` / `pages` 字彙**，`batch` 是 review 的領域字彙，由 controller 翻譯。

### 2.3 `ReviewController`

```
private files      = [...new Set([...drafts.touchedFiles, ...reverts.markedFiles])]
private pagination = new SveltePagination(() => this.files, 25)

batchFiles = pagination.items      ← 事實來源，以下全部由它推導
totalCount = pagination.total      ← 全域待提交數，只給工具列徽章用
batch / batches = pagination.page / pages
```

`checkableFiles` / `checkableCount` / `submittableFiles` / `submittableCount` / `bulkSelectionState` / `handleToggleAll` / `handleSubmit` **一個字都沒改**，換掉事實來源之後它們自動就是本批範圍。`submit.svelte.ts`、`guard.svelte.ts`、`tag-impact.svelte.ts` 也完全沒動——`guard` 直接讀 drafts/reverts 問「離頁會遺失多少」，本來就該是全域。

換批的唯一路徑：

```
private moveTo(batch)
  ├─ submit.pending 就直接返回
  ├─ pagination.set(batch)
  └─ 重建 checked：全選本批可送出項

handleOpen()                        四個換批 handler
  ├─ submit.clearFailures()         └─ moveTo(目標批次)
  ├─ moveTo(1)
  └─ open = true
```

批次外的勾選不是一種可表達的狀態，所以「勾選要不要跨批保留」從來不是選擇題。但也不是什麼都不用做——切到新的一批若不重新全選，那 25 個會是全空的，使用者得自己按全選。心智模型是**換批＝開始新的一輪**。

### 2.4 `ReviewList` 的三插槽

換頁列必須跟全選列在**同一個 scroller 內**——它們是清單的一部分，不是清單外的控制條。既然如此，`ReviewList` 乾脆退化成純粹的版面容器：

```
ReviewList  (pending / listCount / header? / footer? / children)
└── ul  inert={pending}
    ├── {@render header?.()}      → ReviewListHeader   全選 + 頁碼提示
    ├── {@render children()}      → ReviewItemImage × N
    └── {@render footer?.()}      → ReviewListFooter   換頁
```

- prop 從 9 個降到 5 個。整個家族的 prop 總數沒少，但每一組都有了單一擁有者——這才是重點，不是數量。
- 三個插槽的內容都自己渲染 `<li>` 根節點，與 `ReviewItemImage` / `ReviewItemTag` 的既有慣例一致。
- `ReviewListHeader` / `ReviewListFooter` **都不收 `pending`**。`ul` 的 `inert={pending}` 已經讓後代拿不到焦點，覆蓋層也擋住整片；邏輯防線在 `moveTo()` 的 `submit.pending` 檢查。多一個永遠冗餘的參數只會讓人以為它有作用。
- 頁碼資訊是「懶惰契約」：`batch` / `batches` 兩者都提供且 `batches > 1` 才出現，否則 header 的提示文字與整個 footer 都不渲染。呼叫端可以無條件一直傳；`staged`、`tags`、`tags/cleanup` 則整個不傳，日後要不要分批也不必回頭改介面。
- 代價：`ReviewList` 不再結構性保證全選列存在，呼叫端可能忘記傳 `header`。四個呼叫端都在 repo 內，這是 composition 換來的。

命名上多出一組鄰居：`ReviewHeader` / `ReviewFooter` 是 **modal 層**（標題塊、送出列），`ReviewListHeader` / `ReviewListFooter` 是**清單層**。前綴規則自洽，但 import 時容易手誤，靠型別擋。

### 2.5 字彙分裂：程式碼用 `batch`，UI 用「頁」

刻意的。controller 投影與元件 props 一律 `batch` / `batches`，因為領域語意就是批次承擔；使用者看到的文字一律「第 X 頁 · 共 Y 頁」，因為「批次」在介面上太生硬。翻譯只發生在元件模板裡。

---

## 三、順序：維持插入順序，不做任何排序

這一節的結論反直覺，把推導留下來，免得日後有人「順手修好」。

一度打算把全體待提交項照 `pageData.items`（＝卡片順序）排，並把提交失敗的項目提到最前面。**兩者都撤回。**

### 3.1 失敗項會自動落在當前批的最前面

批次是「剩餘工作」的一段連續區間，而送出只會**刪除**成功項、不會新增。設批次起點為索引 `b`：`[0, b)` 這次沒被送出、原封不動；批次區間內成功的被刪掉、失敗的留下；`b` 之後原封不動。所以刪除後，新清單的索引 `b` 位置**正好就是第一個失敗項**：

```
第 2 批 (size 25) = [t26..t50]，其中 t30、t42 失敗
送出後  → [t1..t25, t30, t42, t51..t100]
第 2 批 → [t30, t42, t51, t52, ...]      ← 失敗項在最前面
```

不管停在第幾批都成立。被使用者**故意取消勾選**的項目也會一起留在前面，跟失敗項混在一起——這是對的，兩者都是「這批沒結清的事」。

反過來，`pageData.items` 順序會把失敗項打散回卡片位置、跟新滑入的項目交錯，**必須**額外加一層「失敗優先」的排序才能修好。等於先引進一個順序、再花力氣補救它自己造成的問題。

### 3.2 插入順序的重排幾乎不可觀察

`mutate` 裡 `this.drafts[filename] = next` 對既有 key 是純賦值，JS 物件的 key 順序不變。順序只在 `discard()` 真的 `delete` 之後、又重新加入時才跳到最後——也就是必須**改回原值 → 再改一次**。

而模態框開著時，drafts 只會因 submit 而變動，submit 只刪不加，不會打亂倖存者的相對順序。所以跳動一律發生在模態框關閉期間，使用者沒有「之前的位置」可以比對。

唯一真的看得到的流程：在 review 點名稱 → 關閉模態框跳去修 → 該次修改剛好經過「等於原值」→ 回來發現它不在這批了。這是真實的，但它是**摩擦，不是資料遺失**，項目在最後一批，一定會被處理到。

### 3.3 合併順序比直覺複雜

`Set` 保留的是**首次出現**的位置，所以順序不是「草稿全部在前、退回標記全部在後」，而是：

> 有草稿的檔案（依草稿插入序，**含同時被標記退回的**）→ 只有退回標記的檔案（依標記插入序）

因為兩種狀態可以並存（[submit.svelte.ts:31](src/routes/committed/logic/submit.svelte.ts#L31) 的註解就明講了），一個檔案的**所屬區段會變**，位置因此可以雙向跳動：

- 有草稿（位置 3）並被標記退回 → 位置不變；接著草稿改回原值被 `discard` → 落進退回區尾巴，**往後跳**。
- 只有退回標記（位置 50）→ 接著被編輯而產生草稿 → 進入草稿區末端，**往前跳**。

即使如此，3.1 與 3.2 都不受影響：3.1 只依賴「送出只刪不加」，而刪除對這個合併是保序的（每個倖存元素的位置由它在 `concat(drafts, reverts)` 的首次出現決定，移除其他元素不改變倖存者的相對順序，也不改變誰屬於哪一區）；3.2 的跨區段遷移全由「編輯」或「標記退回」觸發，兩者都只能在模態框關閉時做。

要消除這些跳動得引進一個 drafts 與 reverts 共用的觸碰序號，那才是真的多一個事實。

### 3.4 因此 `ReviewController` 不需要 `pageData`

這也避開了一個定義域缺口：`guard` 只攔跨 pathname 的導航（[guard.svelte.ts:31](src/routes/committed/logic/guard.svelte.ts#L31)），所以「有草稿時改篩選條件」是允許且不清草稿的，那些項目會離開 `pageData.items` 但草稿仍在。若拿 `pageData.items` 當排序依據，就得為這批項目補一條 fallback 規則。不排序就沒有這個問題。

---

## 四、其他不顯而易見的決策

### 4.1 `clearFailures()` 只在 `handleOpen`，換批不清

失敗標記因此在整個 modal session 內持續：切去別批看一眼再回來，紅字仍在原處；只有重新開啟、或下一次 `submit` 覆寫整個 `lastFailures` 時才消失。切走就弄丟「剛剛哪幾張失敗」是沒有道理的。

### 4.2 `moveTo` 整包換掉 `checked`，不逐鍵寫入

一次換批只觸發一次響應式寫入，而且 `checked` 結構上不可能累積批次外的殘鍵。

### 4.3 「回到這張圖繼續編輯」由元件組合，不放進 controller

[Inspector.svelte:29](src/routes/committed/body/Inspector.svelte#L29) 的 `{#if selection.active}` 優先於 `{:else if pointer !== null}`，所以在多選模式下只設指標是不夠的——面板仍顯示批次編輯器，畫面上等於只是關掉 modal。

正確動作是三步，而它跨三個 controller，沒有任何一個該擁有全部：

```ts
// ReviewBody.svelte
const handleBackToEdit = (filename: string) => {
  review.handleClose();
  selection.handleExit();
  pointers.handleSelect(filename);
};
```

所以放在元件層，符合文件的「投影 A 上下文、事件給 B 上下文」。好處是 `ReviewController` 連 `pointers` 依賴都不需要，它只認識 drafts / reverts / submit。

**特別不要把切回單選放進 `pointers.handleSelect()`。** 那樣所有呼叫端都自動修好，很誘人，但 `pointers → selection → pointers` 是**真的環**。

（`review.handleClose()` 在 `submit.pending` 時會提前返回，而後兩步照跑，理論上是半執行；但 `ul` 有 `inert={pending}`，那顆按鈕在 pending 期間點不到。）

### 4.4 25 這個數字

圖片的 diff 相當複雜（名稱、評等、標籤增刪、問題提示），一次審 50 已經累人，全選送出等於沒審查。500 張待提交就得按 20 次送出——這是設計意圖，不是缺陷；真的要整批送出的情境，一個圖庫的整個使用生命週期大概發生不到十次。

它是內聯的字面值而非具名常數，理由寫在 `pagination` 欄位的 JSDoc。不抽到 `$lib`：未來標籤型的 review 會有自己的數字（標籤的 diff 遠比圖片單純，容量可以更大），**每個 review 場景各自決定自己的容量**。

若之後真的需要「全部送出」，那是**另一個功能**（跳過審查的批次提交），應該獨立設計，不要塞回 review 破壞批次語意。

### 4.5 431 只標 TODO，不在 review 側遷就

來源是 [tag-impact.svelte.ts:76-78](src/routes/committed/logic/tag-impact.svelte.ts#L76-L78)，把標籤名聯集塞進 querystring。Node 的 `--max-http-header-size` 預設 16 KB 且**請求行計入**，中文標籤 percent-encode 後約 37 bytes/個，約 440 個相異標籤就爆。

批次化把它壓到罕見，但**沒有結構性解決**——25 張各自帶大量不重複標籤仍可能逼近上限。正解是 proto API 轉正時改成 POST。**不要**在 review 側做任何遷就（切 chunk 分批 GET、前端壓縮 names 等），那是 proto API 的債。

**25 的取值也不以 431 為理由**，否則將來想調整容量時會踩到一個看不出原因的雷。

---

## 五、已知並接受的行為

- 反覆編輯同一張圖（改動 → 改回原值 → 再改動）會讓它跳到最後一批（§3.2）。
- 草稿與退回標記並存時，項目位置可雙向跳動（§3.3）。
- 送出部分失敗後，本批 = 失敗項（維持勾選、在最前面）+ 新滑入的項目（未勾選），footer 數字＝失敗項數。注意力該在失敗項上，要一併處理新項目再按一次全選即可。
- 換頁列與全選列都在 scroller 內，會跟著內容捲動——要按下一頁得先捲到底。對審查流程而言這是對的（捲到底＝看完這批才換批），但與「隨時可按」的手感不同。
- `ReviewList` 的「全選」文案未改。原本考慮改成能看出是本批，但頁碼提示就在同一列右側，語境已足夠；而且沒分批時改成「全選本頁」反而是錯的。

---

## 六、未完成

- **`tag-impact.svelte.ts` 的 431 TODO 註解尚未加。** 內容見 §4.5。
- **`handleSubmit` 在全部成功時仍關閉 modal。** 這跟 §4.4 描述的動線（送出 → 那 25 張消失 → 下一批自動滑入 → 再送出）有出入，照現在的實作 500 張要開關 20 次。改成留在 modal 就必須順便重新全選新一批，而「送出」按鈕就在原地，有連按兩次送出沒看過內容的風險。**待決定。**

---

## 七、人工驗收清單

自動化驗證（`npm run check` / `build` / `test`）全數通過，以下需要實機確認。

**分批基本行為**
- [ ] 造出超過 3 批的待提交項目，開啟 review，確認可切換批次
- [ ] 切到第 2、3 批時，該批可送出項**自動全選**（不需手動按全選）
- [ ] 任一批內，「全選」三態、「N / M 可送出」、footer 張數三者互相自洽且都是本批數字
- [ ] `ReviewListFooter` 顯示「第 X / Y 頁」，`ReviewListHeader` 右側顯示「· 第 X 頁 · 共 Y 頁」，兩者一致
- [ ] 待提交項目不足 25 張時，換頁列整個不出現、標頭也沒有頁碼文字
- [ ] 提交進行中時，換頁列不可操作
- [ ] UI 上任何地方都沒有出現「批次」二字

**送出與失敗**
- [ ] 送出一整批成功後，下一批自動滑入，沒有空白批、批次索引不越界
- [ ] 送出部分失敗時，modal 保持開啟，失敗項出現在**本批最前面**且維持勾選
- [ ] 停在第 2 批送出並部分失敗，確認失敗項同樣落在第 2 批最前面（驗證 §3.1 不只對第 1 批成立）
- [ ] 切走再切回同一批，失敗標記**仍在**；關掉 modal 重開後才消失

**全域數字**
- [ ] 工具列 `ReviewTrigger` 徽章是**全域**待提交總數，不隨批次切換變動
- [ ] 離頁守衛的「還有 N 張未提交」仍是全域數字，且與徽章一致

**跨 controller 的互動**
- [ ] 在第 2 批點某項名稱 → modal 關閉並跳到該圖編輯 → 重開 modal 回到第 1 批
- [ ] **在多選模式下**開啟 review 並點某項名稱 → 確實切回單選並顯示該圖的編輯面板（§4.3）
- [ ] 標籤影響評估對應的是**本批即將送出**的內容，切換批次後重算

**未受影響的路由（回歸）**
- [ ] `staged`、`tags`、`tags/cleanup` 三個 review modal 外觀與行為與改動前一致，沒有多出頁碼文字或換頁列
