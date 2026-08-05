# `tags/cleanup` 新架構設計

> 對齊 `docs/svelte_kit_routes.md`「頁面的架構」，以 `routes/tags` 與 `routes/committed` 為範本。
> 本文件只描述**設計與介面**，不含實作；程式碼片段僅用來釘住形狀與關鍵決策。

---

## 0. 這次要解決什麼

現行 `cleanup/logic/` 有 8 個檔案，其中 **3 個是純 `.ts`**（`suggestions.ts`、`changeset.ts`、`review-entry.ts`），且 controller 之間有數處越界（跨 controller 直接寫別人的 `$state`、只為了清快取而互相依賴）。

新架構的兩個硬性目標：

1. **`logic/` 底下 100% 是 `*.svelte.ts` controller**，一個純 `.ts` 都不留。
2. **與 `tags`、`committed` 同形**：同樣的領域拆法、同樣的審查流程、同樣的守衛寫法，讓三頁可以互相參照。

---

## 1. 判準：什麼情況才允許存在純 `.ts`

只有兩種，兩種都**不在 `logic/` 內**：

| 允許的例外 | 本頁的實例 | 為什麼不是 controller |
| --- | --- | --- |
| 伺服器端演算法 | `cleanup/suggestions.ts` | 只被 `+page.server.ts` 呼叫，跑在 Node、沒有任何響應式狀態，放進 `logic/` 會讓「`logic/` = 頁面 controller」這條定義破功 |
| 元件旁的版面常數 | `cleanup/cards/config.ts` | 純數值表、零邏輯零狀態，與 `committed/body/config.ts` 同形，屬於元件的一部分 |

反過來，過去誘發純 `.ts` 的三種偽需求，一律有 controller 的解法：

| 偽需求 | 現行檔案 | 新做法 |
| --- | --- | --- |
| 「投影型別要給元件用」 | `review-entry.ts` 的 `ReviewEntry` | 投影型別**不 export、甚至不定義**；投影動作留在 `ReviewBody.svelte` 內（與 `tags/header/ReviewBody.svelte` 的 `buildEntry` 同形） |
| 「payload 轉換是純函數」 | `changeset.ts` 的 `toPayload` | 變成 `submit.svelte.ts` 的**模組私有函式**，與 `tags/logic/submit.svelte.ts`、`committed/logic/submit.svelte.ts` 一致 |
| 「驗證是純函數」 | `review-entry.ts` 的衝突判斷 | 變成 controller 方法 `problemOf(name)`，與 `tags/logic/changeset.svelte.ts` 同名同形 |

---

## 2. 現況盤點

| 現行檔案 | 處置 | 理由 |
| --- | --- | --- |
| `logic/suggestions.ts` | **搬到 `cleanup/suggestions.ts`** | 伺服器端演算法，內容不動，只改路徑與 import |
| `logic/page-data.svelte.ts` | 保留，加一行型別出口 | 讓 `Suggestion` 由 `PageData` 推導，元件不再 import 伺服器模組 |
| `logic/samples.svelte.ts` | 保留，改為自動失效 | 現行靠 `operations` 與 `review` 兩處手動 `clear()`，是兩條純為了清快取而存在的依賴 |
| `logic/filter.svelte.ts` | 幾乎不動 | 只改型別來源 |
| `logic/operations.svelte.ts` | **拆解後刪除** | 「全頁操作鎖」把 refresh 與 submit 兩件事綁在同一個 `pending`，還被 `review` 從外部直接賦值 |
| `logic/schedule.svelte.ts` | **瘦身 + 吸收驗證** | 一個 controller 同時做排程、扁平化、離頁守衛三件事；三個 `Record` + 扁平化函式可壓成一個 `SvelteMap` |
| `logic/changeset.ts` | **併入 `submit.svelte.ts`** | 純 `.ts`，且檔頭自己就寫著 `TODO: 重新思考職責與正確位置` |
| `logic/review-entry.ts` | **拆進 `schedule` 與 `ReviewBody.svelte`** | 純 `.ts`；驗證屬於 controller、投影屬於元件 |
| `logic/review.svelte.ts` | **拆成 `review` + `submit`** | 現行的 review 同時做勾選、送出、失敗匯總、清快取、`goto` |

現行三處明確的越界，新架構全部消失：

```ts
// review.svelte.ts：跨 controller 直接寫別人的 $state
this.operationsCtx.pending = true;
// review.svelte.ts / operations.svelte.ts：只為了清快取而依賴 samples
this.samples.clear();
// schedule.svelte.ts：排程 controller 兼任離頁守衛
handleBeforeNavigate = (nav: BeforeNavigate) => { ... };
```

---

## 3. 目標檔案樹

```
routes/tags/cleanup/
├── +page.server.ts              # import { buildTagCleanupSuggestions } from "./suggestions"
├── suggestions.ts               # 伺服器端建議引擎（本頁唯一的純 ts，內容不變）
├── +page.svelte                 # 只呼叫 create*Context() + 掛 window 事件
├── logic/                       # 全部 *.svelte.ts，無例外
│   ├── page-data.svelte.ts      # SSR 資料 + Suggestion 型別出口
│   ├── samples.svelte.ts        # 證據縮圖快取（自動失效）
│   ├── filter.svelte.ts         # 分類頁籤 + 忽略清單
│   ├── schedule.svelte.ts       # 排程狀態 + 操作投影 + 結構驗證
│   ├── submit.svelte.ts         # payload 組裝 + 送出 + 失敗匯總
│   ├── review.svelte.ts         # 審查開闔 + 分批 + 勾選
│   ├── refresh.svelte.ts        # 重新整理
│   └── guard.svelte.ts          # 離頁守衛
├── header/
│   └── Filters.svelte
├── cards/
│   ├── config.ts                # 版面常數（允許的純 ts）
│   ├── Cards.svelte
│   ├── Card.svelte
│   ├── CardHeader.svelte
│   ├── CardBody.svelte
│   ├── CardSamples.svelte
│   └── CardFooter.svelte
└── review/
    ├── ReviewModal.svelte       # ReviewTrigger + Modal 骨架（新增 Trigger）
    └── ReviewBody.svelte        # 新增：清單投影，對齊 tags/committed
```

**命名說明**：`tags` 與 `committed` 對應的檔案叫 `query.svelte.ts`，但那兩頁的 controller 真的在管 URL 查詢條件；`cleanup` 的 `load` 不吃任何 `searchParams`，只有「重跑一次」這件事，因此誠實命名為 `refresh.svelte.ts` / `RefreshController`，與 `RefreshButton` 對應。

**目錄說明**：`tags`/`committed` 把 `ReviewModal.svelte` 放在 `header/`，`cleanup` 保留現行的 `review/` 資料夾——本頁 `header/` 只有 `Filters.svelte`，審查是自成一格的領域。這是刻意保留的差異，若你希望三頁連資料夾都一致，改放 `header/` 即可，設計其餘部分不受影響。

---

## 4. Controller 逐一設計

### 4.1 `page-data.svelte.ts`

與另外兩頁**一字不差**，只多一行型別出口：

```ts
import type { PageData } from "../$types";

/** 一則清理建議；型別自 SSR 資料推導，元件因此永遠不需要 import 伺服器端的 suggestions.ts */
export type Suggestion = PageData["suggestions"][number];
```

這是「`Suggestion` 該從哪來」的關鍵決定：`suggestions.ts` 搬出 `logic/` 後，若元件仍 `import type { Suggestion } from "../suggestions"`，等於讓 client 元件指向伺服器模組。改由 `PageData` 反推，型別只有一個來源，且方向永遠是「伺服器 → load → 型別 → 元件」。

### 4.2 `samples.svelte.ts`

**職責**：建議卡片的證據縮圖，懶加載並以 suggestion id 為鍵快取。
**依賴**：`page-data`。

介面：

```ts
/** 指定建議目前的快取狀態；`undefined` = 尚未查詢過 */
get: (id: string) => CacheEntry | undefined;
/** 查詢指定建議的樣本圖；已有快取或載入中則不重查 */
request: (s: Suggestion) => Promise<void>;
```

與現況的唯一差異：**移除公開的 `clear()`**，改為建構時掛失效 effect，與 `tags/logic/previews.svelte.ts` 同形：

```ts
constructor() {
  // SSR 資料更新後讓快取失效（送出成功與重新整理最後都會重跑 load）
  $effect(() => {
    this.pageData.value.suggestions;
    this.cache.clear();
  });
}
```

收穫：`submit` 與 `refresh` 都不需要認識 `samples`，而且涵蓋比手動呼叫更完整——任何導致 `load` 重跑的路徑都會失效，不會有人新增第三條送出路徑時忘記補 `clear()`。

模組私有函式 `tagsOf(s)` 與 `fetchByTags()` 留在本檔內。注意 `tagsOf` 對 `unused` 回傳 `[]`（沒有圖片可查），與 `schedule` 內「這張卡涉及哪些標籤」語意不同，**兩者刻意不共用**，避免又生出一個共用純 `.ts`。

### 4.3 `filter.svelte.ts`

**職責**：分類頁籤與忽略清單，純前端篩選（依決議**不進 URL**）。
**依賴**：`page-data`。

介面維持不變：`tab`、`kindCounts`、`total`、`visible`、`handleTabChange`、`handleDismiss`，連同 `KIND_LABELS`、`Tab` 一起 export。唯一改動是 `type Kind = Suggestion["kind"]` 的 `Suggestion` 改自 `./page-data.svelte` 取得。

### 4.4 `schedule.svelte.ts`

**職責**：每個標籤被排入哪一種清理操作，以及這批排程本身結構上有沒有問題。
**依賴**：無（只 `import type` 拿 `Suggestion`）。

```ts
/** 排入的一筆清理操作；每個標籤同時只會有一筆 */
export type CleanupOperation =
  | { kind: "merge"; name: string; count: number; to: string; toCount: number; both: number }
  | { kind: "delete"; name: string; count: number }
  | { kind: "hidden"; name: string; count: number };

class ScheduleController {
  /** 標籤名 → 操作，Map 的插入順序即審查清單順序 */
  private opMap = new SvelteMap<string, CleanupOperation>();

  /** 目前排程的所有操作 */
  operations: readonly CleanupOperation[] = $derived([...this.opMap.values()]);

  /** 指定標籤目前的操作，未排入為 `undefined` */
  operationOf(name: string): CleanupOperation | undefined;
  /** 指定標籤目前排入的操作種類，未排入為 `null`（卡片用來標示已排程） */
  statusOf(name: string): CleanupOperation["kind"] | null;
  /** 這則建議涉及的標籤中，已被排入操作的那一個；都沒有則為 `undefined` */
  scheduledNameOf(s: Suggestion): string | undefined;
  /** 指定標籤的操作是否有問題，以及有問題時的描述；沒有操作時恆為 `null` */
  problemOf(name: string): string | null;

  handleScheduleMerge = (from: Tag, to: Tag, both: number) => { ... };
  handleScheduleDelete = (tag: Tag) => { ... };
  handleScheduleHide = (tag: Tag) => { ... };
  /** 復原指定標籤的排程 */
  handleUndo = (name: string) => { ... };
  /** 清空整個排程（只在確認離頁後由 guard 呼叫） */
  handleClearAll = () => { ... };
}
```

四項實質改動：

1. **`ScheduleState` 與 `operationsFromSchedule()` 整個消失**。現行是三個 `Record` 加一個扁平化函式，每次讀 `operations` 都要重組；改成單一 `SvelteMap<string, CleanupOperation>` 之後，「同一標籤只能有一種排程」從三行 `delete` 變成 Map 的天然性質，`clear(name)` 私有方法也不再需要。
2. **`snapshot()` 消失**。它存在的唯一理由是把整包狀態餵給 `changeset.ts` 的 `toPayload`；`submit` 改讀 `operations` 後，內部狀態不必再對外洩漏。
3. **`handleScheduleMerge` 的簽名從 5 個位置參數收成 3 個**。卡片手上本來就是 `Tag` 物件（`s.a`、`s.b`、`s.topCo.tag`），拆 `count` 是 controller 的事：

   ```ts
   // 現行：schedule.handleScheduleMerge(a.name, b.name, a.count, b.count, both)
   // 新的：schedule.handleScheduleMerge(a, b, both)
   ```

4. **`problemOf` 吸收 `review-entry.ts` 的驗證**，與 `tags/logic/changeset.svelte.ts` 的同名方法對齊：

   ```ts
   problemOf(name: string): string | null {
     const op = this.operationOf(name);
     if (op === undefined || op.kind !== "merge") return null;
     const target = this.operationOf(op.to);
     if (target?.kind === "merge") return `目標「${op.to}」本身也被排入合併`;
     if (target?.kind === "delete") return `目標「${op.to}」已被排入刪除`;
     return null;
   }
   ```

   `tags` 版本還多驗名稱長度與逗號，本頁不需要——合併目標一定是既有標籤，使用者無法自由輸入。

`scheduledNameOf(s)` 是把現在**重複在 `Card.svelte`、`CardHeader.svelte`、`CardFooter.svelte` 三個檔案裡的同一段三行運算**收進 controller，元件端各自剩一行。

### 4.5 `submit.svelte.ts`

**職責**：把指定標籤目前的操作送出，成功的自排程移除、失敗的匯總回報。
**依賴**：`schedule`。
**範本**：`tags/logic/submit.svelte.ts`（近乎逐行對應）。

```ts
/** TODO: 端點把刪除／合併／隱藏三件事塞進同一組請求，轉正時應拆開 */
type TagsBatchPayload = {
  deletes: string[];
  renames: { from: string; to: string }[];
  hidden: { name: string; hidden: boolean }[];
};

/** 由操作清單組出端點要的請求內容（模組私有，取代 changeset.ts） */
function toPayload(ops: CleanupOperation[]): TagsBatchPayload { ... }

class SubmitController {
  /** 是否有一次送出正在進行中 */
  pending = $state(false);
  /** 上一次送出後的失敗匯總（name -> 原因） */
  lastFailures = $state<Record<string, string>>({});

  /** 清掉上一輪的失敗匯總 */
  clearFailures = () => { ... };
  /** 送出指定標籤目前的操作 */
  handleSubmit = async (names: string[]) => { ... };
}
```

`handleSubmit` 的步驟與 `tags` 完全一致：過濾出 `wanted` 的操作 → `toPayload` → `api.post("/api/proto/tags-batch")` → 失敗匯總寫入 `lastFailures` → 成功的 `schedule.handleUndo(n)` → 兩則 toast → `goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true })`。

與 `tags` 唯一的行為差異：本頁的 `hidden` 永遠是 `{ name, hidden: true }`（cleanup 只排「隱藏」，不排「取消隱藏」）。

`changeset.ts` 的 `submitChangeset()` 回傳 `Map<string, string>` 再由 review 轉成 `Record` 的那一段中轉沒有了——失敗匯總從頭到尾就是 `lastFailures`。

**保留的 proto API 債務註記**（與 `tags/logic/submit.svelte.ts` 一致，只標記不遷就）：

```ts
// TODO: 回傳的 `key` 是裸標籤名，能對回請求是靠操作清單的 name 唯一性，
//       端點自己並不知道也沒有驗證；`/api/proto` 轉正時應回三個各自獨立的結果集
```

### 4.6 `review.svelte.ts`

**職責**：審查對話框的開闔、分批、勾選、可送出判斷、觸發送出。
**依賴**：`schedule`、`submit`。
**範本**：`tags/logic/review.svelte.ts`（依決議導入分批，與另外兩頁完全同形）。

```ts
class ReviewController {
  /** 全部有操作的標籤，維持插入順序，**不應加入任何過濾** */
  private names = $derived(this.schedule.operations.map((o) => o.name));
  /** 一輪能承擔的審查量 */
  private pagination = new SveltePagination(() => this.names, 25);
  private checked = $state<Record<string, true>>({});

  /** 指定標籤不可送出的原因：結構問題優先於上次送出失敗 */
  problemOf(name: string): string | null {
    const structural = this.schedule.problemOf(name);
    if (structural !== null) return structural;
    const failure = this.submit.lastFailures[name];
    return failure ? `送出失敗：${failure}` : null;
  }
  checkableOf(name: string): boolean { return this.problemOf(name) === null; }
  isChecked(name: string): boolean { return !!this.checked[name]; }

  open = $state(false);
  totalCount  = $derived(this.pagination.total);
  batch       = $derived(this.pagination.page);
  batches     = $derived(this.pagination.pages);
  batchNames  = $derived(this.pagination.items);
  checkableNames   = $derived(this.batchNames.filter((n) => this.checkableOf(n)));
  checkableCount   = $derived(this.checkableNames.length);
  submittableNames = $derived(this.batchNames.filter((n) => this.checked[n] && this.checkableOf(n)));
  submittableCount = $derived(this.submittableNames.length);
  bulkSelectionState = $derived.by(() => { ... });   // 三態，與另外兩頁相同

  handleOpen = () => { ... };        // clearFailures → moveTo(1) → open = true
  handleClose = () => { ... };       // 送出中不允許關閉
  handleFirstBatch / handlePrevBatch / handleNextBatch / handleLastBatch;
  handleToggle = (name: string) => { ... };
  handleToggleAll = () => { ... };
  handleSubmit = async () => { ... }; // 呼叫 submit.handleSubmit(submittableNames)，再同步 checked
}
```

三點與 `tags` 的刻意差異：

1. **`problemOf` 上移到 controller**。`tags` 的 `ReviewBody.svelte` 自己把「結構問題」與「上次失敗」合成 `problem`，於是元件算出來的 `checkable` 與 controller 的 `checkableOf` 不同步——上次送出失敗的項目在畫面上顯示為不可勾選，但 `submittableNames` 仍把它算進去。本頁把合併放進 controller，畫面與實際送出的集合永遠是同一個判斷，也保住了現行 `review-entry.ts`「失敗後該筆需重開審查才能重試」的語意。
2. **`handleOpen` 自帶守衛**：`totalCount === 0 || submit.pending` 時直接 return。因為本頁有 Ctrl+S 快捷鍵，開啟不是只有 `ReviewTrigger` 一條路，守衛放在 controller 才涵蓋得完整。
3. **不提供 `handleDiscard`**。捨棄單筆由 `ReviewBody.svelte` 直接呼叫 `schedule.handleUndo(name)`——「拿 A 上下文的狀態投影，事件傳給 B 上下文」，與 `tags/header/ReviewBody.svelte` 的 `ondiscard={() => zones.handleDetach([entry.name])}` 同形。

### 4.7 `refresh.svelte.ts`

**職責**：重新整理，重算建議清單。
**依賴**：無。

```ts
class RefreshController {
  /** 是否有一次重新整理正在進行中 */
  refreshing = $state(false);
  handleRefresh = async () => { ... };  // 300ms → goto(location.href, { ..., invalidateAll: true }) → toast
}
```

現行 `operations.svelte.ts` 的 `handleRefresh` 內容直接搬過來，扣掉 `this.samples.clear()`（改由 samples 自己的 effect 負責），`pending` 更名為 `refreshing` 並且**只代表重新整理**。

### 4.8 `guard.svelte.ts`

**職責**：離頁守衛。
**依賴**：`schedule`、`submit`、`refresh`、`review`。
**範本**：`tags/logic/guard.svelte.ts`（近乎一字不差）。

```ts
class GuardController {
  /** 會真的改動資料或重跑查詢的操作是否進行中 */
  private get busy() { return this.submit.pending || this.refresh.refreshing; }

  handleBeforeNavigate = (nav: BeforeNavigate) => { ... };  // 判斷來源頁一律用 page.url.pathname
  handleBeforeUnload = (e: BeforeUnloadEvent) => { ... };
}
```

自 `schedule.svelte.ts` 整段搬出，並補上現行缺少的 `busy` 組合——現行只看 `operations.pending`，拆開後 refresh 與 submit 各自的進行中狀態都要涵蓋。確認離開後呼叫 `schedule.handleClearAll()`。

`page.url` 而非 `location` 的理由見 `docs/svelte_kit_routes.md`「不是所有地方都該換 `location`」，原註解保留。

---

## 5. 依賴圖與建立順序

```
page-data ──┬─→ samples
            └─→ filter

schedule ──┬─→ submit ──┬─→ review ──→ guard
           │            │              ↑
           └────────────┴──────────────┤
                          refresh ─────┘
```

`+page.svelte` 的建立順序（無循環）：

```svelte
<script lang="ts">
  let { data }: { data: PageData } = $props();

  // 依相依順序建立各領域 controller
  createPageDataContext(() => data);
  createSamplesContext();
  createFilterContext();
  createScheduleContext();
  createSubmitContext();
  const review = createReviewContext();
  const refresh = createRefreshContext();
  const guard = createGuardContext();

  beforeNavigate(guard.handleBeforeNavigate);

  function handleKeydown(e: KeyboardEvent) {
    if (isInEditable(e.target)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      review.handleOpen();   // 能不能開由 controller 自己判斷
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} onbeforeunload={guard.handleBeforeUnload} />

<div class="container">
  <Toolbar>
    <Filters />
    <RefreshButton pending={refresh.refreshing} onrefresh={refresh.handleRefresh} style="margin-left: auto;" />
    <ReviewModal />
  </Toolbar>
  <Cards />
</div>
```

`+page.svelte` 因此只剩三件事：建 context、掛 window 事件、排版。目前它還要讀 `schedule.touchedCount` 與 `operations.pending` 去餵 `ReviewTrigger` 的 props，那段連同 `<ReviewModal />` 一起收進 `review/ReviewModal.svelte`（`<dialog>` 走 top layer，放在 `Toolbar` 內不影響呈現，與 `tags`/`committed` 相同）。

---

## 6. 元件端連動

| 元件 | 改動 |
| --- | --- |
| `cards/Card.svelte` | 三行 `names` / `scheduledName` 運算 → `schedule.scheduledNameOf(s) !== undefined` |
| `cards/CardHeader.svelte` | 同上；其餘不動 |
| `cards/CardFooter.svelte` | 同上；三個 `handleSchedule*` 改傳 `Tag` 物件 |
| `cards/CardBody.svelte` | 只改 `Suggestion` 的 import 來源 |
| `cards/CardSamples.svelte` | 只改 import 來源，`samples.get/request` 介面不變 |
| `cards/Cards.svelte` | 不動（`filter.visible` 介面不變） |
| `header/Filters.svelte` | 不動 |
| `review/ReviewModal.svelte` | 併入 `ReviewTrigger`；清單內容抽到 `ReviewBody.svelte`；`pending` 來源改 `submit.pending` |
| `review/ReviewBody.svelte` | **新增**，對齊 `tags/header/ReviewBody.svelte` |

`ReviewBody.svelte` 的投影（唯一留在元件裡的投影邏輯，與 `tags` 擺放位置一致）：

```svelte
<script lang="ts">
  const review = getReviewContext();
  const submit = getSubmitContext();
  const schedule = getScheduleContext();

  /** 把一個標籤目前的操作與審查資訊投影成一列審查紀錄 */
  function buildEntry(name: string) {
    const op = schedule.operationOf(name)!;
    const problem = review.problemOf(name);
    const checkable = problem === null;

    const merging = op.kind === "merge";
    const target = merging ? op.to : undefined;
    // 容斥：合併後張數 = 目標張數 + 併入張數 - 兩者都有的張數。本頁不需要像 tags 那樣打 API
    const mergedCount = merging ? op.toCount + op.count - op.both : undefined;

    return { ...op, target, mergedCount, problem, checkable, checked: checkable && review.isChecked(name) };
  }

  const entries = $derived(review.batchNames.map(buildEntry));
</script>

<ReviewList pending={submit.pending} listCount={review.batchNames.length}>
  {#snippet header()}
    <ReviewListHeader
      checkedAll={review.bulkSelectionState}
      checkableCount={review.checkableCount}
      checkedCount={review.submittableCount}
      batch={review.batch}
      batches={review.batches}
      ontoggleall={review.handleToggleAll}
    />
  {/snippet}

  {#each entries as entry (entry.name)}
    <ReviewItemTag
      kind={entry.kind}
      checkable={entry.checkable}
      checked={entry.checked}
      tag={entry.name}
      count={entry.count}
      target={entry.target}
      mergedCount={entry.mergedCount}
      problem={entry.problem}
      ontoggle={() => review.handleToggle(entry.name)}
      ondiscard={() => schedule.handleUndo(entry.name)}
    />
  {/each}

  {#snippet footer()}
    <ReviewListFooter
      batch={review.batch}
      batches={review.batches}
      onfirst={review.handleFirstBatch}
      onprev={review.handlePrevBatch}
      onnext={review.handleNextBatch}
      onlast={review.handleLastBatch}
    />
  {/snippet}
</ReviewList>
```

`ReviewItemTag` 的 `kind` 支援 `rename | merge | delete | hidden | visible`，本頁只會產生 `merge | delete | hidden`，型別直接相容，無需轉換。

---

## 7. 消失的東西

| 消失 | 去向 |
| --- | --- |
| `logic/changeset.ts`（整檔） | `toPayload` → `submit.svelte.ts` 模組私有；`submitChangeset` → `submit.handleSubmit` |
| `logic/review-entry.ts`（整檔） | 驗證 → `schedule.problemOf`；`ReviewEntry` 型別與投影 → `ReviewBody.svelte` |
| `logic/operations.svelte.ts`（整檔） | `handleRefresh` → `refresh.svelte.ts`；`pending` 拆成 `submit.pending` 與 `refresh.refreshing` |
| `ScheduleState`、`operationsFromSchedule()`、`snapshot()` | 併成一個 `SvelteMap<string, CleanupOperation>` |
| `samples.clear()` 與兩處呼叫端 | `samples` 自己的失效 `$effect` |
| `schedule.handleBeforeNavigate/handleBeforeUnload` | `guard.svelte.ts` |
| `schedule.touchedCount` | `review.totalCount` |
| 三個元件裡重複的 `names`/`scheduledName` | `schedule.scheduledNameOf(s)` |

結果：`logic/` 由 8 檔（3 純 ts）變成 **8 檔（0 純 ts）**，`cleanup/` 全域只剩 `suggestions.ts` 與 `cards/config.ts` 兩個純 `.ts`，兩者都在 §1 的允許清單內。

---

## 8. 行為變化（需要你確認）

| # | 變化 | 說明 |
| --- | --- | --- |
| 1 | 審查清單改為 25 筆一批 | 依決議對齊另外兩頁；超過 25 筆時出現批次導覽列，換批會重新全選該批可送出項目 |
| 2 | 審查清單排序改為「排入的先後」 | 現行是 `合併全部 → 刪除全部 → 隱藏全部`；改用單一 Map 後變成使用者操作順序。若想保留分組，在 `operations` 加一段 kind 權重排序即可 |
| 3 | 重新整理期間審查按鈕不再 disabled | 現行共用一個 `operations.pending`；拆開後 `ReviewTrigger` 只被 `submit.pending` 鎖住，與 `tags`/`committed` 相同。離頁守衛仍同時涵蓋兩者 |
| 4 | 送出成功後樣本圖快取的失效時機 | 由「送出流程主動清」改為「`load` 資料一變就清」，涵蓋範圍更大，實際觀感應無差異 |
| 5 | **（建議，待你拍板）** 忽略清單是否隨重新整理清空 | 現行 `dismissed` 的註解寫「會隨建議清單重算而自然清空」，但 id 是 `similar:a,b` 這種穩定鍵，重算後同一則建議仍被忽略——註解與行為不符。建議比照 `samples` 加一個失效 `$effect` 讓註解成真；若你希望忽略是跨重新整理持續的，那就改註解 |

---

## 9. 保留的技術債（只標記，不遷就）

`/api/proto/tags-batch` 把刪除／合併／隱藏塞進同一組請求、且結果只用裸標籤名當 key，這兩點沿用 `tags/logic/submit.svelte.ts` 的 `TODO` 寫法標在 `submit.svelte.ts` 檔內，**不讓端點的形狀反過來影響 controller 的拆法**——`schedule` 依然是乾淨的「標籤 → 操作」模型，轉換只發生在 `toPayload` 那一個函式裡，端點轉正時只需要改那一處。

---

## 10. 驗收檢查清單（需人工操作）

實作完成後，以下項目需要你在瀏覽器手動確認：

- [ ] 卡片上排入合併／隱藏／刪除後，卡片邊框轉為已排程樣式，頁首 chip 顯示「已排入」，footer 只剩「取消排程」
- [ ] 同一個標籤先排合併、再排刪除，只保留最後一種操作（不會同時出現兩筆）
- [ ] 排入 26 筆以上操作後開啟審查，出現批次導覽列，前後翻批的勾選狀態符合預期
- [ ] 把 A 合併到 B、同時把 B 排入刪除：審查清單中 A 顯示「目標「B」已被排入刪除」且不可勾選
- [ ] 送出部分失敗時，失敗項留在清單並顯示「送出失敗：…」、對話框不關閉；關閉再開啟後該筆可重新勾選
- [ ] 送出成功後清單自動重算，且樣本縮圖重新查詢（不是舊快取）
- [ ] 重新整理期間 `RefreshButton` 顯示進行中，此時嘗試離開頁面會被擋下並提示「操作進行中，請稍候」
- [ ] 有未送出排程時點「返回標籤管理」→ 出現確認對話框；確認離開後排程被清空
- [ ] 有未送出排程時重新整理整頁 → 出現瀏覽器的離開確認
- [ ] Ctrl/Cmd + S 在沒有任何排程時不會開啟審查；在輸入框內按不會被攔截
- [ ] 忽略某則建議後，該分類的計數同步減少；切換分類頁籤計數正確
- [ ] 卡片捲出再捲回可視範圍，樣本縮圖不重新查詢（快取生效）

自動化驗證（實作後由我執行）：`npm run check`、`npm run build`、`npm run test`。
```
