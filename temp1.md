# `routes/staged` 重寫設計

目標：讓 `staged` 的架構與 `committed` 幾乎同形，差異只留在「暫存區本來就沒有的東西」上。
本文件以 **controller 邊界** 為主軸，元件樹只描述對應關係。

---

## 一、與 `committed` 的本質差異

| 面向 | `committed` | `staged` | 結論 |
| --- | --- | --- | --- |
| 資料來源 | DB 紀錄（有 `updatedAt`） | 檔案系統清單（純檔名） | 不需要 `snapshots` |
| 編輯基準 | 每張圖各自的 DB 快照，會隨 `load` 重跑而變動 | 恆定的 `{ name: "", rating: 0, tags: [] }` | 基準是純值，不需要引用計數快取 |
| 樂觀鎖 | `expectedUpdatedAt` | 無（`commitRecord` 是新增） | `submit` 少一個欄位 |
| 破壞性操作 | 「退回暫存區」＝**標記**，可批次、進審查清單、可取消 | 「永久刪除」＝**即時單張 + confirm** | 沒有 `reverts` controller |
| 查詢條件 | 搜尋 / 排序 / 評等 / 標籤篩選 | 無 | 沒有 `query` controller，`refresh` 獨立出來 |
| 標籤影響 | 有新增也有孤兒（退回會移除標籤） | 只會新增 | `tag-impact` 寫成 `staged` 專用的簡化版 |
| 圖章模式 | 無 | 現有，**本次移除** | 刪除 `stamp` controller 與 `StampBadge` |
| 匯入紀錄 | 無 | 現有，保留 | 多一個 `import` controller |
| 進度指示 | 無 | `SessionProgress`，保留 | `drafts` 需多導出 `readyCount` |

---

## 二、檔案樹

```
routes/staged/
├── +page.server.ts               # 不動
├── +page.svelte                  # 只呼叫 create*Context() + 掛 window 事件
├── header/
│   ├── SessionProgress.svelte    # 對應 committed 的 QueryControls 位置
│   ├── ImportModal.svelte
│   ├── ImportGuide.svelte
│   ├── ReviewModal.svelte        # 內含 ReviewTrigger（同 committed）
│   └── ReviewBody.svelte         # buildEntry 投影寫在這裡
├── body/
│   ├── Rail.svelte               # 單選 / 多選切換
│   ├── Cards.svelte              # 虛擬化卡片牆
│   ├── Card.svelte               # 單張卡片
│   ├── Panel.svelte              # 組裝：單張表單 / 批次表單
│   ├── PanelFields.svelte        # 單張表單欄位（頁面自有）
│   ├── PanelBatchFields.svelte   # 批次表單欄位（頁面自有）
│   ├── PanelFooter.svelte        # 面板底部動作列（頁面自有）
│   └── config.ts
└── logic/
    ├── page-data.svelte.ts
    ├── drafts.svelte.ts
    ├── pointers.svelte.ts
    ├── submit.svelte.ts
    ├── deletion.svelte.ts
    ├── refresh.svelte.ts
    ├── import.svelte.ts
    ├── import-api.ts             # 唯一保留的非-controller（純 SSE 傳輸解析）
    ├── guard.svelte.ts
    ├── review.svelte.ts
    ├── tag-impact.svelte.ts
    ├── selection.svelte.ts
    └── selection-draft.svelte.ts
```

### 刪除的檔案

| 現有檔案 | 去向 |
| --- | --- |
| `staged/logic/editor.svelte.ts` | 拆成 `drafts` + `pointers` + `deletion` + `guard` |
| `staged/logic/operations.svelte.ts` | 拆成 `refresh`，其餘 pending 各 controller 自帶 |
| `staged/logic/lightbox.svelte.ts` | 併入 `pointers` |
| `staged/logic/stamp.svelte.ts` | 移除（圖章模式取消） |
| `staged/logic/draft.ts` | 型別與驗證進 `drafts`，`commitDrafts` 進 `submit` |
| `staged/logic/review-entry.ts` | `buildEntry` 回到 `header/ReviewBody.svelte` 內部 |
| `staged/cards/StampBadge.svelte` | 移除 |
| `staged/cards/*`、`inspector/*`、`review/*` | 併入 `body/` 與 `header/` |
| `staged/inspector/Inspector.svelte` | 改名並改寫成 `body/Panel.svelte` |
| `staged/inspector/InspectorHeader.svelte` | 改用共用的 `ImageRecordPanelHeader variant="single"` |
| `staged/inspector/InspectorFields.svelte` | 改寫成 `body/PanelFields.svelte` |
| `staged/inspector/InspectorFooter.svelte` | 改寫成 `body/PanelFooter.svelte`（圖章區塊移除） |

---

## 三、Controller 設計

### 建立順序（`+page.svelte`）

```ts
const pageData = createPageDataContext(() => data);
createDraftsContext();          // ← pageData
const pointers = createPointersContext();  // ← pageData
createSubmitContext();          // ← drafts
createDeletionContext();        // ← pageData, pointers, drafts
const refresh = createRefreshContext();    // 無依賴
createImportContext();          // 無依賴
const guard = createGuardContext();        // ← drafts, submit, deletion, import
createReviewContext();          // ← drafts, submit
createTagImpactContext();       // ← drafts, review
createSelectionContext();       // ← pageData, pointers
createSelectionDraftContext();  // ← selection, drafts

beforeNavigate(guard.handleBeforeNavigate);
```

依賴是單向的，無循環。`deletion` 必須排在 `pointers` 之後（刪完要跳下一張）。

---

### 1. `page-data.svelte.ts`

與 `committed` 逐字相同，只是 `PageData` 內容為 `{ stagedFiles: string[] }`。

---

### 2. `drafts.svelte.ts` — 本地編輯草稿

與 `committed/logic/drafts.svelte.ts` **同一套演算法**，差別只在基準值來源：
`committed` 從 `snapshots.peek(filename)` 取，`staged` 用恆定的空白基準。

```ts
/** 一張暫存圖片的本地編輯草稿 */
type Draft = { name: string; rating: number; tags: string[] };

/** 所有檔案共用的編輯基準：名稱留空代表沿用去副檔名的檔名 */
const baseline = (): Draft => ({ name: "", rating: 0, tags: [] });

/** 去掉副檔名的檔名（名稱留空時的生效名稱）；Panel 也要拿去當 placeholder */
export const stripExt = (filename: string) => filename.replace(/\.[^.]+$/, "");

class DraftsController {
  private pageData = getPageDataContext();
  private drafts = $state<Record<string, Draft>>({});

  /** 被編輯過的圖片檔名；以目前暫存清單為準過濾，避免匯入後殘留幽靈草稿 */
  touchedFiles = $derived(this.pageData.value.stagedFiles.filter((f) => f in this.drafts));
  /** 被編輯過且目前可提交的張數（SessionProgress 用） */
  readyCount = $derived(this.touchedFiles.filter((f) => this.problemOf(f) === null).length);

  private isTouched(d: Draft): boolean;              // 與 baseline 比對
  private mutate(filename, patch): void;             // 沒草稿先建，寫回基準值就 discard
  private discard(filename): void;                   // 唯一的清除入口

  draftOf(filename): Draft | undefined;              // 實際草稿，無則 undefined（卡片標記用）
  viewOf(filename): Readonly<Draft>;                 // 有草稿用草稿，無則回一份新的 baseline
  effectiveNameOf(filename): string;                 // viewOf().name.trim() || stripExt(filename)
  problemOf(filename): string | null;

  handleSetName    = (filenames: string[], name: string) => void;
  handleSetRating  = (filenames: string[], rating: number) => void;
  handleSetTags    = (filenames: string[], tags: string[]) => void;   // 覆蓋
  handleAddTags    = (filenames: string[], tags: string[]) => void;   // 增量
  handleRemoveTags = (filenames: string[], tags: string[]) => void;
  handleDiscardDraft = (filenames: string[]) => void;
  handleDiscardAll   = () => void;
}
```

幾個要點：

- **所有 handler 一律吃 `string[]`**，與 `committed` 完全一致。單張情境由 `Panel` 傳 `[pointer.id]`，
  批次情境由 `selection-draft` 傳 `selection.selectedFiles`。這是「單張 / 批次共用同一組寫入路徑」的關鍵。
- **`mutate` 的自動 discard 語意保留**：使用者把欄位改回全空時，草稿自動消失、卡片標記自動撤掉。
  `isTouched` 判定就是「與 baseline 不同」。
- **`problemOf` 不檢查名稱為空**（名稱可留空 → 沿用檔名），其餘規則與 `committed` 相同：
  名稱 ≤ 200 字元、至少一個標籤、標籤非空 / ≤ 50 字元 / 不含逗號。
- **不提供 `tagDiffOf` / `fieldDiffOf`**。`committed` 需要它們是因為基準值真的會有內容，
  差集要算；`staged` 的基準是空的，`tagDiffOf` 永遠等於「草稿的全部標籤」、`toRemove` 恆空，
  `fieldDiffOf` 也只剩一個 `{ before: 0, after: rating }`。留著等於是兩個退化成單一呼叫端的空殼，
  改由 `ReviewBody` 直接從 `viewOf()` 組。
- **`effectiveNameOf` 取代 name diff**。baseline 的 name 是空字串，硬算會得到「（空）→ 夕陽」，
  審查清單改為只顯示生效名稱。
- `touchedFiles` 走 `stagedFiles` 交集過濾，是 `staged` 相對 `committed` 唯一多出來的一行：
  匯入紀錄會讓檔案直接離開暫存區，不過濾會在審查清單留下必然失敗的幽靈項目。

---

### 3. `pointers.svelte.ts` — 編輯指標與大圖預覽

結構與 `committed/logic/pointers.svelte.ts` **逐字相同**，唯一差別：
`editing` 的來源不寫入 URL（`committed` 用 `SvelteShallowParam("currentId")`，`staged` 用純本地 `$state`）。

```ts
/** 一個指標指向目前清單裡的哪個檔案，以及它是第幾個（1-based） */
type Pointer = { id: string; index: number } | null;

class PointersController {
  private pageData = getPageDataContext();
  private get files() { return this.pageData.value.stagedFiles; }
  private locate(id: string | null): Pointer;   // 不在清單內就是 null

  private editingTarget = $state<string | null>(null);
  /** 目前正在編輯的檔案；檔案離開清單時自動回落為 null */
  editing = $derived(this.locate(this.editingTarget));
  handleSelect = (filename: string) => void;
  handleClose  = () => void;

  private lightboxTarget = $state<string | null>(null);
  /** 目前全螢幕預覽中的檔案；檔案離開清單時自動回落為 null */
  lightbox = $derived(this.locate(this.lightboxTarget));
  handleLightboxOpen  = (filename?: string) => void;   // 省略時預覽編輯中的那張
  handleLightboxClose = () => void;
  handleLightboxPrev  = () => void;
  handleLightboxNext  = () => void;
}
```

`locate()` 讓「提交成功 / 刪除 / 匯入 / 重新整理後檔案消失」全部自動回落，
不需要任何一個 controller 主動去清指標——這正是現在 `editor` + `lightbox` 各自維護一份的東西。

---

### 4. `submit.svelte.ts` — 批次提交

```ts
/** TODO: 原型端點的欄位鍵是 `filename`，committed 端點卻是 `id`；轉正時應統一 */
type StagedBatchItem = { filename: string; name?: string; tags: string[]; rating: number };

class SubmitController {
  private drafts = getDraftsContext();

  /** 是否有一次提交正在進行中 */
  pending = $state(false);
  /** 上一次提交後的失敗匯總（filename -> 原因） */
  lastFailures = $state<Record<string, string>>({});

  /** 名稱留空時不帶 name，交由後端沿用去副檔名的檔名 */
  private buildItem(filename: string): StagedBatchItem;

  clearFailures = () => void;
  handleSubmit = async (filenames: string[]) => void;
}
```

`handleSubmit` 的流程與 `committed` 逐行同形：
`pending` 上鎖 → `POST /api/proto/staged-batch` → 拆出 `lastFailures` →
成功項目呼叫 `drafts.handleDiscardDraft(succeeded)` → 兩則 toast →
`goto(location.href, { replaceState, noScroll, keepFocus, invalidateAll })` → 解鎖。

比 `committed` 少的部分：沒有 `reverts.isMarked()` 分支、沒有 `expectedUpdatedAt`。

---

### 5. `deletion.svelte.ts` — 永久刪除（單張）

`committed` 沒有對應物。刻意獨立成一個 controller，而不是塞進 `pointers`
（會讓指標邏輯沾到 API 呼叫與 confirm 對話框）或 `submit`（語意完全不同）。

```ts
class DeletionController {
  private pageData = getPageDataContext();
  private pointers = getPointersContext();
  private drafts = getDraftsContext();

  /** 是否有一次刪除正在進行中 */
  pending = $state(false);

  /** 永久刪除指定檔案，成功後把編輯指標移到清單的下一張（沒有則上一張） */
  handleDelete = async (filename: string) => {
    if (this.pending) return;
    // 1. requestConfirm(`確定要永久刪除 ${filename}？此操作無法復原。`)
    // 2. 在導航前先算好鄰居：files[idx + 1] ?? files[idx - 1] ?? null
    // 3. DELETE /api/staged/{filename}
    // 4. drafts.handleDiscardDraft([filename])
    // 5. next !== null ? pointers.handleSelect(next) : pointers.handleClose()
    // 6. goto(location.href, { ...invalidateAll })
  };
}
```

**沒有批次刪除、沒有刪除標記**：刪除不進審查清單、不出現在批次表單，
永遠是「一張圖 + 一次 confirm + 立刻執行」。

鄰居必須在 `invalidateAll` 之前算，因為重跑 `load` 後該檔案已經不在清單裡了。

---

### 6. `refresh.svelte.ts` — 重新整理

`committed` 把這段掛在 `query` controller 上（`refreshing` + `handleRefresh`）。
`staged` 沒有查詢條件，所以獨立成最小的一個 controller，內容與 `committed` 逐字相同，
只有 toast 文案不同（「暫存列表已更新」）。

```ts
class RefreshController {
  /** 是否有一次重新整理正在進行中 */
  pending = $state(false);
  handleRefresh = async () => void;   // 300ms 緩衝 → goto(location.href, { ...invalidateAll })
}
```

---

### 7. `import.svelte.ts` — 匯入紀錄

與現有實作相同，唯一改動是 **pending 從 `operations.pending` 改成自帶**：

```ts
class ImportController {
  open = $state(false);
  /** 是否有一次匯入正在進行中 */
  pending = $state(false);
  progress = $state<ImportProgress | null>(null);
  result = $state<ImportResult | null>(null);

  handleOpen = () => void;
  handleClose = () => void;          // pending 時不允許關閉
  handleImportFile = async (file: File) => void;
}
```

`import-api.ts` 保留：SSE 串流解析是純傳輸邏輯、沒有任何狀態，
留在 controller 裡會讓檔案膨脹到 130 行以上，與 `committed` 那種「一行 `api.post`」的情況不同。

---

### 8. `guard.svelte.ts` — 離頁守衛

與 `committed/logic/guard.svelte.ts` 同形，差別在「進行中」的判定要聚合三個來源。

```ts
class GuardController {
  private drafts = getDraftsContext();
  private submit = getSubmitContext();
  private deletion = getDeletionContext();
  private importer = getImportContext();

  /** 會真的改動資料的操作是否進行中；refresh 只是重跑 load，不算 */
  private get busy() {
    return this.submit.pending || this.deletion.pending || this.importer.pending;
  }
  private get pendingCount() {
    return this.drafts.touchedFiles.length;
  }

  handleBeforeNavigate = (nav: BeforeNavigate) => void;
  handleBeforeUnload = (e: BeforeUnloadEvent) => void;
}
```

`handleBeforeNavigate` 邏輯與 `committed` 逐行相同：

1. `nav.type === "leave"` 直接放行（交給 `handleBeforeUnload`）
2. 用 `page.url.pathname`（**不是** `location.pathname`）判斷是否真的離開本頁；同址 `goto` 不攔
3. `busy` → `nav.cancel()` + 「操作進行中，請稍候」
4. `pendingCount === 0` → 放行
5. 否則 `nav.cancel()` + `requestConfirm` → 確認後 `drafts.handleDiscardAll()` 再 `goto(to.url.href)`

---

### 9. `review.svelte.ts` — 審查清單

與 `committed/logic/review.svelte.ts` **逐字相同**，只有兩處代換：

- `private files` 從 `[...new Set([...drafts.touchedFiles, ...reverts.markedFiles])]` 簡化成 `drafts.touchedFiles`
- `checkableOf(f)` 從「退回標記恆可送出，否則看 `problemOf`」簡化成 `drafts.problemOf(f) === null`

```ts
class ReviewController {
  private drafts = getDraftsContext();
  private submit = getSubmitContext();

  private files = $derived(this.drafts.touchedFiles);
  /** 一輪能承擔的審查量設為 25 */
  private pagination = new SveltePagination(() => this.files, 25);
  private checked = $state<Record<string, true>>({});

  checkableOf(filename): boolean;
  isChecked(filename): boolean;

  open = $state(false);
  totalCount        = $derived(this.pagination.total);   // 不受分批截斷，供 ReviewTrigger
  batch             = $derived(this.pagination.page);
  batches           = $derived(this.pagination.pages);
  batchFiles        = $derived(this.pagination.items);   // 以下衍生值的唯一事實來源
  checkableFiles    = $derived(...);
  checkableCount    = $derived(...);
  submittableFiles  = $derived(...);
  submittableCount  = $derived(...);
  bulkSelectionState = $derived(...);                    // "checked" | "indeterminate" | "unchecked"

  private moveTo(batch: number): void;   // 換批時重新全選該批可送出的項目

  handleOpen = () => void;               // clearFailures → moveTo(1) → open
  handleClose = () => void;              // submit.pending 時不允許關閉
  handleFirstBatch / handlePrevBatch / handleNextBatch / handleLastBatch;
  handleToggle = (filename: string) => void;
  handleToggleAll = () => void;
  handleSubmit = async () => void;       // 委派 submit，再依 lastFailures 同步 checked
}
```

分批 25 筆是 `staged` 本次新增的行為（暫存量通常比 `committed` 的篩選結果更大，意義更高）。

---

### 10. `tag-impact.svelte.ts` — 標籤庫影響評估（`staged` 專用簡化版）

`committed` 需要一整套「淨變化 delta」是因為它同時有標籤新增與退回造成的移除，
必須算出 `before + delta` 才能判斷一個標籤會不會變孤兒。

`staged` 只會新增標籤，永遠不會讓任何標籤變孤兒，所以整套 delta 拿掉，
只保留「這些標籤目前在標籤庫的使用數是不是 0」這一個問題：

```ts
class TagImpactController {
  private drafts = getDraftsContext();
  private review = getReviewContext();

  private seq = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** 目前可送出項目會用到的所有相異標籤 */
  private names = $derived.by(() => {
    const set = new Set<string>();
    for (const f of this.review.submittableFiles) {
      for (const t of this.drafts.viewOf(f).tags) set.add(t);
    }
    return [...set];
  });

  /** 這些標籤目前在標籤庫的使用數 */
  private counts = $state(new Map<string, number>());

  /** 是否正在查詢中 */
  fetching = $state(false);

  /** 提交後會新增的全新標籤 */
  newTags = $derived(this.names.filter((t) => (this.counts.get(t) ?? 0) === 0));

  constructor() {
    $effect(() => {
      // 與 committed 相同的 300ms debounce + seq 作廢機制
      // GET /api/proto/tags-impact?names=...
    });
  }
}
```

沒有 `deltas`、沒有 `bump()`、沒有 `orphanedTags`。
`ReviewModal` 直接傳 `tagsToRemove={0}` 給 `ReviewTagImpact`。

> `committed` 那條「`--max-http-header-size` 16 KB，約 440 個相異標籤就爆」的 TODO 一併帶過來。

---

### 11. `selection.svelte.ts` — 多選模式

與 `committed/logic/selection.svelte.ts` **逐字相同**，
只把 `pageData.value.items.map((r) => r.id)` 換成 `pageData.value.stagedFiles`。

```ts
class SelectionController {
  private pageData = getPageDataContext();
  private pointers = getPointersContext();
  private ids = new SvelteSet<string>();

  constructor() {
    // 清單變動（提交 / 刪除 / 匯入 / 重新整理）就清空選取
    $effect(() => { this.pageData.value.stagedFiles; this.ids.clear(); });
  }

  active = $state(false);
  selectedFiles = $derived([...this.ids]);
  count = $derived(this.ids.size);
  bulkSelectionState = $derived(...);
  isSelected = (id: string) => boolean;

  handleEnter = () => void;      // 進入時把目前編輯中的那張自動選起來
  handleExit = () => void;
  handleToggle = (filename: string) => void;
  handleToggleAll = () => void;
}
```

---

### 12. `selection-draft.svelte.ts` — 批次編輯表單

與 `committed/logic/selection-draft.svelte.ts` 同形，**移除 `revert` 欄位與連帶的 `locked`**。

```ts
type Field = "rating" | "addTags" | "removeTags";

class SelectionDraftController {
  private selection = getSelectionContext();
  private drafts = getDraftsContext();

  checked = new SvelteSet<Field>();
  rating = $state(0);
  addTags = $state<string[]>([]);
  removeTags = $state<string[]>([]);

  /** 是否有需要套用的操作 */
  dirty = $derived.by(() => {
    if (this.checked.has("rating")) return true;
    if (this.checked.has("addTags") && this.addTags.length > 0) return true;
    if (this.checked.has("removeTags") && this.removeTags.length > 0) return true;
  });

  constructor() {
    // 離開多選模式視為結束這次批次操作，草稿一併清空
    $effect(() => { if (!this.selection.active) this.reset(); });
  }

  private reset(): void;

  handleCheck = (field: Field, value: boolean) => void;
  handleRatingChange = (value: number) => void;
  handleTagsChange = (type: "add" | "remove", tags: string[]) => void;
  /** 把已勾選欄位依目前值套用到所有選取圖片的草稿，並重置表單 */
  handleApply = () => void;
}
```

`handleApply` 直接呼叫 `drafts.handleSetRating / handleAddTags / handleRemoveTags`，
與單張編輯共用同一組寫入路徑——這就是「圖章模式」原本想解決的問題，
用 `committed` 既有的多選 + 批次表單取代，不需要拖曳筆劃、`strokeSet`、`suppressClickFile` 那一整套。

---

## 四、頁面自有的表單元件

劃界原則：**`$lib` 只留「殼與版面」，「欄位內容與動作文案」歸頁面。**
判準是——如果一個元件必須用 `variant` 或旗標來區分「這是 committed 的樣子 / 這是 staged 的樣子」，它就不該在 `$lib`。

`committed` 側已經照這條線切好了，`staged` 要自己寫三個對應檔案。
每一個都比 `committed` 的版本更小，因為不必承載退回標記那條線。

### 命名規則

面板相關的元件一律以 `Panel` 為共用前綴，**變體類型放在 `Fields` 之前**；
組裝樞紐用中性的 `Panel.svelte`，不叫 `Inspector`。

| | `committed/body/` | `staged/body/` |
| --- | --- | --- |
| 組裝樞紐 | `Panel.svelte` | `Panel.svelte` |
| 單張欄位 | `PanelFields.svelte` | `PanelFields.svelte` |
| 批次欄位 | `PanelBatchFields.svelte` | `PanelBatchFields.svelte` |
| 退回唯讀檢視 | `PanelRevertFields.svelte` | —（無退回概念） |
| 底部動作列 | `PanelFooter.svelte` | `PanelFooter.svelte` |

**`staged/body/PanelFields.svelte`** — 參考 `committed/body/PanelFields.svelte`

```ts
type Props = {
  name: string; rating: number; tags: string[];
  problem: string | null;
  /** 名稱留空時的提示，由 Panel 傳 stripExt(filename) */
  placeholder: string;
  onchangename: (v: string) => void;
  onchangerating: (v: number) => void;
  onchangetags: (v: string[]) => void;
};
```

提示文字直接寫死「留空則沿用去除副檔名的檔名」。
（`committed` 版寫死「名稱不可留空」、沒有 `placeholder`。）

**`staged/body/PanelBatchFields.svelte`** — 參考 `committed/body/PanelBatchFields.svelte`

```ts
type Field = "rating" | "addTags" | "removeTags";
type Props = {
  checked: Set<Field>;
  rating: number; addTags: string[]; removeTags: string[];
  oncheck: (field: Field, checked: boolean) => void;
  onrating: (v: number) => void;
  onchangetags: (type: "add" | "remove", tags: string[]) => void;
};
```

沒有 `revert`、沒有 `locked`（`locked` 本來就只由退回標記造成）、
沒有 `facetScope`（`staged` 沒有查詢條件，`TagInput` 走全域標籤建議）。

**`staged/body/PanelFooter.svelte`** — 參考 `committed/body/PanelFooter.svelte`，只要兩個 variant

```ts
type SingleProps = {
  variant: "single";
  /** 刪除是否進行中 */
  pending: boolean;
  ondiscard: () => void;   // 清空草稿
  ondelete: () => void;    // 永久刪除
};
type BatchProps = {
  variant: "batch";
  applicable: boolean;
  count: number;
  onapply: () => void;
};
```

`batch` 那顆「套用」按鈕與 `committed` 版重複（約 10 行），是這次劃界唯一的重複代價。

### 直接沿用的共用元件（皆不需修改）

`$lib/components/workflow/`：`ImageRecordPanel`（`upper` / `lower` 插槽）、
`ImageRecordPanelHeader`（`batch` / `single`，兩頁用法一致）、`ImageRecordPanelImage`、
`ImageRecordCardWrapper`、`ImageRecordCardInfo`。

`$lib/components/review/` 九個元件全部沿用。

---

## 五、元件層對應

| `committed` | `staged` | 說明 |
| --- | --- | --- |
| `header/QueryControls.svelte` | `header/SessionProgress.svelte` | 位置相同，內容完全不同 |
| — | `header/ImportModal.svelte` + `ImportGuide.svelte` | `staged` 專屬 |
| `header/ReviewModal.svelte` | 同名 | 內含 `ReviewTrigger`，`count={review.totalCount}` |
| `header/ReviewBody.svelte` | 同名 | `buildEntry` 投影寫在檔案內部、不 export |
| `body/Rail.svelte` | 同名 | 逐字相同 |
| `body/Cards.svelte` | 同名 | `items` → `stagedFiles`；移除圖章的斜紋背景與 anchor |
| `body/Card.svelte` | 同名 | 移除 `reverts.isMarked` 分支 |
| `body/Panel.svelte` | 同名 | 組裝樞紐，見下 |
| `body/Panel*Fields.svelte`、`PanelFooter.svelte` | 同名 | 各自持有，見第四節 |
| `body/config.ts` | 同名 | 逐字相同 |

### `body/Panel.svelte`

維持 `committed` 現在的形狀：它是唯一知道「現在是批次還是單張」的地方，
`Panel*Fields` 與 `PanelFooter` 都只收 props、不碰 context——
這樣型別上的 `pointer !== null` 守衛只寫一次，不會在每個子元件裡重複一遍。

```svelte
{#if selection.active}
  <ImageRecordPanel>
    {#snippet upper()}<ImageRecordPanelHeader variant="batch" ... />{/snippet}
    {#snippet lower()}
      <PanelBatchFields ... />
      <PanelFooter variant="batch" ... />
    {/snippet}
  </ImageRecordPanel>
{:else if pointer !== null}
  <ImageRecordPanel>
    {#snippet upper()}
      <ImageRecordPanelHeader variant="single" title={pointer.id} index={pointer.index} ... />
      <ImageRecordPanelImage file={pointer.id} ... />
    {/snippet}
    {#snippet lower()}
      {@const view = drafts.viewOf(pointer.id)}
      <PanelFields
        name={view.name} rating={view.rating} tags={view.tags}
        problem={drafts.problemOf(pointer.id)}
        placeholder={stripExt(pointer.id)}
        onchangename={(v) => drafts.handleSetName([pointer.id], v)}
        ...
      />
      <PanelFooter
        variant="single"
        pending={deletion.pending}
        ondiscard={() => drafts.handleDiscardDraft([pointer.id])}
        ondelete={() => deletion.handleDelete(pointer.id)}
      />
    {/snippet}
  </ImageRecordPanel>
{/if}
```

### `header/ReviewBody.svelte` 的投影

```ts
function buildEntry(filename: string, checked: boolean, failure?: string) {
  const view = drafts.viewOf(filename);
  const problem = drafts.problemOf(filename) ?? (failure ? `提交失敗：${failure}` : null);
  const checkable = problem === null;

  return {
    filename,
    name: drafts.effectiveNameOf(filename),                                  // 不做 name diff
    changeRating: view.rating > 0 ? { before: 0, after: view.rating } : undefined,
    changeTags: { toAdd: view.tags },
    problem,
    checkable,
    checked: checkable && checked,
  };
}
```

點名稱回到編輯：`review.handleClose()` → `selection.handleExit()` → `pointers.handleSelect(filename)`，
與 `committed/header/ReviewBody.svelte` 的 `handleBackToEdit` 相同。

### `+page.svelte` 的 window 事件

只留一個，與 `committed` 一致：

```svelte
<svelte:window onbeforeunload={guard.handleBeforeUnload} />
```

現有的 `onpointerup={stamp.handleWindowPointerUp}` 隨圖章模式一併移除。

---

## 六、已知取捨

1. **`drafts` 依賴 `pageData`**：`committed` 的 `touchedFiles` 是純 `Object.keys(drafts)`，
   `staged` 多一層 `stagedFiles` 交集。原因是匯入紀錄會讓檔案直接離開暫存區，
   不過濾會在審查清單留下必然失敗的幽靈項目。這是兩者唯一一行實作差異。

2. **`tag-impact` 兩頁不共用**：`staged` 版是「一組標籤名 → 使用數是否為 0」，約 35 行；
   `committed` 版是「淨變化 delta → 新增 / 孤兒」，約 95 行。
   共通的只有 debounce + `seq` 作廢那個模式，不值得為它抽象。

3. **`batch` footer 兩邊各寫一次**：下放 `PanelFooter` 的代價，約 10 行重複。
   換到的是 `$lib` 不再有任何「這是哪一頁」的知識。

4. **`ImageRecordCardInfo` 仍留有 `"reverted"`**：這是 `committed` 專屬的值，
   `staged` 永遠不會傳。它只影響一個圖示與一行文字、不構成 variant 分支，本次不動。

5. **原型端點的欄位鍵不一致**：`/api/proto/staged-batch` 用 `filename`、
   `/api/proto/committed-batch` 用 `id`。不為此扭曲 controller，
   在 `submit.svelte.ts` 的型別上留 `TODO`，等端點轉正時一併處理。

6. **編輯指標不寫入 URL**：`committed` 用 `SvelteShallowParam("currentId")`，`staged` 用純本地 `$state`。
   代價是重新整理後回不到原本編輯的那張；好處是頁面完全不涉及淺路由，
   所有 `goto` 都可以無條件從 `location` 取值而不必擔心 `page.url` 脫鉤。

7. **圖章模式的功能由多選批次取代**：連續套用同一組標籤 / 評等的情境，
   改成「進多選 → 框選多張 → 批次表單勾選欄位 → 套用」。
   失去的是拖曳筆劃的手感，換到的是與 `committed` 完全一致的心智模型與程式碼。

---

## 七、實作順序

1. 建 `staged/logic/` 的 12 個 controller。
2. 建 `staged/body/` 與 `staged/header/`，刪掉舊的 `cards/` `inspector/` `review/`。
3. 改寫 `+page.svelte`。
4. 刪除 `stamp.svelte.ts`、`draft.ts`、`review-entry.ts`、`editor.svelte.ts`、`operations.svelte.ts`、`lightbox.svelte.ts`。

---

## 八、驗收檢查清單（需人工驗證）

自動化的部分（`npm run check` / `npm run build` / `npm run test`）我會自己跑完。
以下需要你在瀏覽器裡確認：

### 單張編輯
- [ ] 點卡片開啟編輯面板，名稱欄位為空、placeholder 顯示去副檔名的檔名
- [ ] 填入標籤後卡片右上出現綠色「可提交」標記；只填名稱不填標籤則為黃色「未就緒」
- [ ] 把所有欄位改回空白，卡片標記自動消失（草稿被自動捨棄）
- [ ] 「清空草稿」按鈕生效，且卡片標記同步消失
- [ ] 「刪除此張」跳 confirm，確認後檔案消失、編輯面板自動跳到清單下一張
- [ ] 刪除清單最後一張時，編輯面板跳到上一張
- [ ] 編輯面板的全螢幕預覽按鈕、左右切換、Esc 關閉

### 多選 / 批次
- [ ] 左側 Rail 切到多選模式，原本編輯中的那張自動被選取
- [ ] 卡片顯示勾選框，點擊為切換選取而非開啟編輯面板
- [ ] 批次表單只有「覆蓋評等 / 增加標籤 / 去除標籤」三欄，**沒有**退回標記欄，也沒有任何欄位會變灰鎖定
- [ ] 勾選欄位 + 套用後，所有選取卡片的草稿同步更新，表單自動重置
- [ ] 切回單選模式後選取狀態清空
- [ ] 重新整理 / 提交 / 刪除後選取狀態清空

### 審查與提交
- [ ] 「檢視變更」數字等於已填寫的張數（且不超過暫存清單長度）
- [ ] 審查清單每列顯示生效名稱（未命名時為去副檔名的檔名）、評等、`+標籤`
- [ ] 超過 25 筆時出現換頁列，換頁後自動全選該批可送出項目
- [ ] 標籤影響提示顯示「將新增 N 個新標籤」，**永遠不會**出現移除 / 孤兒相關文案
- [ ] 提交部分失敗時，失敗項目留在清單上並顯示原因、成功項目消失
- [ ] 點清單裡的名稱可跳回該張繼續編輯（同時關閉對話框並退出多選）

### 匯入與守衛
- [ ] 匯入 JSON 顯示即時進度，完成後暫存清單少掉已匯入的檔案
- [ ] **匯入前先對某張填草稿，匯入後該檔案離開暫存區 →「檢視變更」數字要跟著減少**
- [ ] 有未提交草稿時點側欄導航，跳出「尚未提交的變更」確認框
- [ ] 提交 / 刪除 / 匯入進行中時嘗試導航，顯示「操作進行中，請稍候」
- [ ] 有未提交草稿時按瀏覽器重新整理，跳出瀏覽器原生離開確認
