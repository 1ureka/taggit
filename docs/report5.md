# Report 5：Tagger 路由遷移計畫

> 範圍：`src/routes/tagger/` 下所有檔案

---

## 一、現況結構

| 檔案 | 職責 | 使用 Context? |
|---|---|---|
| `+page.server.ts` | SSR：取得 staged 檔案列表，回傳 `{ stagedFiles }` | — |
| `+page.svelte` | 接收 data、建立 `TaggerContext`、初始化共享狀態、組裝子元件、viewport guard | `setTaggerContext` |
| `context.svelte.ts` | 定義 `TaggerContext` class（含 `$state`、常數、非響應式引用）+ `createContext` | 定義者 |
| `TaggerProgress.svelte` + `.ts` | 頂部進度列（已處理/總數百分比、loading 指示器） | `getTaggerContext` |
| `TaggerSidebar.svelte` + `.ts` | 左側側邊欄（標題、重新整理、上傳、嵌套 `TaggerList`） | `getTaggerContext` |
| `TaggerList.svelte` + `.ts` | 虛擬滾動列表（縮圖、單選/Ctrl/Shift 多選） | `getTaggerContext` |
| `TaggerPanel.svelte` + `.ts` | 右側操作面板（評等、標籤、提交、刪除、快捷鍵） | `getTaggerContext` |
| `TaggerPreview.svelte` + `.ts` | 中央圖片預覽（zoom-pan、拖曳、滾輪縮放） | `getTaggerContext` |

**元件嵌套關係**：

```
+page.svelte
├── TaggerProgress
├── TaggerSidebar
│   └── TaggerList          ← 二層深度
├── TaggerPreview
└── TaggerPanel
```

---

## 二、違規項目

### 2.1 ❌ 使用 `createContext`（規範 §1.2 — 嚴重違規）

> **規範**：不使用 Svelte 的 `createContext` API——狀態只有兩種歸屬：`+page.svelte` 的 `$state`，或無頭 UI 內部的 `$state`。

**現況**：`context.svelte.ts` 以 `createContext<TaggerContext>()` 匯出 `getTaggerContext` / `setTaggerContext`。`+page.svelte` 呼叫 `setTaggerContext(new TaggerContext())`，所有五個子元件（含嵌套的 TaggerList）透過 `getTaggerContext()` 隱式取得共享狀態。

**影響**：資料流完全不透明。從任何 `.svelte.ts` 都看不出資料來源和流向——六個檔案各自從 context 中讀寫任意欄位，沒有 props 宣告可供追溯。

### 2.2 ❌ `+page.svelte` 包含業務邏輯（規範 §1.2）

> **規範**：`+page.svelte` 不含業務邏輯。

**現況**：`+page.svelte` 中包含：

```ts
const proxy = {
  get list() { return data.stagedFiles; },
  set list(v: string[]) { data.stagedFiles = v; },
};

const ctx = setTaggerContext(new TaggerContext());
ctx.list = proxy.list;
ctx.total = proxy.list.length;

if (ctx.list.length > 0) {
  ctx.cursor = 0;
  ctx.selected = new Set([0]);
}
```

proxy 建立、Context 實例化、初始化賦值、首張圖片自動選取邏輯都是業務邏輯。`+page.svelte` 應只做 `$state` 初始化宣告（純表達式），不含命令式流程。

### 2.3 ❌ 子元件不接收任何 props（規範 §1.2 / §1.3）

> **規範**：SSR `data` 由 `+page.svelte` 接收後，透過 props 傳給子元件。

**現況**：所有子元件在 `+page.svelte` 中不接收任何 props：

```svelte
<TaggerProgress />
<TaggerSidebar />
<TaggerPreview />
<TaggerPanel />
```

且其 `.svelte` 檔案均無 `$props()` 宣告、無 `Props` 型別定義，完全違背「props 向下、bind 向上」的資料流模式。

### 2.4 ❌ 無頭 UI 從 Context 取資料，而非從 options 接收（規範 §1.3）

> **規範**：子元件把 `$props()` 解構出的值透過 getter-based options 傳給工廠函數。

**現況**：所有五個工廠函數都在內部呼叫 `getTaggerContext()` 取得資料：

```ts
// taggerList.svelte.ts
export function createTaggerList() {
  const ctx = getTaggerContext();
  // 全部透過 ctx.* 存取
}

// taggerPanel.svelte.ts
export function createTaggerPanel() {
  const ctx = getTaggerContext();
  // 全部透過 ctx.* 存取
}

// taggerPreview.svelte.ts / taggerProgress.svelte.ts / taggerSidebar.svelte.ts 同上
```

工廠函數應接收 `options` 物件，由 `.svelte` 將 props 以 getter/setter 傳入。

### 2.5 ❌ Context class 將響應式與非響應式引用混合（規範 §1.4）

> **規範**：非響應式共享引用（如 timer ID、AbortController）在 `+page.svelte` 建立普通物件，以 prop 傳下去。

**現況**：`TaggerContext` class 同時包含：

| 種類 | 欄位 |
|---|---|
| 常數 | `ITEM_H = 72` |
| 非響應式引用 | `zoomPan` |
| 響應式 `$state` | `listEl`, `list`, `total`, `cursor`, `selected`, `tags`, `rating`, `loading`, `imageLoading` |

依規範，這三類應分開歸屬：
- 常數 → 模組級常數（定義在使用它的 `.svelte.ts` 中）
- 非響應式引用 → `+page.svelte` 普通物件，prop 傳入
- 響應式 `$state` → `+page.svelte` 的 `$state`，或無頭 UI 內部的 `$state`

### 2.6 ⚠️ Context 使用非規範分隔符（規範 §2.6）

> **規範**：`// ---` 是唯一使用的分隔符，不使用 `// ===` 或 `// ───` 等其他變體。

**現況**：`context.svelte.ts` 使用 `// ─── 標題 ────` 風格的分隔符。

此檔案將被刪除，不需單獨修正，但值得記錄。

---

## 三、Context 中各狀態的實際消費者分析

### 3.1 響應式狀態

| 狀態 | 寫入者 | 讀取者 | 跨元件共享？ |
|---|---|---|---|
| `list` | `+page.svelte`（初始）、Sidebar（refresh/upload）、Panel（removeByNames） | List（虛擬捲動）、Progress（剩餘數）、Sidebar（長度）、Panel（filenames）、Preview（current file） | ✅ 多方讀寫 |
| `total` | `+page.svelte`（初始）、Sidebar（refresh 更新） | Progress（百分比） | ✅ Sidebar 寫、Progress 讀 |
| `cursor` | `+page.svelte`（初始）、List（select）、Panel（navigate/remove）、Sidebar（selectSingle） | List（active highlight）、Preview（current file）、Panel（guard） | ✅ 多方讀寫 |
| `selected` | `+page.svelte`（初始）、List（select）、Panel（navigate/remove）、Sidebar（selectSingle） | List（highlight）、Preview（count）、Panel（count/filenames）、Sidebar（count） | ✅ 多方讀寫 |
| `tags` | List（selectSingle 重置）、Panel（navigate 重置）、Sidebar（selectSingle 重置） | Panel（Autocomplete bind、commit 讀取） | ✅ 多方寫、Panel 讀 |
| `rating` | List（selectSingle 重置）、Panel（toggleRating/navigate 重置）、Sidebar（selectSingle 重置） | Panel（Rating bind、commit 讀取） | ✅ 多方寫、Panel 讀 |
| `loading` | Panel（commit/trash）、Sidebar（refresh/upload） | Progress（spinner）、Panel（button disabled）、Sidebar（button disabled）、Preview（img opacity） | ✅ 兩方寫、四方讀 |
| `imageLoading` | List（select 時設 true）、Panel（navigate/remove 設 true）、Preview（handleImageLoad 重置） | Progress（spinner）、Preview（img opacity） | ✅ 多方寫、兩方讀 |
| `listEl` | List（`bind:this`） | List（scroll/ResizeObserver）、Panel（scrollToActive）、Sidebar（scrollToActive） | ✅ List 寫、三方讀 |

### 3.2 非響應式引用

| 引用 | 建立者 | 消費者 | 跨元件共享？ |
|---|---|---|---|
| `zoomPan` | Preview（建立 `useZoomPan()` 實例） | List（`reset()`）、Panel（`reset()`）、Sidebar（`reset()`） | ✅ Preview 建、三方呼叫 |
| `ITEM_H` | 常數 `72` | List（虛擬捲動）、Panel（scrollToActive）、Sidebar（scrollToActive） | ✅ 三方讀 |

### 3.3 關鍵發現

1. **幾乎所有狀態都是跨元件共享的**——這是此路由與 editor detail 的最大差異。九個響應式狀態中僅 `listEl` 由單一元件寫入，其餘皆有多個寫入者。
2. **選取邏輯重複出現**：`selectSingle`（設定 cursor/selected、重置 tags/rating、scrollToActive、zoomPan.reset）出現在 `taggerList.svelte.ts`、`taggerSidebar.svelte.ts`、`taggerPanel.svelte.ts` 三處，邏輯高度雷同。這是 Context 模式的副作用——所有元件都能直接操作共享狀態，導致相同操作被各自重新實作。
3. **`TaggerList` 為二層子元件**——嵌套在 `TaggerSidebar` 內，需要 Sidebar 轉發 props。依規範「一到兩層深度」此深度合法，但 prop 轉發數量較多，需謹慎處理。

---

## 四、遷移計畫

### Step 0：重新定義 TaggerList 的職責邊界

`TaggerList` 嵌套在 `TaggerSidebar` 內部。在原始 Context 模式下，TaggerList 同時負責**虛擬滾動**與**選取邏輯**（selectSingle / selectCtrl / selectShift），後者需要寫入 `cursor`、`selected`、`tags`、`rating`、`imageLoading`，並呼叫 `scrollToActive`、`zoomPan.reset`。這導致若直接搬遷為 props 模式，Sidebar 需轉發 8 個 `$bindable` props + `refs` 給 List。

**核心觀察**：選取邏輯並非 TaggerList 的本質職責——它的核心是虛擬化渲染。若 TaggerList 改用 callback prop（`onitemclick`）將點擊事件回報給 Sidebar，選取邏輯即可收歸 Sidebar 的無頭 UI，TaggerList 不再需要寫入任何共享狀態（除了 `listEl` 的 `bind:this`）。

| 方案 | TaggerList props | TaggerList 職責 | 選取邏輯歸屬 |
|---|---|---|---|
| **直接搬遷** | 8 個 `$bindable` + `refs` | 虛擬滾動 + 選取邏輯 | List（重複於 Sidebar、Panel） |
| **Callback 模式** | 3 個唯讀 + 1 個 `$bindable` + 1 個 callback | 純虛擬滾動 | Sidebar（整合 List 原有的選取邏輯） |

**建議：Callback 模式。** 理由：

1. **大幅減少 prop 轉發**：TaggerList 的介面從 9 個屬性 + refs 精簡為 `list`（唯讀）、`cursor`（唯讀）、`selected`（唯讀）、`listEl`（bind）、`onitemclick`（callback）共 5 個，消除了 `tags`、`rating`、`imageLoading`、`refs` 的跨層傳遞。
2. **消除選取邏輯重複**：原本 `selectSingle` 出現在 List、Sidebar、Panel 三處。改為 callback 後，List 的選取邏輯整合進 Sidebar，僅剩 Sidebar 和 Panel 兩處（且 Panel 的是 navigate / removeByNames，操作語義不同）。
3. **職責聚焦**：TaggerList 只負責「給定一組資料，虛擬化渲染列表項目，回報點擊事件」，不關心點擊後的業務邏輯。

### Step 1：刪除 `context.svelte.ts`

整個檔案移除。所有 `getTaggerContext` / `setTaggerContext` / `TaggerContext` 引用將在後續步驟中替換。

### Step 2：修改 `+page.svelte` — 移除 Context，改用 `$state` + props

```svelte
<script lang="ts">
  import TooSmallOverlay from "$lib/components/TooSmallOverlay.svelte";
  import type { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";
  import type { PageData } from "./$types.js";

  import TaggerProgress from "./TaggerProgress.svelte";
  import TaggerSidebar from "./TaggerSidebar.svelte";
  import TaggerPreview from "./TaggerPreview.svelte";
  import TaggerPanel from "./TaggerPanel.svelte";

  let { data }: { data: PageData } = $props();

  // ── 跨元件共享狀態 ──

  /** Staged 檔案名稱列表 */
  let list = $state(data.stagedFiles);
  /** 初始檔案總數（含已處理） */
  let total = $state(data.stagedFiles.length);
  /** 目前游標位置 */
  let cursor = $state(data.stagedFiles.length > 0 ? 0 : -1);
  /** 已選取的索引集合 */
  let selected = $state<Set<number>>(
    data.stagedFiles.length > 0 ? new Set([0]) : new Set(),
  );
  /** 目前標籤列表 */
  let tags = $state<string[]>([]);
  /** 目前評等 */
  let rating = $state(0);
  /** 操作載入狀態 */
  let loading = $state(false);
  /** 圖片切換載入狀態 */
  let imageLoading = $state(false);
  /** 虛擬列表捲動容器 DOM 元素 */
  let listEl = $state<HTMLDivElement>();

  // ── 跨元件共享非響應式引用（§1.4）──

  const refs = {
    zoomPan: null as ReturnType<typeof useZoomPan> | null,
  };

  // ── Viewport guard ──

  let windowWidth = $state(900);
  let windowHeight = $state(600);
  const MIN_WIDTH = 860;
  const MIN_HEIGHT = 500;
  let tooSmall = $derived(windowWidth < MIN_WIDTH || windowHeight < MIN_HEIGHT);
</script>

<svelte:head>
  <title>Tagger — Image Manager</title>
</svelte:head>

<svelte:window bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} />

{#if tooSmall}
  <TooSmallOverlay
    minWidth={MIN_WIDTH}
    minHeight={MIN_HEIGHT}
    currentWidth={windowWidth}
    currentHeight={windowHeight}
    label="Tagger"
  />
{:else}
  <div class="page">
    <TaggerProgress {list} {total} {loading} {imageLoading} />
    <main class="tagger-main">
      <TaggerSidebar
        bind:list bind:total bind:cursor bind:selected
        bind:tags bind:rating bind:loading bind:imageLoading
        bind:listEl {refs}
      />
      <TaggerPreview
        {list} {cursor} {selected}
        {loading} bind:imageLoading
        {refs}
      />
      <TaggerPanel
        bind:list bind:cursor bind:selected
        bind:tags bind:rating bind:loading bind:imageLoading
        {listEl} {refs}
      />
    </main>
  </div>
{/if}

<!-- <style> 不變 -->
```

變更摘要：
- 移除 `context.svelte.ts` import、proxy 物件、`setTaggerContext` 呼叫
- 所有原 Context 中的響應式欄位改為頁面級 `$state`，初始值直接以表達式計算（消除命令式初始化邏輯）
- `zoomPan` 移至非響應式 `refs` 物件（§1.4）
- `ITEM_H` 不再出現在頁面層——由各 headless UI 自行定義模組常數
- 子元件透過 props / `bind` 接收所有資料
- 需要寫入的 props 使用 `bind:`，只讀的使用普通 props

### Step 3：修改 `TaggerProgress.svelte` + `taggerProgress.svelte.ts` — 改用 props

**`TaggerProgress.svelte`**：

```svelte
<script lang="ts">
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import CircularProgress from "$lib/components/CircularProgress.svelte";
  import { createTaggerProgress } from "./taggerProgress.svelte.js";

  type Props = {
    list: string[];
    total: number;
    loading: boolean;
    imageLoading: boolean;
  };
  let { list, total, loading, imageLoading }: Props = $props();

  const ui = createTaggerProgress({
    get list() { return list; },
    get total() { return total; },
    get loading() { return loading; },
    get imageLoading() { return imageLoading; },
  });
</script>

<!-- 模板不變 -->
```

**`taggerProgress.svelte.ts`**：

```ts
/**
 * 進度列組件的配置選項
 */
type TaggerProgressOptions = {
  /** 檔案名稱列表 */
  list: string[];
  /** 初始檔案總數 */
  total: number;
  /** 操作載入狀態 */
  loading: boolean;
  /** 圖片切換載入狀態 */
  imageLoading: boolean;
};

/**
 * 建立進度列邏輯的核心工廠函數
 */
export function createTaggerProgress(options: TaggerProgressOptions) {
  /** 已處理的圖片數量 */
  const processed = $derived(options.total - options.list.length);
  /** 進度百分比 */
  const progressPct = $derived(options.total > 0 ? Math.round((processed / options.total) * 100) : 0);
  /** 進度文字標籤 */
  const progressLabel = $derived(`${processed}/${options.total} (${options.list.length} 剩餘)`);

  // ---

  return {
    /** 存取已處理數量的 getter */
    get processed() { return processed; },
    /** 存取進度百分比的 getter */
    get progressPct() { return progressPct; },
    /** 存取進度文字標籤的 getter */
    get progressLabel() { return progressLabel; },
    /** 存取載入狀態的 getter */
    get loading() { return options.loading; },
    /** 存取圖片載入狀態的 getter */
    get imageLoading() { return options.imageLoading; },
  };
}
```

變更摘要：
- 移除 `getTaggerContext` import
- 新增 `TaggerProgressOptions` 型別
- 所有 `ctx.*` → `options.*`
- TaggerProgress 所有 props 皆為唯讀（不寫入任何共享狀態）

### Step 4：修改 `TaggerPreview.svelte` + `taggerPreview.svelte.ts` — 改用 props

**`TaggerPreview.svelte`**：

```svelte
<script lang="ts">
  import type { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";
  import { createTaggerPreview } from "./taggerPreview.svelte.js";

  type Props = {
    list: string[];
    cursor: number;
    selected: Set<number>;
    loading: boolean;
    imageLoading: boolean;
    refs: { zoomPan: ReturnType<typeof useZoomPan> | null };
  };
  let { list, cursor, selected, loading, imageLoading = $bindable(), refs }: Props = $props();

  const ui = createTaggerPreview({
    get list() { return list; },
    get cursor() { return cursor; },
    get selected() { return selected; },
    get loading() { return loading; },
    get imageLoading() { return imageLoading; },
    set imageLoading(v) { imageLoading = v; },
    refs,
  });
</script>

<!-- 模板不變 -->
```

**`taggerPreview.svelte.ts`**：

```ts
import { imgSrc } from "$lib/client/api.js";
import { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";

/**
 * 圖片預覽組件的配置選項
 */
type TaggerPreviewOptions = {
  /** 檔案名稱列表 */
  list: string[];
  /** 目前游標位置 */
  cursor: number;
  /** 已選取的索引集合 */
  selected: Set<number>;
  /** 操作載入狀態 */
  loading: boolean;
  /** 雙向綁定：圖片切換載入狀態 */
  imageLoading: boolean;
  /** 跨元件共享的非響應式引用 */
  refs: { zoomPan: ReturnType<typeof useZoomPan> | null };
};

/**
 * 建立圖片預覽邏輯的核心工廠函數
 */
export function createTaggerPreview(options: TaggerPreviewOptions) {
  /** zoom-pan 實例，同時註冊至 refs 供其他元件重置 */
  const zp = useZoomPan();
  options.refs.zoomPan = zp;

  /** 目前游標所指的檔案名稱 */
  const currentFile = $derived(
    options.cursor >= 0 && options.cursor < options.list.length
      ? options.list[options.cursor]
      : null,
  );
  /** 預覽圖片的 URL */
  const previewSrc = $derived(currentFile ? imgSrc("staged", currentFile) : "");
  /** 已選取的圖片數量 */
  const selectedCount = $derived(options.selected.size);

  // ---

  /** 處理容器滾輪事件，執行縮放 */
  function handleContainerWheel(e: WheelEvent) { zp.onWheel(e); }

  /** 處理容器滑鼠按下事件，開始拖曳 */
  function handleContainerMousedown(e: MouseEvent) { zp.onMousedown(e); }

  /** 處理容器雙擊事件，重置縮放 */
  function handleContainerDblclick() { zp.reset(); }

  // ---

  /** 處理 Window 滑鼠移動事件，更新拖曳位置 */
  function handleWindowMousemove(e: MouseEvent) { zp.onWindowMousemove(e); }

  /** 處理 Window 滑鼠放開事件，結束拖曳 */
  function handleWindowMouseup() { zp.onWindowMouseup(); }

  // ---

  /** 處理圖片載入完成事件，清除 imageLoading 狀態 */
  function handleImageLoad() { options.imageLoading = false; }

  // ---

  return {
    /** 存取目前檔案名稱的 getter */
    get currentFile() { return currentFile; },
    /** 存取預覽圖片 URL 的 getter */
    get previewSrc() { return previewSrc; },
    /** 存取已選取數量的 getter */
    get selectedCount() { return selectedCount; },
    /** 存取載入狀態的 getter */
    get loading() { return options.loading; },
    /** 存取圖片載入狀態的 getter */
    get imageLoading() { return options.imageLoading; },
    /** 存取 zoom-pan transform 的 getter */
    get transform() { return zp.transform; },
    /** 存取是否正在拖曳的 getter */
    get isDragging() { return zp.isDragging; },

    /** 處理容器滾輪事件，執行縮放 */
    handleContainerWheel,
    /** 處理容器滑鼠按下事件，開始拖曳 */
    handleContainerMousedown,
    /** 處理容器雙擊事件，重置縮放 */
    handleContainerDblclick,
    /** 處理 Window 滑鼠移動事件，更新拖曳位置 */
    handleWindowMousemove,
    /** 處理 Window 滑鼠放開事件，結束拖曳 */
    handleWindowMouseup,
    /** 處理圖片載入完成事件，清除 imageLoading 狀態 */
    handleImageLoad,
  };
}
```

變更摘要：
- 移除 `getTaggerContext` import
- `ctx.zoomPan = zp` → `options.refs.zoomPan = zp`（透過非響應式引用物件傳遞）
- `ctx.cursor` / `ctx.list` / `ctx.selected` → `options.*`（透過 getter 接收）
- `imageLoading` 需要寫入（handleImageLoad），故為 `$bindable` + getter/setter

### Step 5：修改 `TaggerSidebar.svelte` + `taggerSidebar.svelte.ts` — 改用 props，整合選取邏輯

**`TaggerSidebar.svelte`**：

```svelte
<script lang="ts">
  import { IconRefresh, IconUpload } from "@tabler/icons-svelte";
  import type { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";
  import { createTaggerSidebar } from "./taggerSidebar.svelte.js";
  import TaggerList from "./TaggerList.svelte";

  type Props = {
    list: string[];
    total: number;
    cursor: number;
    selected: Set<number>;
    tags: string[];
    rating: number;
    loading: boolean;
    imageLoading: boolean;
    listEl: HTMLDivElement | undefined;
    refs: { zoomPan: ReturnType<typeof useZoomPan> | null };
  };
  let {
    list = $bindable(),
    total = $bindable(),
    cursor = $bindable(),
    selected = $bindable(),
    tags = $bindable(),
    rating = $bindable(),
    loading = $bindable(),
    imageLoading = $bindable(),
    listEl = $bindable(),
    refs,
  }: Props = $props();

  const ui = createTaggerSidebar({
    get list() { return list; },
    set list(v) { list = v; },
    get total() { return total; },
    set total(v) { total = v; },
    get cursor() { return cursor; },
    set cursor(v) { cursor = v; },
    get selected() { return selected; },
    set selected(v) { selected = v; },
    get tags() { return tags; },
    set tags(v) { tags = v; },
    get rating() { return rating; },
    set rating(v) { rating = v; },
    get loading() { return loading; },
    set loading(v) { loading = v; },
    get imageLoading() { return imageLoading; },
    set imageLoading(v) { imageLoading = v; },
    get listEl() { return listEl; },
    refs,
  });
</script>

<aside class="tagger-sidebar">
  <div class="tagger-sidebar-header">
    <span class="tagger-sidebar-title">待審查</span>
    <span class="badge">{ui.selectedSize > 1 ? `${ui.selectedSize}/` : ""}{ui.listLength}</span>
    <button
      class="btn-refresh"
      class:spinning={ui.loading}
      title="重新掃描 staged 資料夾"
      onclick={ui.handleRefreshClick}
      disabled={ui.loading}
    >
      <IconRefresh size={14} />
    </button>
  </div>

  <TaggerList
    {list} {cursor} {selected}
    bind:listEl
    onitemclick={ui.handleListItemClick}
  />

  <div class="tagger-sidebar-footer">
    <input
      bind:this={ui.fileInputEl}
      type="file"
      accept="image/*"
      multiple
      class="visually-hidden"
      onchange={ui.handleUploadChange}
      tabindex={-1}
    />
    <button class="btn btn-sm tagger-upload-btn" onclick={ui.handleUploadClick} disabled={ui.loading}>
      <IconUpload size={14} />
      加入圖片
    </button>
  </div>
</aside>

<!-- <style> 不變 -->
```

**`taggerSidebar.svelte.ts`**：

```ts
import { api } from "$lib/client/api.js";
import { addToast, scrollToActive } from "$lib/client/dom.js";
import type { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";

/** 虛擬列表單項固定高度 */
const ITEM_H = 72;

/**
 * 側邊欄組件的配置選項
 */
type TaggerSidebarOptions = {
  /** 雙向綁定：Staged 檔案名稱列表 */
  list: string[];
  /** 雙向綁定：初始檔案總數 */
  total: number;
  /** 雙向綁定：目前游標位置 */
  cursor: number;
  /** 雙向綁定：已選取的索引集合 */
  selected: Set<number>;
  /** 雙向綁定：目前標籤列表 */
  tags: string[];
  /** 雙向綁定：目前評等 */
  rating: number;
  /** 雙向綁定：操作載入狀態 */
  loading: boolean;
  /** 雙向綁定：圖片切換載入狀態 */
  imageLoading: boolean;
  /** 虛擬列表捲動容器 DOM 元素（唯讀） */
  listEl: HTMLDivElement | undefined;
  /** 跨元件共享的非響應式引用 */
  refs: { zoomPan: ReturnType<typeof useZoomPan> | null };
};

/**
 * 建立側邊欄邏輯的核心工廠函數
 */
export function createTaggerSidebar(options: TaggerSidebarOptions) {
  /** 隱藏的檔案上傳 input 元素 */
  let fileInputEl = $state<HTMLInputElement>();

  /** Shift 多選的錨點索引 */
  let anchor = 0;

  // ---

  /** 以單選模式選取指定索引並重置編輯狀態 */
  function selectSingle(idx: number) {
    if (idx !== options.cursor) options.imageLoading = true;
    options.cursor = idx;
    options.selected = new Set([idx]);
    anchor = idx;
    options.tags = [];
    options.rating = 0;
    scrollToActive(options.listEl ?? null, idx, ITEM_H);
    options.refs.zoomPan?.reset();
  }

  /** 以 Ctrl 模式切換指定索引的選取狀態 */
  function selectCtrl(idx: number) {
    const next = new Set(options.selected);
    next.has(idx) && next.size > 1 ? next.delete(idx) : next.add(idx);
    if (idx !== options.cursor) options.imageLoading = true;
    options.cursor = idx;
    options.selected = next;
    anchor = idx;
    scrollToActive(options.listEl ?? null, idx, ITEM_H);
    options.refs.zoomPan?.reset();
  }

  /** 以 Shift 模式選取錨點到指定索引的範圍 */
  function selectShift(idx: number) {
    const lo = Math.min(anchor, idx);
    const hi = Math.max(anchor, idx);
    const next = new Set<number>();
    for (let i = lo; i <= hi; i++) next.add(i);
    if (idx !== options.cursor) options.imageLoading = true;
    options.cursor = idx;
    options.selected = next;
    scrollToActive(options.listEl ?? null, idx, ITEM_H);
    options.refs.zoomPan?.reset();
  }

  // ... refreshList / handleRefreshClick / handleUploadClick / handleUploadChange 同現有邏輯 ...
  // 所有 ctx.* → options.*

  // ---

  /** 處理列表項目點擊事件，根據修飾鍵執行對應的選取模式 */
  function handleListItemClick(e: MouseEvent, idx: number) {
    const mode = e.ctrlKey || e.metaKey ? "ctrl" : e.shiftKey ? "shift" : "single";
    if (mode === "single") selectSingle(idx);
    else if (mode === "ctrl") selectCtrl(idx);
    else selectShift(idx);
  }

  // ---

  return {
    /** 獲取檔案上傳 input 元素的 getter */
    get fileInputEl() { return fileInputEl as HTMLInputElement; },
    /** 設定檔案上傳 input 元素的 setter */
    set fileInputEl(el: HTMLInputElement) { fileInputEl = el; },

    /** 存取載入狀態的 getter */
    get loading() { return options.loading; },
    /** 存取檔案列表長度的 getter */
    get listLength() { return options.list.length; },
    /** 存取已選取數量的 getter */
    get selectedSize() { return options.selected.size; },

    /** 處理重新整理按鈕點擊事件，重新掃描 staged 資料夾 */
    handleRefreshClick,
    /** 處理上傳按鈕點擊事件，觸發檔案選擇對話框 */
    handleUploadClick,
    /** 處理檔案上傳 input change 事件，上傳選取的檔案 */
    handleUploadChange,
    /** 處理列表項目點擊事件，根據修飾鍵執行對應的選取模式 */
    handleListItemClick,
  };
}
```

變更摘要：
- 移除 `getTaggerContext` import
- 新增 `TaggerSidebarOptions` 型別，大部分為雙向綁定屬性
- `ctx.*` → `options.*`
- `ctx.ITEM_H` → 模組常數 `ITEM_H`
- `ctx.listEl` → `options.listEl`（唯讀，從 +page.svelte 的 `$state` 透過 Sidebar 轉發而來）
- `ctx.zoomPan` → `options.refs.zoomPan`
- **整合選取邏輯**：原本在 `taggerList.svelte.ts` 中的 `selectSingle` / `selectCtrl` / `selectShift` + `anchor` 狀態，全數移入 Sidebar 的無頭 UI，新增 `handleListItemClick` 作為 TaggerList 的 callback
- TaggerList 改為僅接收 `list`、`cursor`、`selected`（唯讀）+ `listEl`（bind）+ `onitemclick`（callback）

### Step 6：修改 `TaggerList.svelte` + `taggerList.svelte.ts` — Callback 模式，聚焦虛擬化

**`TaggerList.svelte`**：

```svelte
<script lang="ts">
  import { imgSrc } from "$lib/client/api.js";
  import { createTaggerList } from "./taggerList.svelte.js";

  type Props = {
    list: string[];
    cursor: number;
    selected: Set<number>;
    listEl: HTMLDivElement | undefined;
    onitemclick: (e: MouseEvent, idx: number) => void;
  };
  let {
    list,
    cursor,
    selected,
    listEl = $bindable(),
    onitemclick,
  }: Props = $props();

  const ui = createTaggerList({
    get list() { return list; },
    get listEl() { return listEl; },
    set listEl(v) { listEl = v; },
    onitemclick,
  });
</script>

<div class="tagger-sidebar-list" bind:this={listEl} onscroll={ui.handleListScroll}>
  {#if list.length === 0}
    <div class="tagger-empty">沒有待審查的圖片</div>
  {:else}
    <div class="virtual-scroll-content" style="height:{ui.totalH}px">
      {#each ui.visible as item (item.filename)}
        <button
          type="button"
          class="tagger-thumb"
          class:active={item.index === cursor}
          class:selected={selected.has(item.index)}
          style="top:{item.index * ui.ITEM_H}px"
          onclick={(e) => ui.handleItemClick(e, item.index)}
        >
          <img
            class="tagger-thumb-img"
            src={imgSrc("staged", item.filename, "sm")}
            alt={item.filename}
            loading="lazy"
          />
          <span class="tagger-thumb-name">{item.filename}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<!-- <style> 不變 -->
```

模板變更：`cursor`、`selected` 改為唯讀 props（不再 `$bindable`）；`tags`、`rating`、`imageLoading`、`refs` 全數移除；`onitemclick` callback 新增。

**`taggerList.svelte.ts`**：

```ts
/** 虛擬列表單項固定高度 */
const ITEM_H = 72;

/**
 * 虛擬列表組件的配置選項
 */
type TaggerListOptions = {
  /** 檔案名稱列表 */
  list: string[];
  /** 虛擬列表捲動容器 DOM 元素 */
  listEl: HTMLDivElement | undefined;
  /** 項目點擊回調（由父元件處理選取邏輯） */
  onitemclick: (e: MouseEvent, idx: number) => void;
};

/**
 * 建立虛擬列表邏輯的核心工廠函數
 */
export function createTaggerList(options: TaggerListOptions) {
  /** 虛擬列表渲染緩衝區大小 */
  const BUFFER = 5;

  /** 捲動容器目前的 scrollTop */
  let scrollTop = $state(0);
  /** 捲動容器可見高度 */
  let viewH = $state(400);

  /** 虛擬列表內容總高度 */
  const totalH = $derived(options.list.length * ITEM_H);
  /** 可見範圍的起始索引（含緩衝區） */
  const startIdx = $derived(Math.max(0, Math.floor(scrollTop / ITEM_H) - BUFFER));
  /** 可見範圍的結束索引（含緩衝區） */
  const endIdx = $derived(Math.min(options.list.length, Math.ceil((scrollTop + viewH) / ITEM_H) + BUFFER));
  /** 可見的項目列表 */
  const visible = $derived(
    options.list.slice(startIdx, endIdx).map((filename, i) => ({
      filename,
      index: startIdx + i,
    })),
  );

  // ---

  /** 透過 ResizeObserver 追蹤列表容器高度 */
  $effect(() => {
    if (!options.listEl) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) viewH = e.contentRect.height;
    });
    ro.observe(options.listEl);
    return () => ro.disconnect();
  });

  // ---

  /** 處理列表項目點擊事件，委派給父元件的回調 */
  function handleItemClick(e: MouseEvent, idx: number) {
    options.onitemclick(e, idx);
  }

  /** 處理列表捲動事件，同步 scrollTop 狀態 */
  function handleListScroll() {
    const el = options.listEl;
    if (el) scrollTop = el.scrollTop;
  }

  // ---

  return {
    /** 虛擬列表單項固定高度常數 */
    ITEM_H,
    /** 存取虛擬列表內容總高度的 getter */
    get totalH() { return totalH; },
    /** 存取可見項目列表的 getter */
    get visible() { return visible; },

    /** 處理列表項目點擊事件，委派給父元件的回調 */
    handleItemClick,
    /** 處理列表捲動事件，同步 scrollTop 狀態 */
    handleListScroll,
  };
}
```

變更摘要：
- 移除 `getTaggerContext` import 與所有選取邏輯（`selectSingle` / `selectCtrl` / `selectShift` / `anchor`）
- `TaggerListOptions` 精簡為 3 個屬性：`list`（唯讀）、`listEl`（DOM 引用）、`onitemclick`（callback）
- `handleItemClick` 僅單純委派 `options.onitemclick(e, idx)`，不含任何業務判斷
- 虛擬滾動邏輯（scrollTop、viewH、totalH、startIdx/endIdx、visible、ResizeObserver）不變

### Step 7：修改 `TaggerPanel.svelte` + `taggerPanel.svelte.ts` — 改用 props

**`TaggerPanel.svelte`**：

```svelte
<script lang="ts">
  import { IconCheck, IconTrash } from "@tabler/icons-svelte";
  import Rating from "$lib/components/Rating.svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  import type { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";
  import { createTaggerPanel } from "./taggerPanel.svelte.js";

  type Props = {
    list: string[];
    cursor: number;
    selected: Set<number>;
    tags: string[];
    rating: number;
    loading: boolean;
    imageLoading: boolean;
    listEl: HTMLDivElement | undefined;
    refs: { zoomPan: ReturnType<typeof useZoomPan> | null };
  };
  let {
    list = $bindable(),
    cursor = $bindable(),
    selected = $bindable(),
    tags = $bindable(),
    rating = $bindable(),
    loading = $bindable(),
    imageLoading = $bindable(),
    listEl,
    refs,
  }: Props = $props();

  const ui = createTaggerPanel({
    get list() { return list; },
    set list(v) { list = v; },
    get cursor() { return cursor; },
    set cursor(v) { cursor = v; },
    get selected() { return selected; },
    set selected(v) { selected = v; },
    get tags() { return tags; },
    set tags(v) { tags = v; },
    get rating() { return rating; },
    set rating(v) { rating = v; },
    get loading() { return loading; },
    set loading(v) { loading = v; },
    get imageLoading() { return imageLoading; },
    set imageLoading(v) { imageLoading = v; },
    get listEl() { return listEl; },
    refs,
  });
</script>

<svelte:window onkeydown={ui.handleWindowKeydown} />

<aside class="tagger-panel">
  <div class="tagger-rating">
    <Rating bind:value={rating} size="1.5rem" />
  </div>
  <div class="separator"></div>

  <div class="tagger-tags" bind:this={ui.tagInputWrapEl}>
    <Autocomplete bind:tags={tags} variant="top" placeholder="輸入標籤..." onenter={ui.handleTagEnter} />
  </div>

  <div class="separator"></div>

  <div class="tagger-actions">
    <button class="btn btn-primary btn-sm" onclick={ui.handleCommitClick} disabled={ui.loading}>
      <IconCheck size={16} />
      {ui.selectedCount > 1 ? `提交 ${ui.selectedCount} 張` : "提交"}
    </button>
    <button class="btn btn-destructive btn-sm" onclick={ui.handleTrashClick} disabled={ui.loading}>
      <IconTrash size={16} />
      {ui.selectedCount > 1 ? `刪除 ${ui.selectedCount} 張` : "刪除"}
    </button>
  </div>

  <!-- 快捷鍵區不變 -->
</aside>

<!-- <style> 不變 -->
```

模板變更：`ctx.rating` → `rating`（props）、`ctx.tags` → `tags`（props）。

**`taggerPanel.svelte.ts`**：

```ts
import { batchRun } from "$lib/utils.js";
import { api } from "$lib/client/api.js";
import { addToast, isInEditable, scrollToActive, requestConfirm } from "$lib/client/dom.js";
import { tagCache } from "$lib/client/cache.js";
import type { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";

/** 虛擬列表單項固定高度 */
const ITEM_H = 72;

/**
 * 標籤面板組件的配置選項
 */
type TaggerPanelOptions = {
  /** 雙向綁定：Staged 檔案名稱列表 */
  list: string[];
  /** 雙向綁定：目前游標位置 */
  cursor: number;
  /** 雙向綁定：已選取的索引集合 */
  selected: Set<number>;
  /** 雙向綁定：目前標籤列表 */
  tags: string[];
  /** 雙向綁定：目前評等 */
  rating: number;
  /** 雙向綁定：操作載入狀態 */
  loading: boolean;
  /** 雙向綁定：圖片切換載入狀態 */
  imageLoading: boolean;
  /** 虛擬列表捲動容器 DOM 元素（唯讀） */
  listEl: HTMLDivElement | undefined;
  /** 跨元件共享的非響應式引用 */
  refs: { zoomPan: ReturnType<typeof useZoomPan> | null };
};

/**
 * 建立標籤面板邏輯的核心工廠函數
 */
export function createTaggerPanel(options: TaggerPanelOptions) {
  /** 標籤輸入區塊的包裝元素 */
  let tagInputWrapEl = $state<HTMLDivElement>();

  /** 已選取的圖片數量 */
  const selectedCount = $derived(options.selected.size);

  // ---

  // selectedFilenames / removeByNames / navigate / toggleRating / focusTagInput
  // doCommit / doTrash 同現有邏輯，所有 ctx.* → options.*
  // ctx.listEl → options.listEl
  // ctx.ITEM_H → ITEM_H
  // ctx.zoomPan → options.refs.zoomPan

  // ---

  // handleWindowKeydown / handleCommitClick / handleTrashClick / handleTagEnter 同現有

  // ---

  return {
    /** 存取標籤輸入區塊包裝元素的 getter */
    get tagInputWrapEl() { return tagInputWrapEl as HTMLDivElement; },
    /** 設定標籤輸入區塊包裝元素的 setter */
    set tagInputWrapEl(el: HTMLDivElement) { tagInputWrapEl = el; },

    /** 存取已選取數量的 getter */
    get selectedCount() { return selectedCount; },
    /** 存取載入狀態的 getter */
    get loading() { return options.loading; },

    /** 處理 Window 鍵盤事件，執行導航、評等、聚焦、提交或刪除操作 */
    handleWindowKeydown,
    /** 處理提交按鈕點擊事件，提交已選取的圖片 */
    handleCommitClick,
    /** 處理刪除按鈕點擊事件，將已選取的圖片移至垃圾桶 */
    handleTrashClick,
    /** 處理標籤 Enter 事件，執行提交 */
    handleTagEnter,
  };
}
```

變更摘要：
- 移除 `getTaggerContext` import
- 新增 `TaggerPanelOptions` 型別
- `ctx.*` → `options.*`
- `ctx.ITEM_H` → 模組常數 `ITEM_H`
- `ctx.listEl` → `options.listEl`（唯讀 prop，用於 scrollToActive）
- `ctx.zoomPan` → `options.refs.zoomPan`

---

## 五、遷移後的資料流

```
+page.server.ts
  ↓ data: { stagedFiles }
+page.svelte
  ├── $state: list, total, cursor, selected, tags, rating, loading, imageLoading, listEl
  ├── refs: { zoomPan } (非響應式)
  │
  ├── TaggerProgress     ← props: list, total, loading, imageLoading （全唯讀）
  ├── TaggerSidebar      ← bind: list, total, cursor, selected, tags, rating,
  │   │                          loading, imageLoading, listEl / props: refs
  │   └── TaggerList     ← props: list, cursor, selected, onitemclick
  │                         bind: listEl
  ├── TaggerPreview      ← props: list, cursor, selected, loading, refs
  │                         bind: imageLoading
  └── TaggerPanel        ← bind: list, cursor, selected, tags, rating, loading, imageLoading
                            props: listEl, refs
```

**資料流模式**：
- 所有共享狀態由 `+page.svelte` 持有 `$state`
- 需要寫入的 props 透過 `$bindable` + `bind:` 雙向綁定
- 只讀消費者透過單向 props 接收
- `zoomPan` 透過非響應式 `refs` 物件共享（§1.4 模式）——Preview 建立實例並寫入 `refs.zoomPan`，其他元件呼叫 `refs.zoomPan?.reset()`
- `listEl` 為響應式 `$state`（ResizeObserver `$effect` 需要追蹤），通過 `$bindable` 鏈從 `+page.svelte` → Sidebar → List（`bind:this`）
- **TaggerList 使用 callback 模式**：不接收 `tags`、`rating`、`imageLoading`、`refs` 等選取相關狀態，僅回報 `onitemclick(e, idx)`，由 Sidebar 的無頭 UI 解析修飾鍵並執行選取操作

---

## 六、遷移後檔案清單

| 檔案 | 動作 |
|---|---|
| `context.svelte.ts` | **刪除** |
| `+page.server.ts` | **不變** |
| `+page.svelte` | 修改（移除 Context/proxy，宣告 `$state` + `refs`，改用 props/bind） |
| `TaggerProgress.svelte` | 修改（新增 Props） |
| `taggerProgress.svelte.ts` | 修改（新增 options，移除 Context） |
| `TaggerSidebar.svelte` | 修改（新增 Props，轉發 props 給 TaggerList） |
| `taggerSidebar.svelte.ts` | 修改（新增 options，移除 Context，ITEM_H 改為模組常數） |
| `TaggerList.svelte` | 修改（新增 Props，模板改用 props） |
| `taggerList.svelte.ts` | 修改（新增 options，移除 Context，ITEM_H 改為模組常數） |
| `TaggerPanel.svelte` | 修改（新增 Props，模板改用 props） |
| `taggerPanel.svelte.ts` | 修改（新增 options，移除 Context，ITEM_H 改為模組常數） |
| `TaggerPreview.svelte` | 修改（新增 Props） |
| `taggerPreview.svelte.ts` | 修改（新增 options，移除 Context，refs 模式寫入 zoomPan） |

---

## 七、風險與注意事項

1. **Options 物件大小**：`TaggerSidebarOptions` 和 `TaggerPanelOptions` 各有約 10 個屬性（因承擔核心的選取/操作邏輯）。`TaggerListOptions` 透過 callback 模式精簡為 3 個屬性，`TaggerProgressOptions` 和 `TaggerPreviewOptions` 各約 5–6 個屬性。整體而言，Sidebar 和 Panel 的 options 仍較冗長，但 JSDoc 標註（如 `/** 雙向綁定：... */`）可提升可讀性。

2. **`listEl` 的 `$bindable` 鏈**：`listEl` 從 `+page.svelte` 經 Sidebar 轉發至 List 的 `bind:this`，形成三層 `$bindable` 鏈。這在 Svelte 5 中是合法的，但需注意 `bind:this` 的設定時機——List 元件掛載時才會寫入 `listEl`，在此之前其值為 `undefined`。所有使用 `listEl` 的地方（List 內部的 ResizeObserver `$effect`、Sidebar 和 Panel 的 scrollToActive 呼叫）已有 null check 保護。注意 TaggerList 的無頭 UI 現在僅透過 `options.listEl` getter/setter 讀寫（用於 ResizeObserver 和 scrollTop 讀取），TaggerList 的模板則直接 `bind:this={listEl}` 綁定。

3. **`zoomPan` 的初始化時序**：Preview 的工廠函數在建立時執行 `options.refs.zoomPan = zp`。由於 refs 是同步傳入的普通物件，此賦值在 Preview 元件初始化時立即生效。其他元件透過 `refs.zoomPan?.reset()` 存取時，只要 Preview 已掛載即可安全使用。因元件掛載順序由 `+page.svelte` 的模板順序決定（Sidebar → Preview → Panel），而 `zoomPan?.reset()` 僅在使用者操作時呼叫（非初始化），時序不存在問題。

4. **選取邏輯整合但未完全消除重複**：透過 callback 模式，TaggerList 不再包含選取邏輯，原本三處重複減為兩處——Sidebar（click/refresh/upload 選取）和 Panel（navigate/removeByNames 選取）。兩者的操作語義不同（Sidebar 處理使用者的主動點擊選取，Panel 處理鍵盤導航與批量操作後的游標重定位），因此不宜強行合併。若未來仍覺重複過多，可考慮提取共用的 selection utility 函式。

5. **`ITEM_H` 常數重複定義**：`ITEM_H = 72` 將在 `taggerList.svelte.ts`、`taggerSidebar.svelte.ts`、`taggerPanel.svelte.ts` 三個檔案各自定義一次。其中 List 用於虛擬滾動計算與模板渲染，Sidebar 與 Panel 用於 `scrollToActive`。因為此值是簡單的數值常數、有明確的語義、且僅用於 tagger 路由，少量重複是可接受的。替代方案是匯出自共用模組，但會增加額外檔案。

6. **與 editor detail 遷移的差異**：Editor detail 路由（report4）僅有 2 個跨元件共享狀態（`image`、`loading`），遷移相對簡單。Tagger 路由有 9 個響應式 `$state` + 1 個非響應式 `refs`，且 4 個子元件（加上嵌套的 TaggerList 共 5 個）都需要讀寫大部分狀態。這是目前專案中 Context 使用最深入的路由，遷移幅度最大。

7. **向後相容**：此遷移全部是內部重構，不改變 URL、API 或使用者可見行為。
