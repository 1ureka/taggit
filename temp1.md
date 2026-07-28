# `/tags` 頁面 Controller 與架構重寫設計

## 這份文件的定位

依 `docs/svelte_kit_routes.md`（機制）與 `docs/svelte_kit_routes_controller.md`（切法）重新畫 `/tags` 的邊界。

**範圍**：只有 `src/routes/tags/`（主頁）。`src/routes/tags/cleanup/` 不在這次範圍內，重寫後兩頁會暫時不同形。

**行為尺度**：允許架構必然帶來的修正，不追求逐像素等價。所有可見差異集中列在第六節。

**已定案的決定**：審查清單導入 staged/committed 的「一批 25 筆」分批；子元件資料夾沿用現有的 `chips/` + `zone/` + `review/`。

---

## 一、診斷：現況命中了幾乎整張清單

以下每一項都對應 `svelte_kit_routes_controller.md` 第三節的診斷表，附現況舉證。

| 症狀 | 現況舉證 | 原則 |
| --- | --- | --- |
| controller 檔名是 `operations` 這種泛稱 | `logic/operations.svelte.ts` | 1 |
| 一個 controller 同時做「本地狀態」與「呼叫 API」與「開對話框」 | `board.svelte.ts` 同時管三種區的資料、debounce 查合併張數、離頁 `requestConfirm` | 1, 2 |
| 描述某 controller 必須用「以及」 | board =「管三種異動區，**以及** 合併後張數查詢，**以及** 離頁守衛，**以及** 扁平化成操作清單」 | 1 |
| 某 controller 出現另一領域的關鍵字 | `operations.handleRefresh` 裡談 `previews.clear()`；`board` 裡談 `BeforeNavigate` 與 toast | 2 |
| 出現跨 controller 的欄位賦值 | `review.handleSubmit` 寫 `this.operationsCtx.pending = true` / `= false` | 3(b) |
| 存在全頁共用的 `pending` 且多人寫入 | `operations.pending` 由 `operations.handleRefresh` 與 `review.handleSubmit` 兩處寫，`board`／`ReviewModal`／`+page.svelte` 三處讀 | 3(b) |
| 同一事實有多份維護 | 「標籤庫變動 → 預覽快取失效」寫在 `operations.handleRefresh` 與 `review.handleSubmit` 兩個呼叫端各一次 | 3(a) |
| 兩個型別描述同一件事 | `board.GroupTarget` 與 `drag.ZoneTarget` 幾乎相同、各定義一次 | 3(a) |
| 「單一入口」形同虛設 | `board.addTags()` 宣稱是「拖放與按鈕共用的統一入口」，但 `drag.handleDrop` 的 switch 直接呼叫 `createGroup` / `addToZone` / `addToGroup` / `detachTag`，完全繞過 | 4 |
| 元件裡出現雙向綁定 | `ZoneBodyGroup.svelte` 有 `bind:value={group.canonical}`，再靠 `oninput` 補呼叫 `renameGroup` 去觸發重查——canonical 有兩條寫入路徑 | 4 |
| `logic/` 底下有 `*-entry.ts` | `logic/review-entry.ts` 匯出 `ReviewEntry` 型別與 `buildReviewEntries()`，單一消費者 | 投影 |
| `logic/` 底下有非 controller 檔案 | `logic/changeset.ts`（payload 組裝 + API 呼叫）、`logic/review-entry.ts` | 五 |

### 另外三個沒進表格但同樣要處理的

**(1) 驗證被寫進投影，導致 controller 得反向呼叫投影。**
`review.handleOpen` 為了知道「哪些項目可勾選」，必須先跑一次

```ts
const draft = buildReviewEntries(this.board.operations, new Set(), {});
for (const e of draft) if (e.checkable) this.checked.add(e.name);
```

註解甚至誠實寫著「用空的 checked 集合先跑一次，只為了讀 checkable」。根因是「這筆操作能不能送出」是**事實**，卻被塞在顯示用的 builder 裡。staged 把它放在 `drafts.problemOf(filename)`，review 只需 `checkableOf(f) = problemOf(f) === null`。

**(2) 手動維持的 timer 不變式。**
`board` 的 `timers: Map<string, {timer, seq}>` 必須跟 `zones` 同生共死，所以有

```ts
/** 移除一個合併區的唯一入口：清 timer 與移除資料在同一函式內原子發生 */
private removeGroup(id: string) { ... }
```

這條不變式之所以要人工維護，是因為「合併區的組成」與「合併後張數的查詢」被綁在同一個 controller。拆開後它自動消失。

**(3) `+page.svelte` 仍是組裝樞紐。**
整個右側 `aside`（四種 zone 的排列、`ZoneContainer` / `ZoneHeader` / `ZoneBody*` 的組裝）寫在 `+page.svelte` 的 `{#snippet aside()}` 裡，再 `{@render aside()}`。文件要求 `+page.svelte` 的工作收斂成「按依賴順序呼叫 `create*Context()`」。

**(4) 一段死碼。**
`review-entry.ts` 對 hidden/visible 的檢查：

```ts
} else if (op.kind === "hidden" || op.kind === "visible") {
  if (renamedFromNames.has(op.name)) problem = `「${op.name}」已被排入重新命名，…`;
}
```

`board.detachTag` 保證同一標籤只會落在一個 zone，因此 hidden zone 的標籤不可能同時是某個 group 的成員，這個條件恆為 false。

---

## 二、目標：11 個 controller

`logic/` 底下全部是 controller，**沒有例外**。

| 檔案 | 一句話（不含「以及」） |
| --- | --- |
| `page-data.svelte.ts` | 以 context 包裝 `load` 回傳的 `data`。 |
| `query.svelte.ts` | 管理標籤池的查詢條件與 URL 同步。 |
| `selection.svelte.ts` | 管理標籤池內的多選狀態。 |
| `board.svelte.ts` | 管理畫布上每個標籤被排入哪一個異動區。 |
| `merge-count.svelte.ts` | 查詢每個合併區合併後的預估圖片張數。 |
| `drag.svelte.ts` | 追蹤目前拖曳中的標籤與懸停中的放置目標。 |
| `submit.svelte.ts` | 把指定的標籤操作送出並回報結果。 |
| `review.svelte.ts` | 管理審查清單。 |
| `refresh.svelte.ts` | 重新整理標籤列表。 |
| `previews.svelte.ts` | 標籤懸停預覽圖的查詢與快取。 |
| `guard.svelte.ts` | 管理離頁守衛。 |

檔案從 8 個變 11 個、總行數大致持平或略增——這是重新分配職責的正常結果，不用行數衡量。

### 依賴圖（即 `+page.svelte` 的建立順序）

```
page-data
  ├── query
  └── (previews 見下)

selection            （無依賴）
board                （無依賴——Tag 物件一律由呼叫端傳入）
  ├── merge-count
  ├── drag ←──────── selection
  ├── submit
  │     └── review ← board
  └── (guard 見下)

refresh              （無依賴）

previews  ← submit, refresh
guard     ← board, submit, refresh, review
```

線性排序：

```ts
const pageData = createPageDataContext(() => data);
const query    = createQueryContext();
createSelectionContext();
createBoardContext();
createMergeCountContext();
createDragContext();
const submit   = createSubmitContext();
const review   = createReviewContext();
const refresh  = createRefreshContext();
createPreviewsContext();
const guard    = createGuardContext();
```

每一行的依賴都在它之前，無循環。

---

## 三、各 controller 的介面

### 3.1 `page-data.svelte.ts`

不變。`PageData` = `Paginated<Tag>` = `{ items, total, page, pages }`。

### 3.2 `query.svelte.ts`

保留現有的 `SvelteSearchParams<TagQuery>` 單一 `set` 點設計，只修一處重複權威來源。

現況把「能不能往前／往後」算了兩份：`disabledFirst` 等四個 `$derived`，加上 `handleFirstPage` 等四個 handler 內部再判斷一次。

改後 controller 只提供事實，禁用與否是投影：

```ts
class QueryController {
  private pageData = getPageDataContext();
  private params = new SvelteSearchParams<TagQuery>({ /* 同現況 */ });

  get query(): TagQuery { return this.params.value; }

  /** 以下三者一律以伺服器回傳為準，不在前端重算 */
  currentPage = $derived(this.pageData.value.page);
  totalPages  = $derived(this.pageData.value.pages);
  total       = $derived(this.pageData.value.total);

  /** 是否有導航在途；換頁按鈕據此避免連點 */
  navigating = $derived(!!navigating.to);
  atFirst    = $derived(this.currentPage <= 1);
  atLast     = $derived(this.currentPage >= this.totalPages);

  handleSearch            = (name: string) => { /* 同現況，page 重置為 1 */ };
  handleSortChange        = (key: string)  => { /* 同現況 */ };
  handleHiddenFilterChange= (key: string)  => { /* 同現況 */ };

  /** 超出範圍由內部夾住，呼叫端不需要判斷邊界 */
  private gotoPage(p: number) {
    const next = Math.min(Math.max(1, p), this.totalPages);
    if (next === this.currentPage) return;
    this.commit(new TagQuery(this.query.where, this.query.list.with({ page: next })));
  }

  handleFirstPage = () => this.gotoPage(1);
  handlePrevPage  = () => this.gotoPage(this.currentPage - 1);
  handleNextPage  = () => this.gotoPage(this.currentPage + 1);
  handleLastPage  = () => this.gotoPage(this.totalPages);
}
```

`Pagination.svelte` 自己組 `disabled={query.navigating || query.atFirst}`。

### 3.3 `selection.svelte.ts`

不變。`consume()`（取快照 + 清空的原子操作）保留，它有三個呼叫端（拖放、`ZoneHeader` 的加入鈕、`ZoneBodyCreate` 的建立鈕），不是為了繞過任何檢查而存在。

選取跨頁保留（現況即如此），這是刻意的：池一頁 100 個，使用者常需跨頁挑選後一次排入。

### 3.4 `board.svelte.ts`（核心）

**一句話：管理畫布上每個標籤被排入哪一個異動區。**

型別集中在這裡，`drag` 不再自己定義一份：

```ts
/** 畫布上的一個位置。`pool` 表示回到標籤池（= 自所有區移除） */
export type ZoneTarget =
  | { kind: "pool" }
  | { kind: "new-group" }
  | { kind: "delete" }
  | { kind: "hidden" }
  | { kind: "group"; id: string };

/** 一個標籤異動區。delete/hidden 是永不刪除的單例，group 動態增減 */
export type Zone =
  | { kind: "delete"; tags: Tag[] }
  | { kind: "hidden"; tags: Tag[] }
  | { kind: "group"; id: string; canonical: string; tags: Tag[] };

/** 扁平化後，畫布上每個標籤各一筆的異動 */
export type TagOperation =
  | { kind: "rename" | "merge"; name: string; count: number; to: string; groupId: string }
  | { kind: "delete";  name: string; count: number }
  | { kind: "hidden" | "visible"; name: string; count: number };
```

`Zone` 去掉 `mergeCount`（移交 `merge-count`）；`TagOperation` 去掉 `mergedCount`、改帶 `groupId`，讓審查清單能在模板層把兩個 controller 組起來。

```ts
class BoardController {
  private zones = new SvelteMap<string, Zone>([...]);   // 同現況，delete/hidden 兩個固定鍵

  // --- 事實 ---

  groups     = $derived(...);   // GroupZone[]
  deleteZone = $derived(...);
  hiddenZone = $derived(...);

  /**
   * 畫布上全部的標籤異動，維持插入順序。
   * 同時是離頁守衛與審查清單的唯一依據，**不可加入任何過濾**。
   * `name` 在此陣列中唯一（同一標籤只會落在一個區），
   * `/api/proto/tags-batch` 用裸 name 當結果鍵能對上，正是靠這條不變式。
   */
  operations = $derived(buildOperations([...this.zones.values()]));

  /** 每個標籤目前所在的區域種類查找表，供 Chip 上色 */
  chipStatus = $derived.by(...);   // 同現況

  /** 指定標籤的異動內容，不在畫布上時為 undefined */
  operationOf(name: string): TagOperation | undefined;

  /**
   * 指定標籤的異動目前是否有問題，以及問題描述。
   * 這是事實而非顯示形狀——審查清單的「可否勾選」與合併區輸入框都讀它。
   */
  problemOf(name: string): string | null;

  // --- 事件 ---

  /** 唯一的寫入入口：把標籤排進指定位置（拖放與按鈕共用同一條路徑） */
  handleAssign = (target: ZoneTarget, tags: Tag[]) => { ... };

  /** 把標籤移出所在區。一律吃陣列，單筆情境傳 [name] */
  handleDetach = (names: string[]) => { ... };

  /** 設定合併區的目標名稱（輸入框與「設為主名稱」共用） */
  handleRename = (groupId: string, canonical: string) => { ... };

  /** 清空指定區（group 直接移除，delete/hidden 清空成員） */
  handleDissolve = (target: ZoneTarget) => { ... };

  /** 清空整個畫布，只在離頁確認後由 guard 呼叫 */
  handleClearAll = () => { ... };
}
```

`problemOf` 的規則（由 `review-entry.ts` 搬入，順手刪掉第一節指出的死碼）：

```ts
problemOf(name: string): string | null {
  const op = this.operationOf(name);
  if (op === undefined) return null;

  if (op.kind === "rename" || op.kind === "merge") {
    const to = op.to.trim();
    if (to.length === 0 || to.length > 50 || to.includes(","))
      return "新名稱不合法（1–50 字元、不可含逗號）";
    if (this.operationOf(to)?.kind === "rename" || this.operationOf(to)?.kind === "merge")
      return `目標「${to}」本身也被排入重新命名`;
    if (this.operationOf(to)?.kind === "delete")
      return `目標「${to}」已被排入刪除`;
  }
  return null;
}
```

送出失敗的原因**不**併進 `problemOf`——那是 `submit.lastFailures` 的事，由審查清單的投影把兩者合成一句話（對標 staged 的 `ReviewBody.buildEntry`）。

**消失的東西**：`timers` / `queryMergeCount` / `removeGroup` 的 timer 清理、`handleBeforeNavigate` / `handleBeforeUnload`、以及 `createGroup` / `addToGroup` / `addToZone` / `addTags` / `dissolveGroup` / `dissolveZone` 六個並存入口收成兩個。

### 3.5 `merge-count.svelte.ts`（新增）

**一句話：查詢每個合併區合併後的預估圖片張數。** 形狀對標 staged 的 `tag-impact`。

```ts
class MergeCountController {
  private board = getBoardContext();

  /** groupId -> { signature, count }。count 為 null 表示查詢中 */
  private entries = new SvelteMap<string, { signature: string; count: number | null }>();
  private timers  = new Map<string, { timer: ReturnType<typeof setTimeout>; seq: number }>();

  /** 指定合併區合併後的預估張數；尚在查詢中為 null */
  countOf(groupId: string): number | null;

  constructor() {
    $effect(() => {
      const groups = this.board.groups;
      const alive = new Set(groups.map((g) => g.id));

      // 已消失的合併區：條目與 timer 一起清掉
      for (const id of [...this.entries.keys()]) if (!alive.has(id)) this.drop(id);

      // 組成有變的合併區：各自重新排程（維持 per-group debounce）
      for (const g of groups) {
        const signature = `${g.canonical.trim()} ${g.tags.map((t) => t.name).join(",")}`;
        if (this.entries.get(g.id)?.signature === signature) continue;
        this.entries.set(g.id, { signature, count: null });
        this.schedule(g.id, [g.canonical.trim(), ...g.tags.map((t) => t.name)]);
      }

      return () => { for (const id of [...this.timers.keys()]) this.drop(id); };
    });
  }

  // schedule: 300ms debounce + seq 作廢在途回應，同 staged 的 tag-impact
  // TODO: 端點一次只能查一組；多個合併區同時變動會發 N 個請求。
  //       /api/proto/tags-union-count 轉正時應提供批次版本。
}
```

**這裡是這次重寫最大的結構收穫**：合併張數的 timer 生命週期不再需要 `board` 手動維護。組被移除時，它自然不再出現在 `board.groups` 裡，`$effect` 掃描時順手清掉條目與 timer——`removeGroup` 那句「清 timer 與移除資料在同一函式內原子發生」的註解，連同它保護的不變式一起消失。

### 3.6 `drag.svelte.ts`

**一句話：追蹤目前拖曳中的標籤與懸停中的放置目標。**

現況的 `zoneHandlers(target)` 工廠回傳一整包 DOM 事件處理器讓元件 spread，把 `e.preventDefault()`、`relatedTarget instanceof Node && current.contains(related)` 這類純 DOM 細節搬進了 controller。這些回到元件。

```ts
class DragController {
  private board = getBoardContext();
  private selection = getSelectionContext();

  /** 目前正在拖曳的標籤 */
  dragging = $state<Tag | null>(null);
  private overKey = $state<string | null>(null);

  /** 指定位置目前是否為懸停中的放置目標 */
  isOver = (target: ZoneTarget) => this.overKey === keyOf(target);

  handleDragStart = (tag: Tag) => { this.dragging = tag; };
  handleDragEnd   = () => { this.dragging = null; this.overKey = null; };
  handleDragOver  = (target: ZoneTarget) => { this.overKey = keyOf(target); };
  handleDragLeave = (target: ZoneTarget) => { if (this.isOver(target)) this.overKey = null; };

  /** 放下：被拖的標籤在選取中就整組放，否則只放它自己 */
  handleDrop = (target: ZoneTarget) => {
    this.overKey = null;
    const dragged = this.dragging;
    if (!dragged) return;
    this.dragging = null;

    const tags = this.selection.isSelected(dragged.name) ? this.selection.consume() : [dragged];
    this.board.handleAssign(target, tags);   // 不再有 switch 繞過統一入口
  };
}
```

`ZoneContainer.svelte` 相應改成：

```svelte
<div
  class={{ dropping: drag.isOver(target), [variant]: true }}
  ondragover={(e) => { e.preventDefault(); drag.handleDragOver(target); }}
  ondragleave={(e) => { if (!containsRelated(e)) drag.handleDragLeave(target); }}
  ondrop={(e) => { e.preventDefault(); drag.handleDrop(target); }}
>
```

`containsRelated` 是元件內的區域函式（避免冒泡到子元素時誤判離開），純 DOM 判斷，不進 controller。

### 3.7 `submit.svelte.ts`（新增，吸收 `changeset.ts`）

**一句話：把指定的標籤操作送出並回報結果。** 逐項對標 staged 的 `submit`。

```ts
class SubmitController {
  private board = getBoardContext();

  /** 是否有一次送出正在進行中。只有自己寫 */
  pending = $state(false);
  /** 上一次送出後的失敗匯總（name -> 原因） */
  lastFailures = $state<Record<string, string>>({});
  /** 每次成功送出後 +1，供依賴標籤庫內容的快取失效 */
  revision = $state(0);

  clearFailures = () => { this.lastFailures = {}; };

  handleSubmit = async (names: string[]) => {
    if (names.length === 0 || this.pending) return;
    this.pending = true;
    try {
      const wanted = new Set(names);
      const ops = this.board.operations.filter((op) => wanted.has(op.name));

      // TODO: 端點把 delete/rename/hidden 三件事塞進同一個扁平 results，
      //       用裸 name 當結果鍵。能對上是靠 board.operations 的 name 唯一性，
      //       端點自己並不驗證。/api/proto 轉正時應回三個獨立結果集。
      const res = await api.post<{ results: { key: string; ok: boolean; error?: string }[] }>(
        "/api/proto/tags-batch", toPayload(ops),
      );
      if (!res.ok) throw new Error(res.error);

      const failures = new Map<string, string>();
      for (const r of res.data.results) if (!r.ok) failures.set(r.key, r.error ?? "未知錯誤");
      this.lastFailures = Object.fromEntries(failures);

      const succeeded = names.filter((n) => !failures.has(n));
      this.board.handleDetach(succeeded);

      if (succeeded.length > 0) addToast({ message: `已套用 ${succeeded.length} 筆標籤操作`, variant: "success" });
      if (failures.size > 0)    addToast({ message: `${failures.size} 筆操作失敗`, variant: "error" });

      this.revision++;
      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
    } catch (e) {
      addToast({ message: formatError(e), variant: "error" });
    } finally {
      this.pending = false;
    }
  };
}
```

`toPayload(ops)` 是檔案內的 private 函式（原 `changeset.ts` 的 `changesetFromOperations` + `toPayload` 合併）。原本的兩段轉換（先轉 `TagChangeset` 再轉 `ChangesetPayload`）中間型別沒有第二個消費者，直接一步到位。`changeset.ts` 整檔消失。

### 3.8 `review.svelte.ts`

**一句話：管理審查清單。** 與 staged/committed 的 `review` 逐字同形，只有 `checkableOf` 的來源不同。

```ts
class ReviewController {
  private board  = getBoardContext();
  private submit = getSubmitContext();

  /** 全部畫布上的標籤，維持插入順序，**不應加入任何過濾** */
  private names = $derived(this.board.operations.map((op) => op.name));
  private pagination = new SveltePagination(() => this.names, 25);
  private checked = $state<Record<string, true>>({});

  checkableOf(name: string): boolean { return this.board.problemOf(name) === null; }
  isChecked(name: string): boolean { return !!this.checked[name]; }

  open              = $state(false);
  totalCount        = $derived(this.pagination.total);
  batch             = $derived(this.pagination.page);
  batches           = $derived(this.pagination.pages);
  batchNames        = $derived(this.pagination.items);
  checkableNames    = $derived(this.batchNames.filter((n) => this.checkableOf(n)));
  checkableCount    = $derived(this.checkableNames.length);
  submittableNames  = $derived(this.batchNames.filter((n) => this.checked[n] && this.checkableOf(n)));
  submittableCount  = $derived(this.submittableNames.length);
  bulkSelectionState = $derived.by(...);

  private moveTo(batch: number) { /* 同 staged：換批 + 重新全選本批可送出項目 */ }

  handleOpen  = () => { this.submit.clearFailures(); this.moveTo(1); this.open = true; };
  handleClose = () => { if (!this.submit.pending) this.open = false; };
  handleFirstBatch / handlePrevBatch / handleNextBatch / handleLastBatch
  handleToggle / handleToggleAll
  handleDiscard = (name: string) => { this.board.handleDetach([name]); };
  handleSubmit  = async () => { /* 同 staged：呼叫 submit，再依 lastFailures 同步 checked */ };
}
```

`handleOpen` 裡「用空的 checked 集合先跑一次 builder 只為了讀 checkable」的 hack 自然消失——`moveTo(1)` 本來就會用 `checkableOf` 重新全選。

### 3.9 `refresh.svelte.ts`（新增，從 `operations` 拆出）

與 staged 的 `refresh` 逐字相同，只多一個 `revision`：

```ts
class RefreshController {
  pending  = $state(false);
  /** 每次重新整理完成後 +1，供依賴標籤庫內容的快取失效 */
  revision = $state(0);

  handleRefresh = async () => { /* 300ms 延遲 + goto invalidateAll + toast；成功後 revision++ */ };
}
```

不再呼叫 `previews.clear()`。`operations.svelte.ts` 至此整檔刪除。

### 3.10 `previews.svelte.ts`

查詢與快取邏輯不變，但失效規則從兩個呼叫端搬回快取自己身上：

```ts
class PreviewsController {
  private submit  = getSubmitContext();
  private refresh = getRefreshContext();
  private cache = new SvelteMap<string, CacheEntry>();

  constructor() {
    // 標籤庫可能已被改動，先前查到的預覽圖失效
    $effect(() => {
      this.submit.revision;
      this.refresh.revision;
      this.cache.clear();
    });
  }

  get     = (tag: string) => this.cache.get(tag);
  request = async (tag: string) => { /* 同現況 */ };
  // clear() 不再公開
}
```

沒有選擇「監看 `pageData.value` 變動就清空」，是因為換頁與換篩選也會讓 `load` 重跑，那會讓來回翻頁一直重查預覽圖；`revision` 精準對應「資料真的可能變了」。代價是新增第四種會改動標籤庫的操作時，要來這裡加一行依賴——但改的地方在擁有快取的人身上，而不是散在各操作裡各記一次。

### 3.11 `guard.svelte.ts`（新增，從 `board` 拆出）

與 staged 的 `guard` 逐字同形：

```ts
class GuardController {
  private board   = getBoardContext();
  private submit  = getSubmitContext();
  private refresh = getRefreshContext();
  private review  = getReviewContext();

  /** 會真的改動資料的操作是否進行中。只讀，不寫 */
  private get busy() { return this.submit.pending || this.refresh.pending; }

  handleBeforeNavigate = (nav: BeforeNavigate) => {
    if (nav.type === "leave") return;
    const to = nav.to;
    // 判斷來源頁必須用 page.url，popstate 時 location 已經是目標頁
    const leaving = to === null || to.url.pathname !== page.url.pathname;
    if (!leaving) return;               // 自身的換頁/篩選 goto 不攔

    if (this.busy) { nav.cancel(); addToast({ message: "操作進行中，請稍候", variant: "info" }); return; }
    if (this.review.totalCount === 0) return;

    nav.cancel();
    if (to === null) return;
    const msg = `畫布上還有 ${this.review.totalCount} 筆標籤操作尚未送出，離開將會遺失這些排程。確定要離開？`;
    requestConfirm(msg, { title: "尚未送出的標籤操作", action: "離開" }).then((confirmed) => {
      if (!confirmed) return;
      this.board.handleClearAll();
      goto(to.url.href);
    });
  };

  handleBeforeUnload = (e: BeforeUnloadEvent) => { /* 同 staged */ };
}
```

計數一律讀 `review.totalCount`（唯一計算點），與 staged/committed 一致。

---

## 四、投影的歸屬

以下東西目前住在 `logic/`，重寫後回到模板：

| 現況位置 | 搬到 | 理由 |
| --- | --- | --- |
| `review-entry.ts` 的 `ReviewEntry` 型別 | 刪除，不需具名 | 單一消費者的顯示形狀 |
| `review-entry.ts` 的 `buildReviewEntries()` | `review/ReviewBody.svelte` 內的區域 `buildEntry()`，不 export | 同上；對標 staged 的 `ReviewBody` |
| `review-entry.ts` 的 `isValidTagName()` | 併入 `board.problemOf()` | 那是事實，不是形狀 |
| `query.disabledFirst` 等四個 | `chips/Pagination.svelte` 的 `$derived` | 由 `navigating` / `atFirst` / `atLast` 三個事實組出 |
| `drag.zoneHandlers()` 回傳的 DOM handler | `ZoneContainer.svelte` / `Pool.svelte` | 純 DOM 細節 |
| `ZoneHeader` 自己 `board.groups.find(...)` 三選一取 tags | 由 `Zones.svelte` 算好後往下傳 `zone` prop | 同一種投影只能有一個構成方式 |

`ReviewBody.svelte` 的投影會同時讀 `review` / `board` / `merge-count` / `submit` 四個 controller：

```svelte
<script lang="ts">
  /** 把一個標籤目前的異動與審查資訊投影成一列審查紀錄 */
  function buildEntry(name: string, checked: boolean, failure?: string) {
    const op = board.operationOf(name)!;
    const problem = board.problemOf(name) ?? (failure ? `送出失敗：${failure}` : null);
    const checkable = problem === null;
    const mergedCount = op.kind === "merge" || op.kind === "rename"
      ? mergeCount.countOf(op.groupId) : undefined;

    return { ...op, mergedCount, problem, checkable, checked: checkable && checked };
  }

  const entries = $derived(
    review.batchNames.map((n) => buildEntry(n, review.isChecked(n), submit.lastFailures[n])),
  );
</script>
```

這正是文件說的「投影可以組合數個 controller，這不是壞味道」。

---

## 五、檔案樹

```
routes/tags/
├── +page.server.ts             不變
├── +page.svelte                只呼叫 create*Context() + 掛 window 事件 + 版面骨架
├── logic/                      11 個檔案，全部是 controller
│   ├── page-data.svelte.ts     不變
│   ├── query.svelte.ts         改（disabled 四項下放）
│   ├── selection.svelte.ts     不變
│   ├── board.svelte.ts         大改（瘦身 + problemOf + 單一寫入入口）
│   ├── merge-count.svelte.ts   新增
│   ├── drag.svelte.ts          改（不再回傳 DOM handler，不再繞過 handleAssign）
│   ├── submit.svelte.ts        新增（吸收 changeset.ts）
│   ├── review.svelte.ts        大改（拆掉送出，導入分批）
│   ├── refresh.svelte.ts       新增（自 operations 拆出）
│   ├── previews.svelte.ts      改（自行失效）
│   └── guard.svelte.ts         新增（自 board 拆出）
├── header/
│   ├── Filters.svelte          不變
│   └── CleanLink.svelte        不變
├── chips/
│   ├── Pool.svelte             改（自行處理 DOM 事件）
│   ├── Chips.svelte            不變
│   ├── Chip.svelte             不變
│   ├── ChipTooltip.svelte      小改（previews 改由 getContext 取，不再走 prop）
│   └── Pagination.svelte       改（自行組 disabled）
├── zone/
│   ├── Zones.svelte            新增（自 +page.svelte 的 aside snippet 搬出）
│   ├── ZoneContainer.svelte    改（自行處理 DOM 事件）
│   ├── ZoneHeader.svelte       改（zone 由 prop 傳入，不自己 find）
│   ├── ZoneBodyCreate.svelte   小改（改呼叫 handleAssign）
│   ├── ZoneBodyGroup.svelte    改（拿掉 bind:value，mergeCount 改讀 merge-count）
│   ├── ZoneBodyDelete.svelte   小改（zone 由 prop 傳入）
│   └── ZoneBodyHidden.svelte   小改（同上）
└── review/
    ├── ReviewModal.svelte      改（分批 footer、pending 來源改 submit）
    └── ReviewBody.svelte       新增（分批清單與投影）
```

**刪除**：`logic/operations.svelte.ts`、`logic/changeset.ts`、`logic/review-entry.ts`。

`+page.svelte` 的最終樣貌：

```svelte
<script lang="ts">
  // …11 行 create*Context()…
  beforeNavigate(guard.handleBeforeNavigate);
</script>

<svelte:window onbeforeunload={guard.handleBeforeUnload} />
<svelte:head><title>Tags</title></svelte:head>

<div class="container">
  <Toolbar>
    <Filters />
    <RefreshButton pending={refresh.pending} onrefresh={refresh.handleRefresh} style="margin-left: auto;" />
    <CleanLink />
    <ReviewTrigger
      count={review.totalCount}
      disabled={review.totalCount === 0 || submit.pending}
      onclick={review.handleOpen}
    />
  </Toolbar>
  <div><Pool /><Zones /></div>
</div>

<ReviewModal />
```

`ChipTooltip.svelte` 目前透過 prop 收 `previews`（`previews: ReturnType<typeof getPreviewsContext>`），但它的父層 `Chip.svelte` 也是自己 `getContext` 拿的。改成 `ChipTooltip` 直接 `getPreviewsContext()`，`Chip` 少傳一個 prop。

---

## 六、使用者可見的行為變更

| # | 變更 | 性質 |
| --- | --- | --- |
| 1 | 審查清單改為一批 25 筆，超過時出現與 staged/committed 相同的翻頁列；「送出」只送本批已勾選的項目 | 已定案 |
| 2 | 重新整理進行中時，「檢視變更」按鈕不再被禁用（改只看 `submit.pending`） | 全頁鎖拆開的必然結果。畫布是純本地狀態，重新整理不影響它，維持禁用沒有理由 |
| 3 | 換頁／換篩選不再清空標籤預覽圖快取；只有送出成功或按重新整理才清 | 失效規則搬進 `previews` 的必然結果，且是改善 |
| 4 | 合併區的重新命名輸入框在名稱不合法時，當下就顯示問題 | **選配**。`problemOf` 上移是架構需求，但要不要在 `ZoneBodyGroup` 顯示是獨立決定。不做的話行為與現況完全相同 |
| 5 | 送出時 toast 文案與計數不變，但失敗項目的原因改由投影合成（`送出失敗：…`），與現況顯示一致 | 等價 |

不變的部分：拖放互動、選取語意（含跨頁保留）、四種區的視覺與文案、合併後張數的 300ms debounce 與骨架佔位、離頁確認的文案與時機、URL 查詢參數格式。

---

## 七、實作階段（建議的 commit 切分）

每一階段結束都應能通過 `npm run check` 與 `npm run build`。

1. **拆掉全頁鎖。** 新增 `refresh.svelte.ts` 與 `submit.svelte.ts`（先原樣搬運 `changeset.ts` 的呼叫），刪 `operations.svelte.ts`。`review.handleSubmit` 改成呼叫 `submit.handleSubmit`。此步驟消除原則 3(b) 的違反，改動面最大但最機械。
2. **拆出 `guard.svelte.ts`。** 從 `board` 搬離頁守衛，計數改讀 `review.totalCount`。
3. **拆出 `merge-count.svelte.ts`。** `Zone` 去掉 `mergeCount`，`board` 去掉 `timers` / `queryMergeCount` / `removeGroup` 的 timer 清理。
4. **收斂 board 的寫入入口。** 六個入口收成 `handleAssign` / `handleDetach` / `handleRename` / `handleDissolve` / `handleClearAll`；`ZoneTarget` 統一；`drag` 改呼叫 `handleAssign`。
5. **`problemOf` 上移，`review-entry.ts` 消失。** 新增 `review/ReviewBody.svelte` 承接投影；`review.handleOpen` 拿掉 builder hack。
6. **導入分批。** `review` 接上 `SveltePagination`，`ReviewModal` 加 `ReviewListFooter`。
7. **元件層收尾。** `drag` 停止回傳 DOM handler；`ZoneBodyGroup` 拿掉 `bind:value`；新增 `zone/Zones.svelte`；`query` 的 disabled 下放到 `Pagination.svelte`；`ChipTooltip` 改 `getContext`；`previews` 自行失效。

---

## 八、驗收檢查清單（需人工在瀏覽器驗證）

自動驗證（`npm run check` / `npm run build`）不涵蓋以下項目：

**畫布與拖放**
- [ ] 從池拖單一標籤到「新合併區」／既有合併區／刪除區／隱藏切換區，四者都正確排入
- [ ] 選取多個標籤後拖曳其中一個，整組一起排入且選取被清空
- [ ] 選取多個標籤後按各區標頭的「加入選取中的標籤」鈕，結果與拖曳一致
- [ ] 把已在某區的標籤拖回標籤池，會自該區移除
- [ ] 拖曳經過區塊時高亮正確；游標移到區塊內的按鈕／輸入框上時高亮**不**閃爍
- [ ] 合併區成員被移光時，該區自動消失
- [ ] Chip 的顏色（合併=強調色／刪除=錯誤色／隱藏=警告色）與所在區一致

**合併區**
- [ ] 修改「合併後的名稱」輸入框，張數骨架出現、約 300ms 後顯示新數字
- [ ] 快速連續輸入時，只有最後一次的結果會顯示（不會被較早的回應蓋掉）
- [ ] 同時操作兩個合併區時，改 A 組不會讓 B 組的數字變回骨架
- [ ] 點成員 chip 上的星號可將它設為主名稱，輸入框同步更新且張數重查
- [ ] 移除某個合併區後，該區在途的張數查詢不會造成任何錯誤或殘留

**審查清單**
- [ ] 排入超過 25 筆操作時出現翻頁列；換批後本批可送出項目重新全選
- [ ] 送出中無法關閉對話框、無法換批
- [ ] 部分失敗時，失敗項目留在清單上並顯示「送出失敗：…」，成功項目自畫布移除
- [ ] 全部成功時對話框自動關閉，列表重新載入
- [ ] 清單上的「捨棄這筆操作」會把該標籤移回池
- [ ] 合併目標本身也被排入重新命名／刪除時，該筆顯示問題且不可勾選

**守衛與並行**
- [ ] 畫布有未送出操作時，點選單導向其他頁會跳確認框；確認後畫布清空並成功離開
- [ ] 同頁的換頁／換篩選／重新整理**不會**觸發確認框
- [ ] 送出或重新整理進行中時嘗試離頁，顯示「操作進行中，請稍候」並取消導航
- [ ] 瀏覽器上一頁/下一頁（popstate）離開本頁時守衛仍生效
- [ ] 重新整理進行中，「檢視變更」按鈕仍可點（本次行為變更 #2）

**標籤池**
- [ ] 搜尋／排序／隱藏篩選改變後頁碼重置為 1，且清單捲回頂端
- [ ] 翻頁按鈕在首頁/末頁正確禁用，導航在途時全部禁用
- [ ] 跨頁選取的標籤在翻頁後仍保持選取，「清空選取 (n)」計數正確
- [ ] 懸停標籤 300ms 後出現預覽縮圖；`count === 0` 的標籤顯示「沒有已提交的圖片使用此標籤」
- [ ] 翻頁來回後，先前看過的標籤預覽**不**重新查詢（本次行為變更 #3）
- [ ] 送出成功或按重新整理後，預覽快取被清空、下次懸停重查
