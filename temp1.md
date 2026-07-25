# Review 批次化：設計定案

> 範圍：只考慮 `routes/committed`。`staged`、`tags/cleanup` 尚未重寫，這裡的結論作為它們的標竿。
> 本文為分析與設計定案，不含實作。§八 是決策紀錄。

---

## 零、設計主旨

**這不是把一份清單分頁顯示，而是替 review 這個環節定義處理容量。**

- 草稿（drafts）與退回標記（reverts）可以無限多，不受任何限制。
- 但「審查並送出」這個環節，**一輪就是承擔某 25 份的責任**。
- `batch` 的作用不是捲動視窗，而是**選擇這一輪要承擔哪 25 份**。
- 因此在 review 內部，事實就是「這 25 份」——不是「全部之中我剛好在看的 25 份」。

視覺上長得像分頁，語意上是批次選擇器。**批次外的項目對 review 來說不存在，而不是存在但被隱藏。**

這一句是整份設計的地基：正因為批次外不存在，所有下游的數字、勾選、影響評估才「本來就會對」，不需要各自加條件。

---

## 一、這個框架把 review 的領域定義改成什麼

| | 原本 | 現在 |
|---|---|---|
| review 是什麼 | 所有待提交項的檢視器 | 一輪批次的**承擔單位** |
| 事實來源是什麼 | 全體待提交項 | **本批次的成員** |
| 各種 count 是什麼 | 全域統計 | 本批次的統計 |
| 送出是什麼 | 送出我勾的 | **結清這一批** |
| tag-impact 評估什麼 | 全部變更的影響 | **這一批送出後的影響** |

最後一列是這個設計最漂亮的地方：`tag-impact` 目前算的是「所有可送出項的標籤淨變化」，但使用者未必要送出全部——**它評估的東西跟即將發生的事情本來就對不齊**。批次化之後，它評估的正好是「按下送出會發生什麼」。這是語意變正確，不是副作用。

---

## 二、「截斷事實來源」在這份程式碼裡確實可行

逐一查過所有下游。目前的事實流：

```
drafts.touchedFiles + reverts.markedFiles
            ↓
   review.touchedFiles          ← 唯一事實來源
            ↓
 ┌──────────┼──────────────┬────────────────┐
 ↓          ↓              ↓                ↓
checkableFiles      submittableFiles   ReviewBody.entries
checkableCount      submittableCount   ReviewItemImage × N
bulkSelectionState        ↓
                    tag-impact.deltas
                    submit.handleSubmit(filenames)
```

**沒有任何一個下游繞過事實來源直接讀 drafts/reverts。** 所以把它從「全體」換成「本批次」之後：

| 下游 | 需要改嗎 |
|---|---|
| `checkableFiles` / `checkableCount` | 不用 |
| `submittableFiles` / `submittableCount` | 不用 |
| `bulkSelectionState` | 不用 |
| `handleToggleAll` / `handleSubmit` | 不用 |
| `ReviewBody.entries` | 不用（只有讀取的名稱要跟著改） |
| `tag-impact.deltas` | 不用 |
| `logic/submit.svelte.ts` | 不用 |
| `logic/guard.svelte.ts` | 不用 |

`guard.pendingCount`（[guard.svelte.ts:23](src/routes/committed/logic/guard.svelte.ts#L23)）直接讀 drafts/reverts，它問的是「離頁會遺失多少」——本來就該是全域，剛好不受影響。

**唯一被波及的是 [ReviewModal.svelte:17](src/routes/committed/header/ReviewModal.svelte#L17)**：工具列徽章借用了事實來源的長度當全域數字，截斷後會變成「本批筆數」，語意錯誤。改讀新的 `totalCount` 投影即可（見 §五）。

---

## 三、批次切換＝開始新的一輪

批次外的勾選不是一種可表達的狀態，所以「勾選要不要跨批保留」不是選擇題。

但這不代表什麼都不用做。目前 `handleOpen` 會全選所有可送出項，而它看到的只有第 1 批；**切到第 2 批時那 25 個會是全空的**，使用者得自己按全選。

所以切換批次必須走**跟 `handleOpen` 同一條私有路徑**：

```
private startBatch()
  ├─ submit.clearFailures()
  ├─ checked = {}
  └─ 全選本批可送出項
```

`handleOpen` 與四個換批 handler 共用它，不要各自複製一份全選邏輯。心智模型：**換批＝開始新的一輪，跟重開 modal 是同一件事。**

附帶性質：`checked` 可能殘留批次外的鍵，但它一律先與批次交集才被使用（`submittableFiles`），所以無害，且 `startBatch()` 會清掉。

---

## 四、順序：維持插入順序，不做任何排序

這一節的結論反直覺，所以把推導記下來。

一度打算把全體待提交項照 `pageData.items`（＝卡片順序）排，並把提交失敗的項目提到最前面。**兩者都撤回，排序整件事不做。**

### 4.1 失敗項會自動落在當前批的最前面

批次是「剩餘工作」的一段連續區間，而送出只會**刪除**成功項、不會新增。設批次起點為索引 `b`：

- `[0, b)` 這次沒被送出，原封不動保留
- 批次區間內成功的被刪掉，失敗的留下
- `b` 之後的區間原封不動

所以刪除後，新清單的索引 `b` 位置**正好就是第一個失敗項**：

```
第 2 批 (size 25) = [t26..t50]，其中 t30、t42 失敗
送出後  → [t1..t25, t30, t42, t51..t100]
第 2 批 → [t30, t42, t51, t52, ...]      ← 失敗項在最前面
```

不管停在第幾批都成立。被使用者**故意取消勾選**的項目也會一起留在前面，跟失敗項混在一起——這是對的，兩者都是「這批沒結清的事」。

反過來，`pageData.items` 順序會把失敗項打散回卡片位置、跟新滑入的項目交錯，**必須**額外加一層「失敗優先」的排序才能修好。等於先引進一個順序、再花力氣補救它自己造成的問題。

### 4.2 插入順序的重排幾乎不可觀察

`mutate` 裡 `this.drafts[filename] = next` 對既有 key 是純賦值，JS 物件的 key 順序不變。順序只在 `discard()` 真的 `delete` 之後、又重新加入時才跳到最後——也就是必須**改回原值 → 再改一次**。

而模態框開著時，drafts 只會因 submit 而變動，submit 只刪不加，不會打亂倖存者的相對順序。所以那個跳動一律發生在模態框關閉期間，使用者沒有「之前的位置」可以比對。

唯一真的看得到的流程：在 review 點名稱 → `handleEdit` 關閉模態框跳去修 → 該次修改剛好經過「等於原值」→ 回來發現它不在這批了。這是真實的，但它是**摩擦，不是資料遺失**，項目在最後一批，一定會被處理到。**已知並接受。**

### 4.3 退回標記永遠排在草稿之後

合併方式是 `[...new Set([...drafts.touchedFiles, ...reverts.markedFiles])]`，所以所有退回標記永遠在所有草稿之後，新增草稿會把退回項推到更後面的批次。

要消除它得引進一個 drafts 與 reverts 共用的觸碰序號——那才是真的多一個事實。**已知並接受**，因為它是可預測的分組，不是隨機跳動。

### 4.4 因此不需要新增依賴

`ReviewController` **不需要**引進 `pageData`。這也避開了一個定義域缺口：`guard` 只攔跨 pathname 的導航（[guard.svelte.ts:31](src/routes/committed/logic/guard.svelte.ts#L31)），所以「有草稿時改篩選條件」是允許且不清草稿的，那些項目會離開 `pageData.items` 但草稿仍在。若拿 `pageData.items` 當排序依據，就得為這批項目補一條 fallback 規則。不排序就沒有這個問題。

---

## 五、形狀

### 5.1 批次容量常數

**25**，作為 `ReviewController` 的私有欄位 `batchSize`，附一行說明它是「一輪能承擔的審查量」。不提到模組頂層、也不用全大寫——它不是跨檔案共享的組態，就只是這個 controller 的一個內部參數。

不要放 `$lib`：未來標籤型的 review 會有自己的數字（標籤的 diff 遠比圖片單純，容量可以更大）。**每個 review 場景各自決定自己的容量**，這正是它不該被抽走的理由。

### 5.2 通用切塊工具

分成純核心與響應式包裝兩層，沿用專案既有的 `virtualize.core.ts` / `virtualize.svelte.ts` 配對慣例：

- **`$lib/utils/pagination.core.ts`** —— `Paginated<T>` 型別與 `paginate()` 純函式。由 `$lib/query/{pagination,result}.ts` 提取而來（原本的 `QueryResult` 更名為 `Paginated`），因為那兩個檔案其實與查詢引擎無關，卻害得任何想用分頁的人都要跨進 `$lib/query` 的內部。提取後 `$lib/query` 與 `pagination.svelte.ts` 兩邊都只是它的下游。
- **`$lib/utils/pagination.svelte.ts`** —— `SveltePagination<T>`，與 `search-params.svelte.ts` 同族。對 review 一無所知。

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

三個設計要點：

- **收整個陣列而非收 total。** `paginate(items, page, limit)` 回傳 `{ items, total, page, pages }`，**形狀完全一致**，這個 class 直接 `return paginate(...)` 就好，是真的複用演算法本體而非換名包殼；`paginate()` 內建的 `clampedPage` 也順帶解掉送出後的越界問題。若收 total，total 與被切的陣列是兩個獨立輸入，可以對不上；收陣列則結構上不可能對不上。
- **邊界一律交給 `paginate()`。** `set()` 允許傳越界的頁碼，讀 `page` 一定合法，所以 `ReviewController` 的四個 `handle*Batch` 直接 `set(batch ± 1)` / `set(batches)` 即可，不需要自己判斷邊界。附帶：`size <= 0` 等於不分頁（`pages` 恆為 1），`ReviewPagination` 會自我隱藏，這正好接上 §5.6 的懶惰契約。
- **不另開 context。** 換批必須連動重置勾選（§三），拆成兩個 context 就得把這條線畫在元件層或 `$effect` 裡，違反 `docs/svelte_kit_routes.md` 的「狀態 in、事件 out」。而且專案的 controller 是**領域**單位，批次不是一個領域，它是 review 這個領域的容量維度。由 `ReviewController` **持有**，元件只認 `getReviewContext()`。
- **字彙留在通用層。** 這個 class 用 `page` / `pages`（tags 頁面用它時就真的是「頁」），`batch` 是 review 的領域字彙，由 `ReviewController` 投影時翻譯過去。

### 5.3 批次狀態放本地 `$state`，不進 URL

review modal 是暫時性 UI。而且 committed 的 URL 已被 `SvelteSearchParams<ImageQuery>` 用**真導航**佔著（[query.svelte.ts:13](src/routes/committed/logic/query.svelte.ts#L13)），寫進去會觸發 `goto` → 重跑 `load` → 整頁重查，完全沒必要。

### 5.4 `ReviewController` 的改動輪廓

```
新增   private pagination = new SveltePagination(() => 合併後的全體, BATCH_SIZE)

改名   touchedFiles  →  batchFiles = pagination.items      ← 新的事實來源
新增   totalCount    =  pagination.total                    ← 全域待提交數
新增   batch / batches = pagination.page / pages
新增   handleFirstBatch / handlePrevBatch / handleNextBatch / handleLastBatch
新增   private startBatch()                                 ← §三

不動   checkableOf / isChecked / checkableFiles / checkableCount /
       submittableFiles / submittableCount / bulkSelectionState /
       handleClose / handleToggle / handleToggleAll / handleEdit / handleSubmit
```

`touchedFiles` → `batchFiles` 的改名是刻意的：名字要說出它已經被截斷，讓每個呼叫點自我說明。改動純機械。

`batch` / `batches` / `totalCount` 與 `SveltePagination` 的 `page` / `pages` / `total` 一一對應，只是換成 review 的領域字彙。

`ReviewList` 既有的 `totalCount` prop 一併改名為 `listCount`（見 §5.6），避免與這裡的 `totalCount` 撞名——兩者意義相反，一個是本批項目數、一個是全域待提交數。

### 5.5 波及檔案

| 檔案 | 改動 |
|---|---|
| `$lib/utils/pagination.core.ts` | 新增（由 `$lib/query/{pagination,result}.ts` 提取，兩者刪除；`QueryResult` → `Paginated`） |
| `$lib/query/{index,images,tags}.ts` | 跟著改 import 與型別名；`index.ts` 原本對外的 `export type { QueryResult }` 沒有任何使用者，直接刪除 |
| `$lib/utils/pagination.svelte.ts` | 新增 |
| `$lib/components/review/ReviewList.svelte` | 收斂成三插槽的捲動容器，見 §5.6 |
| `$lib/components/review/ReviewListHeader.svelte` | 新增。原本內建在 `ReviewList` 的全選列，含頁碼提示文字 |
| `$lib/components/review/ReviewListFooter.svelte` | 新增。換頁列，`batches <= 1` 時自我隱藏。版面參考 [tags/chips/Pagination.svelte](src/routes/tags/chips/Pagination.svelte)，中央文字為「第 X / Y 頁」 |
| `logic/review.svelte.ts` | 主要改動，見 §5.4 |
| `header/ReviewBody.svelte` | 掛上 `ReviewPagination`；`touchedFiles` → `batchFiles`（`entries` 的建構邏輯一行都不用改） |
| `header/ReviewModal.svelte` | 徽章改讀 `totalCount` |
| `logic/tag-impact.svelte.ts` | 只加一則 TODO 註解，見 §七 |

`ReviewFooter` 的送出按鈕維持 `review.submittableCount`——截斷後它自動就是本批的實際數量，**不用改**。全域待提交數只出現在工具列的 `ReviewTrigger` 徽章。

### 5.6 `ReviewList` 收斂成三插槽

換頁列必須跟全選列在**同一個 scroller 內**——它們是清單的一部分，不是清單外的控制條。既然如此，`ReviewList` 乾脆退化成純粹的版面容器：

```
ReviewList  (pending / listCount / header? / footer? / children)
└── ul  inert={pending}
    ├── {@render header?.()}      → ReviewListHeader   全選 + 頁碼提示
    ├── {@render children()}      → ReviewItemImage × N
    └── {@render footer?.()}      → ReviewListFooter   換頁
```

- `ReviewList` 的 prop 從 9 個降到 5 個，它不再需要知道全選或分頁是什麼。整個家族的 prop 總數沒少，但每一組都有了單一擁有者——這才是重點，不是數量。
- 三個插槽的內容都自己渲染 `<li>` 根節點，與 `ReviewItemImage` / `ReviewItemTag` 的既有慣例一致，`ReviewList` 不必額外包一層。
- `listCount` 由原本的 `totalCount` 改名而來，用途是空狀態判斷；改名是為了跟 `review.totalCount`（全域）區隔，避免同一份檔案裡兩個 `totalCount` 意思相反。
- `ReviewListHeader` / `ReviewListFooter` **都不收 `pending`**。`ul` 的 `inert={pending}` 已經讓後代拿不到焦點，覆蓋層也擋住整片；邏輯防線在 `ReviewController.moveTo()` 的 `submit.pending` 檢查。多一個永遠冗餘的參數只會讓人以為它有作用。
- 頁碼資訊採「懶惰契約」：`batch` / `batches` 兩者都提供且 `batches > 1` 才會出現，否則 header 的提示文字與整個 footer 都不渲染。呼叫端可以無條件一直傳，不分批的 review 場景則整個不傳。

代價：`ReviewList` 不再結構性保證全選列存在，呼叫端可能忘記傳 `header`。四個呼叫端都在 repo 內，實務風險低，這是 composition 換來的。

命名上會多出一組鄰居：`ReviewHeader` / `ReviewFooter` 是 **modal 層**（標題塊、送出列），`ReviewListHeader` / `ReviewListFooter` 是**清單層**。前綴規則自洽，但 import 時容易手誤，型別會擋下來。

### 5.7 字彙分裂：程式碼用 `batch`，UI 用「頁」

刻意的：

- **程式碼**（`ReviewController` 的投影、`ReviewList` / `ReviewPagination` 的 props）一律 `batch` / `batches`，因為領域語意就是批次承擔。
- **使用者看到的文字**一律用「頁」——「第 X 頁 · 共 Y 頁」。「批次」在介面上太生硬。

翻譯只發生在元件的模板裡，controller 與 props 不需要知道 UI 怎麼講。`$lib/utils/pagination.svelte.ts` 那一層則本來就是 `page` / `pages`，通用層不涉入這個分裂。

---

## 六、刻意的取捨

**一輪只處理 25 份**：500 張待提交就得按 20 次送出。這是設計意圖，不是缺陷——圖片的 diff 相當複雜（名稱、評等、標籤增刪、問題提示），一次審 50 個已經累人，全選送出等於沒審查。

實際摩擦有限：真的要整批送出的情境，一個圖庫的整個使用生命週期大概發生不到十次。而且動線很順——永遠待在第 1 批，送出 → 那 25 張消失 → 下一批自動滑入 → 再送出，批次切換器是給「我想先處理後面那批」用的，不是主要動線。

若之後真的需要「全部送出」，那是**另一個功能**（跳過審查的批次提交），應該獨立設計，不要塞回 review 破壞批次語意。

**送出部分失敗後的批次組成**：失敗項留在最前且維持勾選，新滑入的項目未勾選，footer 數字＝失敗項數。這是對的——注意力該在失敗項上，要一併處理新項目再按一次全選即可。

---

## 七、431 的處置（只標 TODO）

來源是 [tag-impact.svelte.ts:76-78](src/routes/committed/logic/tag-impact.svelte.ts#L76-L78)，把標籤名聯集塞進 querystring。Node 的 `--max-http-header-size` 預設 16 KB 且**請求行計入**，中文標籤 percent-encode 後約 37 bytes/個，約 440 個相異標籤就爆。

批次化把它壓到罕見，但**沒有結構性解決**——25 張各自帶大量不重複標籤仍可能逼近上限。

- 在該行留一則 TODO：「proto API 用 GET+querystring 傳 N 個名稱，URL 計入 Node 的 16KB header 上限；轉正時改 POST」。
- **不要**在 review 這側做任何遷就（切 chunk 分批 GET、前端壓縮 names 等）。這是 proto API 的債，留在 proto 那一側。
- **25 的取值不以 431 為理由**。它是審查容量，不是門檻規避值。否則將來想調整容量時會踩到一個看不出原因的雷。

---

## 八、決策紀錄

| # | 決策 | 理由 |
|---|---|---|
| 1 | 批次容量 **25**，放 `logic/review.svelte.ts` | 圖片 diff 複雜，一次審 50 太累；未來標籤型 review 另有常數，所以不抽到 `$lib` |
| 2 | **維持插入順序**，不引進 `pageData` 排序 | 插入順序天然讓失敗項落在批次最前（§4.1）；引進卡片順序反而要額外補救，還會多一個定義域缺口（§4.4） |
| 3 | **不做失敗優先排序** | 同上，插入順序免費提供 |
| 4 | `SveltePagination` 放 `$lib/utils/pagination.svelte.ts` | 零依賴、要給 staged / cleanup 共用 |
| 4b | 把 `paginate()` 與 `QueryResult` 提取成 `$lib/utils/pagination.core.ts`，型別更名 `Paginated` | 它們與查詢引擎無關，留在 `$lib/query` 會逼下游跨模組邊界抓內部實作。不叫 `Page` 是因為 `@sveltejs/kit` 已經導出同名型別 |
| 5 | 全域數字由 `ReviewPagination` 顯示 | 送出按鈕只要保證是本批實際數量即可（截斷後自動成立） |
| 6 | 投影用 `batch` 字彙 | 貼合領域語意；通用層仍用 `page`，由 controller 翻譯 |
| 7 | 接受「退回標記永遠排在草稿之後」 | 可預測的分組，消除它得多引進一個共用觸碰序號（§4.3） |
| 8 | 接受「改回原值再改一次會跳到最後」 | 只發生在模態框關閉期間，摩擦而非資料遺失（§4.2） |
| 9 | 投影命名定為 `totalCount` / `batch` / `batches` | 與 `SveltePagination` 的 `total` / `page` / `pages` 一一對應 |
| 10 | `ReviewList` 收斂成 `header` / `children` / `footer` 三插槽，`totalCount` → `listCount` | 換頁列要在同一個 scroller 內，`ReviewList` 因此退化成版面容器，prop 各自回到擁有者身上（§5.6） |
| 11 | `ReviewListFooter` 顯示四顆按鈕 + 「第 X / Y 頁」 | 沿用 tags 頁面的既有版面；`batches <= 1` 時自我隱藏 |
| 12 | 程式碼用 `batch` 字彙，UI 文字一律用「頁」 | 「批次」在介面上太生硬，翻譯只發生在元件模板（§5.7） |

---

## 九、實作後的人工驗收清單

- [ ] 造出超過 3 批的待提交項目，開啟 review，確認可切換批次
- [ ] 切到第 2、3 批時，該批可送出項**自動全選**（不需手動按全選）
- [ ] 任一批內，「全選」三態、「N / M 可送出」、footer 張數三者互相自洽且都是本批數字
- [ ] `ReviewPagination` 顯示「第 X / Y 頁」，`ReviewList` 標頭右側顯示「· 第 X 頁 · 共 Y 頁」，兩者一致
- [ ] 待提交項目不足一批時，`ReviewPagination` 整個不出現、`ReviewList` 標頭也沒有頁碼文字
- [ ] UI 上任何地方都沒有出現「批次」二字
- [ ] 送出一整批成功後，下一批自動滑入，沒有空白批、批次索引不越界
- [ ] 送出部分失敗時，modal 保持開啟，失敗項出現在**本批最前面**且維持勾選
- [ ] 停在第 2 批送出並部分失敗，確認失敗項同樣落在第 2 批最前面（驗證 §4.1 不只對第 1 批成立）
- [ ] 切走再切回同一批，失敗標記已被清除（`startBatch` 的預期行為，不是 bug）
- [ ] 提交進行中時，批次切換器不可操作
- [ ] 工具列 `ReviewTrigger` 徽章仍是**全域**待提交總數，不隨批次切換變動
- [ ] 離頁守衛的「還有 N 張未提交」仍是全域數字，且與徽章一致
- [ ] 在第 2 批點某項名稱 → modal 關閉並跳到該圖編輯 → 重開 modal 回到第 1 批
- [ ] 標籤影響評估對應的是**本批即將送出**的內容，切換批次後重算
