# Tagger 路由遷移計畫

> 本文件基於 `docs/frontend.md` 規範，分析 `tagger` 路由的現狀違規，並規劃完整的遷移方案。

---

## 一、現狀分析

### 1.1 檔案結構

```
tagger/
├── +page.server.ts
├── +page.svelte
├── context.svelte.ts          ← 核心違規：基於 createContext 的全域共享狀態
├── TaggerProgress.svelte  /  taggerProgress.svelte.ts
├── TaggerSidebar.svelte   /  taggerSidebar.svelte.ts
├── TaggerList.svelte      /  taggerList.svelte.ts
├── TaggerPreview.svelte   /  taggerPreview.svelte.ts
├── TaggerPanel.svelte     /  taggerPanel.svelte.ts
```

### 1.2 現行資料流

所有子元件透過 `getTaggerContext()` 存取同一個 `TaggerContext` class instance。該 class 持有全部共享 `$state`（`list`、`cursor`、`selected`、`tags`、`rating`、`loading`、`imageLoading`、`total`）以及非響應式引用（`zoomPan`、`listEl`）。

資料流如下：

```
+page.svelte
 └─ setTaggerContext(new TaggerContext())
      ↕ 所有子元件透過 getTaggerContext() 直接讀寫
      ├─ TaggerProgress    → 讀 total, list.length, loading, imageLoading
      ├─ TaggerSidebar     → 讀寫 list, cursor, selected, total, loading, imageLoading; 讀寫 zoomPan, listEl
      │   └─ TaggerList    → 讀寫 cursor, selected, imageLoading; 讀 list, ITEM_H, listEl, zoomPan
      ├─ TaggerPreview     → 讀 cursor, list, selected, loading, imageLoading; 建立並寫入 zoomPan
      └─ TaggerPanel       → 讀寫 cursor, selected, list, tags, rating, loading, imageLoading; 讀 listEl, zoomPan
```

每個元件可任意讀寫 context 上的任何屬性，沒有明確的 ownership。

### 1.3 規範違規摘要

| # | 違規內容 | 對應規範 |
|---|---------|---------|
| 1 | 使用 `createContext` / `getTaggerContext` 作為跨元件共享機制 | §1.2 「不使用 Context」 |
| 2 | 共享 `$state` 宣告在 `TaggerContext` class 中，而非 `+page.svelte` 或無頭 UI | §1.2 「狀態只有兩種歸屬」 |
| 3 | 子元件的 `.svelte` 直接呼叫 `getTaggerContext()` 並在模板中混用 `ctx.*` 與 `ui.*` | §2.3 「模板只需使用 `ui.*`」 |
| 4 | 工廠函數內部呼叫 `getTaggerContext()` 取得依賴，而非透過 `options` 參數注入 | §1.3 / §2.2 「接收 options 物件」 |
| 5 | 元件之間没有任何 props 傳遞——所有資料通過 context 隱式共享 | §1.2 「SSR data 透過 props 傳給子元件」 |
| 6 | `selectSingle` 函數在三個工廠中重複實現（taggerList、taggerSidebar、taggerPanel） | 違反 DRY 原則 |

---

## 二、遷移核心策略

### 2.1 刪除 Context，狀態回歸 `+page.svelte`

移除 `context.svelte.ts`。所有跨元件共享的 `$state` 移至 `+page.svelte` 宣告，透過 props / `bind` 向下傳遞：

```
+page.svelte ($state owner)
  ├─ props ↓ / bind ↕
  ├─ <header> 直接寫在 +page.svelte 中
  │    ├─ 返回首頁連結
  │    ├─ TaggerProgress（進度條 + 文字）
  │    └─ TaggerLoading（載入指示器）
  ├─ TaggerSidebar → TaggerList
  ├─ TaggerPreview
  └─ TaggerPanel
```

### 2.2 §1.5 機制/策略分離——最大簡化點

當前 `TaggerList` 混合了三個職責：虛擬捲動、選取語意、項目渲染。套用 §1.5 分析：

| 分類 | 內容 | 理由 |
|------|------|------|
| **機制** | `itemCount`、`itemHeight`、可見範圍計算、多選語意（single/ctrl/shift）、捲動同步 | 移除後元件無法運作 |
| **策略** | 每一項的**渲染內容**（縮圖 + 檔名）、選取變更後的**副作用**（重置 tags/rating、zoomPan.reset） | 移除後列表仍可捲動、選取、定位可見項目 |

遷移後，`TaggerList` 接受 **`renderItem` snippet** 與 **`onselect` callback**，不再需要 `list`（檔名陣列）、`imgSrc`、`tags`、`rating`、`zoomPan` 等不屬於虛擬列表核心的依賴：

```svelte
<!-- TaggerSidebar.svelte 定義 renderItem snippet（策略） -->
<TaggerList {itemCount} {itemHeight} bind:cursor bind:selected {onselect}>
  {#snippet renderItem(index)}
    <img src={imgSrc("staged", list[index], "sm")} alt={list[index]} loading="lazy" />
    <span>{list[index]}</span>
  {/snippet}
</TaggerList>
```

```svelte
<!-- TaggerList.svelte 只負責機制 -->
{#each ui.visible as item (item.index)}
  <button
    class="virtual-item"
    class:active={item.index === cursor}
    class:selected={selected.has(item.index)}
    style="top:{item.index * itemHeight}px; height:{itemHeight}px"
    onclick={(e) => ui.handleItemClick(e, item.index)}
  >
    {@render renderItem(item.index)}
  </button>
{/each}
```

**效果：** `TaggerList` 的介面縮減為純機制配置 + 策略注入口，不再擁有任何「轉交型 props」。

### 2.3 非響應式引用（§1.4）

`zoomPan` 實例不驅動 UI 重繪，僅供其他元件呼叫 `.reset()`。以 §1.4 模式在 `+page.svelte` 建立一般物件，pass-by-reference 向下傳遞：

```svelte
<!-- +page.svelte -->
<script lang="ts">
  const refs = {
    zoomPan: null as ReturnType<typeof useZoomPan> | null,
  };
</script>

<TaggerPreview {refs} ... />
<TaggerPanel {refs} ... />
<TaggerSidebar {refs} ... />
```

`TaggerPreview` 的工廠函數建立 `useZoomPan()` 實例後寫入 `options.refs.zoomPan`，其他元件透過 `options.refs.zoomPan?.reset()` 呼叫。

### 2.4 消除重複的「選取並重置」邏輯

目前三個工廠（taggerList、taggerSidebar、taggerPanel）各自實現了幾乎相同的「設定 cursor → 更新 selected → 清空 tags/rating → scrollToActive → zoomPan.reset」序列。遷移後以兩個機制消除重複：

1. **`onselect` 回調**：`TaggerList` 在任何選取變更後觸發 `onselect`，由 `+page.svelte` 提供統一的副作用邏輯（重置 tags/rating、呼叫 zoomPan.reset）。
2. **`$effect` 自動捲動**：`TaggerList` 的工廠函數中設置 `$effect` 監聽 `cursor` 變更，自動執行 `scrollToActive`。無論 cursor 由列表點擊或外部鍵盤導航更新，都能正確捲動，消除手動呼叫 `scrollToActive` 的需求。
3. **共用工具函數**：針對 commit/trash/refresh 後的「移除項目 → 重新定位 cursor → 重選」模式，提取為可重複使用的純函數。

---

## 三、新架構設計

### 3.1 `+page.svelte` 的共享狀態

```svelte
<script lang="ts">
  import type { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  // ─── 共享 $state ─────────────────────────────
  let list = $state(data.stagedFiles);
  let total = $state(data.stagedFiles.length);
  let cursor = $state(data.stagedFiles.length > 0 ? 0 : -1);
  let selected = $state<Set<number>>(new Set(data.stagedFiles.length > 0 ? [0] : []));
  let tags = $state<string[]>([]);
  let rating = $state(0);
  let loading = $state(false);
  let imageLoading = $state(false);

  // ─── 非響應式引用（§1.4）──────────────────────
  const refs = {
    zoomPan: null as ReturnType<typeof useZoomPan> | null,
  };

  // ─── 選取副作用回調（策略注入）──────────────────
  function handleSelect() {
    tags = [];
    rating = 0;
    refs.zoomPan?.reset();
  }

  // ─── Viewport guard ──────────────────────────
  let windowWidth = $state(900);
  let windowHeight = $state(600);
  const MIN_WIDTH = 860;
  const MIN_HEIGHT = 500;
  let tooSmall = $derived(windowWidth < MIN_WIDTH || windowHeight < MIN_HEIGHT);
</script>
```

> **關於 `handleSelect`**：這是一個無業務邏輯的「狀態重置膠水函數」，僅做三個賦值操作，屬於 `+page.svelte` 作為狀態 owner 的合理職責。

### 3.2 元件樹與 Props 流

```
+page.svelte
│
├─ <header>                                              ← 編排職責，直接寫在 +page
│    ├─ <a href="/">返回首頁</a>
│    ├─ TaggerProgress                                   ← 純展示，無 .svelte.ts
│    │    props: total, listLength                       ← 全部唯讀
│    └─ TaggerLoading                                    ← 純展示，無 .svelte.ts
│         props: loading, imageLoading                   ← 全部唯讀
│
├─ TaggerSidebar
│    props: list↕, total↕, cursor↕, selected↕,
│           loading↕, imageLoading↕, refs,
│           onselect
│    │
│    └─ TaggerList                                       ← §1.5 重點
│         props: itemCount, itemHeight,
│                cursor↕, selected↕, imageLoading↕,
│                onselect
│         snippet: renderItem(index)                     ← 策略注入
│
├─ TaggerPreview
│    props: list, cursor, loading, imageLoading↕, refs
│
└─ TaggerPanel
     props: tags↕, rating↕, list↕, cursor↕, selected↕,
            loading↕, imageLoading↕, refs, onselect
```

> `↕` = `$bindable`。未標記 = 唯讀（普通 prop）。

### 3.3 各元件 §1.5 分析

#### TaggerProgress

| 分類 | Props | 理由 |
|------|-------|------|
| 機制 | `total`, `listLength` | 進度計算的核心資料 |
| 策略 | （無） | 純展示元件，無需策略注入 |

純展示元件（§2.1 例外），無 `.svelte.ts`。接收 `total` 與 `listLength`，在 `.svelte` 的 `<script>` 中以 `$derived` 計算 `processed`、`progressPct`、`progressLabel`，渲染進度條與進度文字。

#### TaggerLoading

| 分類 | Props | 理由 |
|------|-------|------|
| 機制 | `loading`, `imageLoading` | 載入指示器的顯示條件 |
| 策略 | （無） | 純展示元件，無需策略注入 |

純展示元件（§2.1 例外），無 `.svelte.ts`。接收 `loading` 與 `imageLoading` 兩個布林值，條件渲染 `CircularProgress`。

#### TaggerSidebar

| 分類 | Props / 內容 | 理由 |
|------|-------------|------|
| 機制 | sidebar 佈局（header + list + footer）、重新整理/上傳邏輯 | 移除後元件不成立 |
| 策略 | `renderItem` snippet（定義列表項目的渲染內容並傳給 TaggerList） | TaggerSidebar 作為 TaggerList 的直屬父級，自然持有 `list` 繪製所需的資料 |

#### TaggerList

| 分類 | Props | 理由 |
|------|-------|------|
| 機制 | `itemCount`, `itemHeight`, `cursor`↕, `selected`↕, `imageLoading`↕ | 虛擬捲動 + 多選語意的核心 |
| 策略 | `renderItem` snippet, `onselect` callback | 項目渲染內容與選取後的副作用 |

#### TaggerPreview

| 分類 | Props | 理由 |
|------|-------|------|
| 機制 | zoom-pan 互動、圖片展示 | 核心功能 |
| 策略 | （無）——`list[cursor]` 計算預覽圖來源是機制的一部分 | 需要 `list` + `cursor` 來確定顯示哪張 |

#### TaggerPanel

| 分類 | Props | 理由 |
|------|-------|------|
| 機制 | `tags`↕, `rating`↕ 的編輯 UI、action 按鈕、keyboard shortcuts 顯示 | 核心 UI 元素 |
| 策略 | commit/trash/navigate 的**完整實現**在工廠函數中——需要 `list`↕, `cursor`↕, `selected`↕, `loading`↕, `imageLoading`↕, `refs`, `onselect` | 操作邏輯需要讀寫共享狀態 |

> **TaggerPanel options 較多的取捨**：commit/trash 流程牽涉列表突變、游標重定位、API 呼叫、toast 通知等，這些業務邏輯自然歸屬於擁有對應按鈕的元件工廠。若嘗試將 commit/trash 提升為回調，orchestration 邏輯將被迫移入 `+page.svelte`（違反「不含業務邏輯」原則），或創造一個僅為了避免 options 而存在的人為抽象。因此，接受 TaggerPanel 的 options 較多是正確的權衡。

---

## 四、各元件遷移細節

### 4.1 刪除 `context.svelte.ts`

直接刪除。所有 `import { getTaggerContext }` 與 `import { setTaggerContext, TaggerContext }` 一併移除。`ITEM_H` 常數移入 `TaggerList` 工廠函數（只有它使用）。

### 4.2 `+page.svelte`

| 項目 | 舊 | 新 |
|------|-----|-----|
| 共享狀態 | `setTaggerContext(new TaggerContext())` | 直接宣告 `$state` 變數 |
| 初始化 | `ctx.list = proxy.list; ctx.cursor = 0` | 在 `$state()` 初始值中完成 |
| 子元件傳值 | 無 props（`<TaggerSidebar />`） | 完整 props + bind |
| 副作用 | — | `handleSelect` 膠水函數 |
| Viewport guard | 不變 | 不變 |

子元件組裝範例：

```svelte
<header class="page-header">
  <a href="/" class="btn btn-ghost btn-sm">
    <IconArrowLeft size={16} />
    首頁
  </a>
  <TaggerProgress {total} listLength={list.length} />
  <TaggerLoading {loading} {imageLoading} />
</header>
<main class="tagger-main">
  <TaggerSidebar
    bind:list bind:total bind:cursor bind:selected
    bind:loading bind:imageLoading {refs}
    onselect={handleSelect}
  />
  <TaggerPreview {list} {cursor} {loading} bind:imageLoading {refs} />
  <TaggerPanel
    bind:tags bind:rating bind:list bind:cursor bind:selected
    bind:loading bind:imageLoading {refs}
    onselect={handleSelect}
  />
</main>
```

### 4.3 `TaggerProgress` + `TaggerLoading`（拆分自原 `TaggerProgress`）

原 `TaggerProgress` 混合了三個職責：進度條、載入指示器、`<header>` 佈局。遷移後拆為：

1. **`<header>` 佈局**移入 `+page.svelte`——這是頁面殼的編排職責（§1.2）。返回首頁連結亦屬頁面級導航。
2. **`TaggerProgress.svelte`**（純展示，刪除 `taggerProgress.svelte.ts`）——僅保留進度條 + 進度文字。`$derived`（`processed`、`progressPct`、`progressLabel`）直接寫在 `.svelte` 的 `<script>` 中，因為不含任何 handler 或 `$state`，屬 §2.1 例外。
3. **`TaggerLoading.svelte`**（新增，純展示，無 `.svelte.ts`）——條件渲染 `CircularProgress`。

#### TaggerProgress（重構）

**Props：**

```ts
type Props = {
  total: number;
  listLength: number;
};
```

**模板：** 進度條（`.progress-bar` + `.progress-bar-fill`）與進度文字（`.tagger-progress-text`）。

#### TaggerLoading（新增）

**Props：**

```ts
type Props = {
  loading: boolean;
  imageLoading: boolean;
};
```

**模板：** `{#if loading}` / `{#if imageLoading}` 條件渲染 `CircularProgress` 元件。

### 4.4 `TaggerList`（§1.5 重構重點）

**變更幅度：大**

**新 Props 介面：**

```ts
type Props = {
  /** 項目總數 */
  itemCount: number;
  /** 單項固定高度 */
  itemHeight: number;
  /** 雙向綁定：目前游標位置 */
  cursor: number;
  /** 雙向綁定：已選取索引集合 */
  selected: Set<number>;
  /** 雙向綁定：圖片切換載入狀態 */
  imageLoading: boolean;
  /** 選取變更後的副作用回調 */
  onselect?: () => void;
  /** 策略注入：單一項目的渲染內容 */
  renderItem: Snippet<[index: number]>;
};
```

**新 `taggerList.svelte.ts`：**

```ts
type TaggerListOptions = {
  itemCount: number;      // getter
  itemHeight: number;     // getter
  cursor: number;         // getter/setter
  selected: Set<number>;  // getter/setter
  imageLoading: boolean;  // getter/setter
  onselect?: () => void;
};

export function createTaggerList(options: TaggerListOptions) {
  // $state: listEl (DOM ref), scrollTop, viewH, anchor
  // $derived: totalH, startIdx, endIdx, visible
  // $effect: ResizeObserver on listEl
  // $effect: 監聽 cursor 變更 → scrollToActive（消除外部手動捲動需求）
  // handlers: handleItemClick (single/ctrl/shift), handleListScroll
  // return: listEl getter/setter, totalH, visible, handlers
}
```

**關鍵變更：**

1. `listEl` 從 context 移入工廠函數內部的 `$state`，透過 getter/setter 暴露給 `.svelte` 的 `bind:this`
2. 新增 `$effect` 監聽 `options.cursor` 變更 → `scrollToActive(listEl, options.cursor, options.itemHeight)`，自動處理所有外部觸發的游標移動（鍵盤導航、commit/trash 後重定位）
3. `selectSingle`、`selectCtrl`、`selectShift` 不再重置 `tags`/`rating`/`zoomPan`——改為觸發 `options.onselect?.()` 讓呼叫者統一處理
4. `renderItem` snippet 使得 TaggerList 不再需要 `list`（檔名陣列）和 `imgSrc`

**新 `.svelte` 模板結構：**

TaggerList 負責按鈕外殼（positioning、active/selected 樣式、click handler），snippet 負責內容。項目容器的 active / selected 樣式仍由 TaggerList 管理（屬於選取機制的視覺回饋）。

### 4.5 `TaggerSidebar`

**變更幅度：中**

**新 Props 介面：**

```ts
type Props = {
  list: string[];
  total: number;
  cursor: number;
  selected: Set<number>;
  loading: boolean;
  imageLoading: boolean;
  refs: TaggerRefs;
  onselect?: () => void;
};
// list, total, cursor, selected, loading, imageLoading 皆為 $bindable
```

**新 `taggerSidebar.svelte.ts`：**

```ts
type TaggerSidebarOptions = {
  list: string[];           // getter/setter
  total: number;            // getter/setter
  cursor: number;           // getter/setter
  selected: Set<number>;    // getter/setter
  loading: boolean;         // getter/setter
  imageLoading: boolean;    // getter/setter
  refs: TaggerRefs;
  onselect?: () => void;
};
```

- `refreshList`、`handleRefreshClick`、`handleUploadClick`、`handleUploadChange` 邏輯大致不變
- 將 `ctx.xxx` 替換為 `options.xxx`
- `selectSingle` 內部的 `tags = []; rating = 0` 移除，改用 `options.onselect?.()` 統一觸發
- Refresh 後的游標重定位邏輯可抽取為共用工具函數（見 §4.8）

**新 `.svelte` 模板變更：**

- 定義 `renderItem` snippet 並傳入 `TaggerList`
- `TaggerList` 不再獨立存在——由 TaggerSidebar 組裝並提供渲染策略

```svelte
<TaggerList
  itemCount={list.length}
  itemHeight={72}
  bind:cursor bind:selected bind:imageLoading
  {onselect}
>
  {#snippet renderItem(index)}
    <img class="thumb-img" src={imgSrc("staged", list[index], "sm")} alt={list[index]} loading="lazy" />
    <span class="thumb-name">{list[index]}</span>
  {/snippet}
</TaggerList>
```

> snippet 中的元素樣式需寫在 TaggerSidebar 的 `<style>` 中（snippet 在父級作用域定義）。原本在 TaggerList 的 `.tagger-thumb-img`、`.tagger-thumb-name` 樣式遷移至 TaggerSidebar。

### 4.6 `TaggerPreview`

**變更幅度：小**

**新 Props 介面：**

```ts
type Props = {
  list: string[];
  cursor: number;
  loading: boolean;
  imageLoading: boolean;  // $bindable（onload 時設 false）
  refs: TaggerRefs;
};
```

**新 `taggerPreview.svelte.ts`：**

- `useZoomPan()` 實例建立後寫入 `options.refs.zoomPan`
- `currentFile`、`previewSrc` 的 `$derived` 從 `options.list` 和 `options.cursor` 計算
- `selectedCount` 移除（TaggerPreview 不再需要 `selected`——目前僅用於顯示「已選 N 張」提示，該資訊可由 `+page.svelte` 額外傳一個 `selectedCount` prop 或直接在 Preview 重新計算）

**考量**：目前 `.svelte` 直接使用 `selectedCount` 顯示選取計數文字。遷移後有兩種選擇：
1. 新增 `selectedCount` 為唯讀 prop
2. 新增 `selected` 為唯讀 prop，由 Preview 工廠 `$derived` 計算 `selected.size`

建議採用方案 1（更精簡），因為 Preview 只需要數字，不需要操作集合。

### 4.7 `TaggerPanel`

**變更幅度：大**

**新 Props 介面：**

```ts
type Props = {
  tags: string[];
  rating: number;
  list: string[];
  cursor: number;
  selected: Set<number>;
  loading: boolean;
  imageLoading: boolean;
  refs: TaggerRefs;
  onselect?: () => void;
};
// 全部為 $bindable（Panel 的 commit/trash/navigate 會寫入多數狀態）
```

**新 `taggerPanel.svelte.ts`：**

```ts
type TaggerPanelOptions = {
  tags: string[];           // getter/setter
  rating: number;           // getter/setter
  list: string[];           // getter/setter
  cursor: number;           // getter/setter
  selected: Set<number>;    // getter/setter
  loading: boolean;         // getter/setter
  imageLoading: boolean;    // getter/setter
  refs: TaggerRefs;
  onselect?: () => void;
};
```

- `doCommit`、`doTrash` 邏輯不變，將 `ctx.xxx` 替換為 `options.xxx`
- `navigate(delta)` 修改 cursor/selected 後呼叫 `options.onselect?.()` 觸發副作用
- `removeByNames` 改用共用工具函數（見 §4.8）
- `handleWindowKeydown`、`handleCommitClick`、`handleTrashClick`、`handleTagEnter` 保持不變

**`.svelte` 模板：**

目前 `TaggerPanel.svelte` 直接使用 `ctx.rating` 和 `ctx.tags` 綁定 `<Rating>` 和 `<Autocomplete>`：

```svelte
<!-- 舊 -->
<Rating bind:value={ctx.rating} />
<Autocomplete bind:tags={ctx.tags} />
```

遷移後使用 props：

```svelte
<!-- 新 -->
<Rating bind:value={rating} />
<Autocomplete bind:tags />
```

### 4.8 共用工具函數（可選提取）

Commit/trash 後的「移除項目 → 重新定位 cursor」模式在 `taggerPanel.svelte.ts`（`removeByNames`）和 `taggerSidebar.svelte.ts`（`refreshList` 後的重定位）中重複出現。可提取為純函數：

```ts
// tagger/helpers.ts
type ReselectState = {
  cursor: number;
  selected: Set<number>;
};

/** 根據異動後的列表長度，計算新的 cursor 與 selected */
export function reselectAfterRemoval(currentCursor: number, newListLength: number): ReselectState {
  if (newListLength === 0) {
    return { cursor: -1, selected: new Set() };
  }
  const next = Math.max(0, Math.min(currentCursor, newListLength - 1));
  return { cursor: next, selected: new Set([next]) };
}
```

兩個工廠均匯入此函數，拿到結果後寫入 options。onselect 和 scrolling 由已有機制自動處理。

---

## 五、`TaggerRefs` 型別定義

統一在路由目錄下定義非響應式引用的型別，取代原本 context class 的角色：

```ts
// tagger/types.ts
import type { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";

/** 非響應式的跨元件共享引用（§1.4） */
export type TaggerRefs = {
  zoomPan: ReturnType<typeof useZoomPan> | null;
};
```

---

## 六、遷移後的檔案結構

```
tagger/
├── +page.server.ts            （不變）
├── +page.svelte               （重構：共享 $state + refs + 子元件組裝）
├── types.ts                   （新增：TaggerRefs 型別）
├── helpers.ts                 （新增：reselectAfterRemoval 工具函數）
├── TaggerProgress.svelte      （重構：僅保留進度條 + 文字，純展示）
├── TaggerLoading.svelte       （新增：載入指示器，純展示）
├── (DELETED: taggerProgress.svelte.ts)
├── TaggerSidebar.svelte       （中改：接收 props、定義 renderItem snippet）
├── taggerSidebar.svelte.ts    （中改：接收 options、移除 ctx 依賴）
├── TaggerList.svelte          （大改：接收 props + snippet、不再直接渲染項目內容）
├── taggerList.svelte.ts       （大改：接收 options、新增 $effect 自動捲動）
├── TaggerPreview.svelte       （小改：接收 props）
├── taggerPreview.svelte.ts    （小改：接收 options、寫入 refs.zoomPan）
├── TaggerPanel.svelte         （中改：接收 props、移除 ctx 直接存取）
├── taggerPanel.svelte.ts      （中改：接收 options、使用共用工具函數）
└── (DELETED: context.svelte.ts)
```

---

## 七、建議遷移順序

遷移應以「由內而外、逐層驗證」的順序進行，確保每一步後頁面仍可正常運作：

| 步驟 | 操作 | 驗證點 |
|------|------|--------|
| 1 | 建立 `types.ts`（TaggerRefs）和 `helpers.ts`（reselectAfterRemoval） | 純新增，TypeScript 編譯通過即可 |
| 2 | 重寫 `+page.svelte`：宣告所有 `$state`、`refs`、`handleSelect`；暫時保留 context 設值（平行運作） | 頁面可載入 |
| 3 | 拆分 `TaggerProgress`：`<header>` 移入 `+page.svelte`，進度條重構為純展示 `TaggerProgress`，新增純展示 `TaggerLoading`，刪除 `taggerProgress.svelte.ts` | 頁面頂部（返回連結 + 進度列 + 載入指示器）正常顯示 |
| 4 | 遷移 `TaggerPreview`：改為 props-based，建立 zoomPan 寫入 refs | 圖片預覽 + 縮放拖曳正常 |
| 5 | 遷移 `TaggerList`：改為 options-based + renderItem snippet + $effect 自動捲動 | — |
| 6 | 遷移 `TaggerSidebar`：改為 props-based，提供 renderItem snippet | 虛擬列表 + 選取 + 重新整理 + 上傳正常 |
| 7 | 遷移 `TaggerPanel`：改為 options-based，使用 reselectAfterRemoval | 標籤/評等/提交/刪除/鍵盤快捷鍵正常 |
| 8 | 刪除 `context.svelte.ts`，移除 `+page.svelte` 中的暫時 context 設值 | 全功能驗證，grep 確認無殘留 `getTaggerContext` 引用 |
