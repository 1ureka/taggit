# Tagger 路由遷移計畫 v2.2

> 基於 `docs/frontend.md` 規範的 tagger 路由完整遷移方案。取代 report2.md，核心簡化：
>
> - cursor 改為存**檔名**（非索引），URL 無需驗證
> - 找不到 cursor 檔案時，一律選第一張——不追蹤「附近的圖片」
> - 移除 reconciliation `$effect` 與 server-side cursor 驗證

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

### 1.2 規範違規摘要

| # | 違規內容 | 對應規範 |
|---|---------|---------|
| 1 | 使用 `createContext` / `getTaggerContext` 作為跨元件共享機制 | §1.2 「不使用 Context」 |
| 2 | 共享 `$state` 宣告在 `TaggerContext` class 中 | §1.2 「狀態只有兩種歸屬」 |
| 3 | `.svelte` 中混用 `ctx.*` 與 `ui.*` | §2.3 「模板只需使用 `ui.*`」 |
| 4 | 工廠函數內部呼叫 `getTaggerContext()` 而非透過 `options` 注入 | §1.3 / §2.2 「接收 options 物件」 |
| 5 | 元件之間無 props 傳遞——全走 context | §1.2 「SSR data 透過 props 傳給子元件」 |
| 6 | `selectSingle` 在三個工廠中重複實現 | DRY |

---

## 二、遷移核心策略

### 2.1 刪除 Context，狀態歸位

移除 `context.svelte.ts`。狀態按性質分流：

| 狀態 | 歸屬 | 理由 |
|------|------|------|
| `cursor`（檔名）、`total` | URL `searchParams` | 跨導航持久化（§1.1） |
| `selected`、`tags`、`rating`、`loading`、`imageLoading` | `+page.svelte` 的 `$state` | 純 UI 暫態 |
| `listEl` | TaggerList 工廠內部 | 只有虛擬列表自身需要 |
| `zoomPan` | TaggerPreview 工廠內部 | 只有圖片預覽自身需要 |

### 2.2 cursor 改為存檔名

**核心觀察：** 當 commit/trash/refresh 導致已選取圖片消失時，「選附近的圖片」並不重要——直接選第一張即可。真正重要的是**如果該圖片還在，就繼續指向它**。

用**檔名**作為 cursor 天然滿足這個需求：

- 圖片還在 → `list.indexOf(cursor)` 找到 → 繼續指向
- 圖片消失 → `indexOf` 回傳 -1 → fallback 至第一張

**URL 形式：** `?cursor=photo001.jpg&total=50`

**衍生簡化：**

1. **URL 無需驗證**——server 不認識也不關心 cursor 值，不需要 redirect。無效檔名（手動改 URL、圖片被刪）在渲染端自然 fallback。
2. **不需要 reconciliation `$effect`**——`invalidateAll()` 更新 `data.stagedFiles` 後，各元件重新 `indexOf(cursor)` 即可。找到就定位，找不到就第一張。零膠水代碼。
3. **上一張/下一張邏輯簡化**——找到 cursor 的 index 後 ±1；找不到時視為 index 0（然後 ±1）。

### 2.3 `total` 以 URL 參數持久化

`invalidateAll()` 每次只回傳「當前剩餘」的 `stagedFiles`，無法得知 session 初始總數。

- `+page.server.ts` 首次載入時計算 `stagedFiles.length`，若 URL 無 `total` 則 redirect 到 `?cursor=<first>&total=N`
- 後續 `invalidateAll()` 不改變 URL，`total` 值持久存在
- Refresh 發現新檔案時，以 `replaceState` 更新 `total`

### 2.4 移除自動表單重置，改為手動 Reset 按鈕

**動機：**

- **UX：** 批次標記相似圖片時，切換一張就清空表單效率極低。保留上一張的 tags/rating 讓使用者決定沿用或重置，更符合批次操作工作流。
- **架構：** 自動重置需要 `onselect` 回調穿透元件樹。移除後所有元件都少了一個 prop/callback。

**新行為：**

- `tags`/`rating` 不隨 cursor 變更而重置。TaggerPanel 新增 Reset 按鈕，工廠函數直接 `options.tags = []; options.rating = 0`。
- `zoomPan.reset()` 改由 TaggerPreview 內部自動處理——當顯示的檔案改變時 `$effect` 自動重置。

### 2.5 `invalidateAll()` + `load` 取代手動狀態突變

現行的 commit / trash / refresh / upload 手動突變 `ctx.list`、`ctx.cursor`、`ctx.selected`、`ctx.total`。

遷移後統一改為 **`api.xxx() → invalidateAll()`**：

- `removeByNames`、`refreshList`、`reselectAfterRemoval` 全部消除
- Sidebar 子元件不需要 bind `list`
- cursor 是檔名——`invalidateAll()` 後 list 更新，各元件自行 `indexOf(cursor)` 重新定位

### 2.6 消除共享引用——`zoomPan` 與 `listEl` 內化

移除自動表單重置後，不再有跨元件呼叫 `zoomPan.reset()` 或存取 `listEl` 的需求：

| 引用 | 歸屬 | 說明 |
|------|------|------|
| `zoomPan` | TaggerPreview 內部 | cursor 檔名變更 → `$effect` 自動 `reset()` |
| `listEl` | TaggerList 工廠內部 | cursor index 變更 → `$effect` 自動 `scrollToActive` |

Report1/Report2 中的 `TaggerRefs` 型別完全消除。

### 2.7 §1.5 機制/策略分離——TaggerList

| 分類 | 內容 |
|------|------|
| **機制** | `itemCount`、`itemHeight`、可見範圍計算、多選語意（single/ctrl/shift）、捲動同步 |
| **策略** | 每一項的渲染內容（`renderItem` snippet） |

`TaggerList` 接受 `renderItem` snippet，不再需要 `list`（檔名陣列）和 `imgSrc`。

### 2.8 消除重複的「選取並捲動」邏輯

- TaggerList 的 `$effect` 監聽 cursorIndex 變化 → 自動 `scrollToActive`
- TaggerPanel 的 `navigate` 只需 `replaceState` 更新 cursor 檔名 + 更新 selected——捲動由 TaggerList 自行響應
- `selectSingle` 的三處重複全部消除

### 2.9 cursor index 的解析模式

由於 cursor 存的是檔名，所有需要 index 的地方都用同一個 pattern：

```ts
// 統一解析：找不到就 fallback 至 0
const cursorIndex = $derived((() => {
  const idx = list.indexOf(cursor);
  return idx >= 0 ? idx : 0;
})());
```

此 `$derived` 在各元件的 `.svelte`（唯讀場景）或工廠 options 的 getter（讀寫場景）中定義。`list` 為空時 `indexOf` 回傳 -1，fallback 至 0——渲染端以 `list.length > 0` guard 控制，不會讀取 `list[0]`。

---

## 三、新架構設計

### 3.1 `+page.svelte`

```svelte
<script lang="ts">
  import { page } from "$app/stores";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();

  // ─── URL 狀態（§1.1 就近讀取）──────────────────
  // +page.svelte 不讀取 cursor/total——子元件各自從 URL 讀取
  // 此處無需 reconciliation $effect

  // ─── 共享 $state ─────────────────────────────
  let selected = $state<Set<number>>(new Set([0]));
  let tags = $state<string[]>([]);
  let rating = $state(0);
  let loading = $state(false);
  let imageLoading = $state(false);

  // ─── Viewport guard ──────────────────────────
  let windowWidth = $state(900);
  let windowHeight = $state(600);
  const MIN_WIDTH = 860;
  const MIN_HEIGHT = 500;
  let tooSmall = $derived(windowWidth < MIN_WIDTH || windowHeight < MIN_HEIGHT);
</script>
```

> **極簡化的 `+page.svelte`：** 不讀取 `cursor`/`total`（URL 狀態由各子元件就近獲取）。不含任何 `$effect`。不含任何業務邏輯。純粹宣告 `$state` + 組裝子元件。
>
> **`selected` 初始值：** `new Set([0])` 配合 cursor fallback 至第一張的語意。若 `data.stagedFiles` 為空，渲染端以 guard 控制不顯示選取相關 UI。

### 3.2 URL 工具函數

```ts
// tagger/url.ts

/** 組裝 tagger URL，保留未指定的現有參數 */
export function buildTaggerUrl(
  params: { cursor?: string; total?: number },
  current: URLSearchParams,
): string {
  const next = new URLSearchParams(current);
  if (params.cursor !== undefined) next.set("cursor", params.cursor);
  if (params.total !== undefined) next.set("total", String(params.total));
  return `/tagger?${next.toString()}`;
}

/** 從 list 中解析 cursor 的 index，找不到則 fallback 至 0 */
export function resolveCursorIndex(list: string[], cursor: string): number {
  const idx = list.indexOf(cursor);
  return idx >= 0 ? idx : 0;
}
```

`buildTaggerUrl` 的 `cursor` 參數改為 `string`（檔名）。新增 `resolveCursorIndex` 統一解析邏輯，避免各元件重複 inline。

### 3.3 元件樹與 Props 流

```
+page.svelte
│
├─ <header>
│    ├─ <a href="/">返回首頁</a>
│    ├─ TaggerProgress                         ← 純展示，無 .svelte.ts
│    │    (URL) total
│    │    props: listLength
│    └─ TaggerLoading                          ← 純展示，無 .svelte.ts
│         props: loading, imageLoading
│
├─ <aside>
│    ├─ TaggerSidebarHeader
│    │    props: listLength, selectedSize, loading↕
│    ├─ TaggerList
│    │    (URL) cursor → 自行讀取/寫入
│    │    props: list, itemHeight,
│    │           selected↕, imageLoading↕
│    │    snippet: renderItem(index)
│    └─ TaggerSidebarFooter
│         props: loading↕
│
├─ TaggerPreview
│    (URL) cursor
│    props: list, selectedCount,
│           loading, imageLoading↕
│
└─ TaggerPanel
     (URL) cursor → 自行讀取/寫入
     props: tags↕, rating↕, selected↕, list,
            loading↕, imageLoading↕
```

> `↕` = `$bindable`。未標記 = 唯讀。`(URL)` = 自行從 `$page.url.searchParams` 讀取。
>
> **cursor 不出現在任何 props 中。** 各元件就近從 URL 讀取檔名，以 `resolveCursorIndex` 轉為 index。

### 3.4 各元件 §1.5 分析

#### TaggerProgress

| 分類 | 資料來源 |
|------|---------|
| 機制 | `total`（URL）、`listLength`（prop） |
| 策略 | （無） |

純展示，無 `.svelte.ts`。

#### TaggerLoading

| 分類 | Props |
|------|-------|
| 機制 | `loading`、`imageLoading` |
| 策略 | （無） |

純展示，無 `.svelte.ts`。

#### TaggerSidebarHeader

| 分類 | Props |
|------|-------|
| 機制 | `listLength`、`selectedSize`、`loading`↕ |
| 策略 | （無）——refresh → `invalidateAll` |

#### TaggerSidebarFooter

| 分類 | Props |
|------|-------|
| 機制 | `loading`↕ |
| 策略 | （無）——upload → `invalidateAll` |

#### TaggerList

| 分類 | 資料來源 |
|------|---------|
| 機制 | `cursor`（URL↕）、`list`（prop）、`selected`（prop↕）、`itemHeight`（prop）、`imageLoading`（prop↕） |
| 策略 | `renderItem` snippet |

#### TaggerPreview

| 分類 | 資料來源 |
|------|---------|
| 機制 | `cursor`（URL）、`list`（prop）、zoom-pan（內部）、`imageLoading`（prop↕） |
| 策略 | （無） |

#### TaggerPanel

| 分類 | 資料來源 |
|------|---------|
| 機制 | `tags`（prop↕）、`rating`（prop↕）、編輯 UI、action 按鈕、快捷鍵 |
| 策略 | `cursor`（URL↕）、`selected`（prop↕）、`list`（prop）——commit/trash → `invalidateAll`、navigate → `replaceState` |

---

## 四、各元件遷移細節

### 4.1 刪除 `context.svelte.ts`

直接刪除。所有 `getTaggerContext` / `setTaggerContext` import 一併移除。`ITEM_H` 常數移入 TaggerList 工廠。

### 4.2 新增 `url.ts`

如 §3.2 所述。`buildTaggerUrl` + `resolveCursorIndex` 兩個純函數。

### 4.3 `+page.server.ts`

**變更幅度：小**——僅新增首次訪問 redirect。

```ts
export const load: PageServerLoad = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const stagedFiles = getStagedFiles(loaded.paths);

  // 首次訪問（URL 無 total）：設定初始 cursor（檔名）與 total
  if (!url.searchParams.has("total")) {
    const cursor = stagedFiles.length > 0 ? stagedFiles[0] : "";
    redirect(303, `/tagger?cursor=${encodeURIComponent(cursor)}&total=${stagedFiles.length}`);
  }

  // 不驗證 cursor——無效檔名在渲染端自然 fallback 至第一張
  return { stagedFiles };
};
```

### 4.4 `+page.svelte`

| 項目 | 舊 | 新 |
|------|-----|-----|
| 共享狀態 | `setTaggerContext(new TaggerContext())` | `$state` + URL params |
| cursor | context `$state`（索引） | URL `searchParams`（檔名） |
| cursor 驗證 | 無 | 不需要——invalid 自然 fallback |
| total | context `$state` | URL `searchParams` |
| reconciliation | 無 | 不需要——`indexOf` 自動處理 |
| 自動重置 | 隱式（各處寫 ctx） | 移除；TaggerPanel 內部 Reset 按鈕 |
| shared refs | `ctx.zoomPan`、`ctx.listEl` | 消除（各自內化） |
| 子元件傳值 | 無 props（全走 context） | 完整 props + bind + URL |

子元件組裝：

```svelte
<header class="page-header">
  <a href="/" class="btn btn-ghost btn-sm">
    <IconArrowLeft size={16} />
    首頁
  </a>
  <TaggerProgress listLength={data.stagedFiles.length} />
  <TaggerLoading {loading} {imageLoading} />
</header>
<main class="tagger-main">
  <aside class="tagger-sidebar">
    <TaggerSidebarHeader
      listLength={data.stagedFiles.length}
      selectedSize={selected.size}
      bind:loading
    />
    <TaggerList
      list={data.stagedFiles}
      itemHeight={72}
      bind:selected bind:imageLoading
    >
      {#snippet renderItem(index)}
        <img src={imgSrc("staged", data.stagedFiles[index], "sm")}
             alt={data.stagedFiles[index]} loading="lazy" />
        <span>{data.stagedFiles[index]}</span>
      {/snippet}
    </TaggerList>
    <TaggerSidebarFooter bind:loading />
  </aside>
  <TaggerPreview
    list={data.stagedFiles}
    selectedCount={selected.size}
    {loading} bind:imageLoading
  />
  <TaggerPanel
    bind:tags bind:rating bind:selected
    bind:loading bind:imageLoading
    list={data.stagedFiles}
  />
</main>
```

- **cursor 不出現在 props 中**
- `list` prop 傳遞 `data.stagedFiles`（§1.1 SSR data 規則）
- `<header>` / `<aside>` 直接寫在 `+page`（§1.2 頁面殼）
- `renderItem` snippet 為 §1.5 策略注入

### 4.5 `TaggerProgress` + `TaggerLoading`（拆分自原 `TaggerProgress`）

#### TaggerProgress（重構）

純展示，刪除 `taggerProgress.svelte.ts`。

```svelte
<script lang="ts">
  import { page } from "$app/stores";
  let { listLength }: { listLength: number } = $props();

  const total = $derived(Number($page.url.searchParams.get("total")) || 0);
  const processed = $derived(total - listLength);
  const progressPct = $derived(total > 0 ? Math.round((processed / total) * 100) : 0);
  const progressLabel = $derived(`${processed}/${total} (${listLength} 剩餘)`);
</script>
```

#### TaggerLoading（新增）

純展示，無 `.svelte.ts`。接收 `loading` + `imageLoading`，條件渲染 `CircularProgress`。

### 4.6 `TaggerSidebarHeader` + `TaggerSidebarFooter`

`<aside>` 佈局移入 `+page.svelte`。

#### TaggerSidebarHeader

**`taggerSidebarHeader.svelte.ts`：**

```ts
type TaggerSidebarHeaderOptions = {
  loading: boolean;                // getter/setter
  listLength: number;              // getter
  currentParams: URLSearchParams;  // getter
};

export function createTaggerSidebarHeader(options: TaggerSidebarHeaderOptions) {
  async function handleRefreshClick() {
    if (options.loading) return;
    options.loading = true;
    try {
      const oldLen = options.listLength;
      await invalidateAll();
      const diff = options.listLength - oldLen;

      if (diff > 0) {
        addToast(`發現 ${diff} 張新圖片`, "success");
        const oldTotal = Number(options.currentParams.get("total")) || 0;
        replaceState(buildTaggerUrl({ total: oldTotal + diff }, options.currentParams), {});
      } else if (diff === 0) {
        addToast("沒有發現新圖片", "info");
      } else {
        addToast(`列表已更新（減少 ${-diff} 張）`, "info");
      }
    } finally {
      options.loading = false;
    }
  }
  return { handleRefreshClick };
}
```

#### TaggerSidebarFooter

**`taggerSidebarFooter.svelte.ts`：**

```ts
type TaggerSidebarFooterOptions = {
  loading: boolean; // getter/setter
};

export function createTaggerSidebarFooter(options: TaggerSidebarFooterOptions) {
  let fileInputEl = $state<HTMLInputElement>();

  async function handleUploadChange(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;
    options.loading = true;
    try {
      const body = new FormData();
      for (const f of input.files) body.append("files", f);
      const res = await api.post<{ added: string[]; errors: string[] }>("/api/staged", body);
      if (!res.ok || !res.data) { addToast(res.error || "上傳失敗", "error"); return; }
      if (res.data.errors.length) addToast(`${res.data.errors.length} 個檔案加入失敗`, "error");
      if (res.data.added.length) {
        addToast(`已加入 ${res.data.added.length} 張圖片`, "success");
        await invalidateAll();
      }
    } catch { addToast("上傳請求失敗", "error"); }
    finally { options.loading = false; input.value = ""; }
  }

  function handleUploadClick() { fileInputEl?.click(); }

  return {
    get fileInputEl() { return fileInputEl as HTMLInputElement; },
    set fileInputEl(el: HTMLInputElement) { fileInputEl = el; },
    handleUploadClick,
    handleUploadChange,
  };
}
```

### 4.7 `TaggerList`（§1.5 重構重點）

**新 Props：**

```ts
type Props = {
  list: string[];
  itemHeight: number;
  selected: Set<number>;         // $bindable
  imageLoading: boolean;         // $bindable
  renderItem: Snippet<[index: number]>;
};
```

**`.svelte`（cursor 從 URL 讀取）：**

```svelte
<script lang="ts">
  import { page } from "$app/stores";
  import { resolveCursorIndex } from "./url.js";
  import { createTaggerList } from "./taggerList.svelte.js";

  let { list, itemHeight, selected = $bindable(), imageLoading = $bindable(),
        renderItem }: Props = $props();

  const cursor = $derived($page.url.searchParams.get("cursor") ?? "");
  const cursorIndex = $derived(resolveCursorIndex(list, cursor));

  const ui = createTaggerList({
    get list() { return list; },
    get itemHeight() { return itemHeight; },
    get cursorIndex() { return cursorIndex; },
    get selected() { return selected; },
    set selected(v) { selected = v; },
    get imageLoading() { return imageLoading; },
    set imageLoading(v) { imageLoading = v; },
    get currentParams() { return $page.url.searchParams; },
  });
</script>
```

**新 `taggerList.svelte.ts`：**

```ts
type TaggerListOptions = {
  list: string[];               // getter
  itemHeight: number;           // getter
  cursorIndex: number;          // getter（已 resolve）
  selected: Set<number>;        // getter/setter
  imageLoading: boolean;        // getter/setter
  currentParams: URLSearchParams; // getter
};

export function createTaggerList(options: TaggerListOptions) {
  let listEl = $state<HTMLDivElement | null>(null);
  let scrollTop = $state(0);
  let viewH = $state(400);
  let anchor = 0;
  const BUFFER = 5;

  const itemCount = $derived(options.list.length);
  const totalH = $derived(itemCount * options.itemHeight);
  const startIdx = $derived(Math.max(0, Math.floor(scrollTop / options.itemHeight) - BUFFER));
  const endIdx = $derived(Math.min(itemCount, Math.ceil((scrollTop + viewH) / options.itemHeight) + BUFFER));
  const visible = $derived(
    Array.from({ length: endIdx - startIdx }, (_, i) => ({
      index: startIdx + i,
    })),
  );

  // ResizeObserver
  $effect(() => {
    if (!listEl) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) viewH = e.contentRect.height;
    });
    ro.observe(listEl);
    return () => ro.disconnect();
  });

  // cursor 變更 → 自動捲動
  $effect(() => {
    const idx = options.cursorIndex;
    if (idx >= 0 && listEl) scrollToActive(listEl, idx, options.itemHeight);
  });

  // 選取：寫 cursor 檔名至 URL
  function selectSingle(idx: number) {
    if (idx !== options.cursorIndex) options.imageLoading = true;
    replaceState(buildTaggerUrl({ cursor: options.list[idx] }, options.currentParams), {});
    options.selected = new Set([idx]);
    anchor = idx;
  }

  function selectCtrl(idx: number) {
    const next = new Set(options.selected);
    next.has(idx) && next.size > 1 ? next.delete(idx) : next.add(idx);
    if (idx !== options.cursorIndex) options.imageLoading = true;
    replaceState(buildTaggerUrl({ cursor: options.list[idx] }, options.currentParams), {});
    options.selected = next;
    anchor = idx;
  }

  function selectShift(idx: number) {
    const lo = Math.min(anchor, idx);
    const hi = Math.max(anchor, idx);
    const next = new Set<number>();
    for (let i = lo; i <= hi; i++) next.add(i);
    if (idx !== options.cursorIndex) options.imageLoading = true;
    replaceState(buildTaggerUrl({ cursor: options.list[idx] }, options.currentParams), {});
    options.selected = next;
  }

  function handleItemClick(e: MouseEvent, idx: number) {
    const mode = e.ctrlKey || e.metaKey ? "ctrl" : e.shiftKey ? "shift" : "single";
    if (mode === "single") selectSingle(idx);
    else if (mode === "ctrl") selectCtrl(idx);
    else selectShift(idx);
  }

  function handleListScroll() {
    if (listEl) scrollTop = listEl.scrollTop;
  }

  return {
    get listEl() { return listEl; },
    set listEl(el: HTMLDivElement | null) { listEl = el; },
    get totalH() { return totalH; },
    get visible() { return visible; },
    handleItemClick,
    handleListScroll,
  };
}
```

### 4.8 `TaggerPreview`

**新 Props：**

```ts
type Props = {
  list: string[];
  selectedCount: number;
  loading: boolean;
  imageLoading: boolean; // $bindable
};
```

**新 `taggerPreview.svelte.ts`：**

```ts
type TaggerPreviewOptions = {
  list: string[];         // getter
  cursorIndex: number;    // getter（已 resolve）
  selectedCount: number;  // getter
  loading: boolean;       // getter
  imageLoading: boolean;  // getter/setter
};

export function createTaggerPreview(options: TaggerPreviewOptions) {
  const zp = useZoomPan();
  // zoomPan 完全內部化

  const currentFile = $derived(
    options.list.length > 0 ? options.list[options.cursorIndex] : null
  );
  const previewSrc = $derived(currentFile ? imgSrc("staged", currentFile) : "");

  // 檔案變更時自動重置 zoom
  let prevFile: string | null = null;
  $effect(() => {
    if (currentFile !== prevFile) {
      prevFile = currentFile;
      zp.reset();
    }
  });

  function handleImageLoad() { options.imageLoading = false; }

  return {
    get currentFile() { return currentFile; },
    get previewSrc() { return previewSrc; },
    get selectedCount() { return options.selectedCount; },
    get loading() { return options.loading; },
    get imageLoading() { return options.imageLoading; },
    get transform() { return zp.transform; },
    get isDragging() { return zp.isDragging; },
    handleContainerWheel: (e: WheelEvent) => zp.onWheel(e),
    handleContainerMousedown: (e: MouseEvent) => zp.onMousedown(e),
    handleContainerDblclick: () => zp.reset(),
    handleWindowMousemove: (e: MouseEvent) => zp.onWindowMousemove(e),
    handleWindowMouseup: () => zp.onWindowMouseup(),
    handleImageLoad,
  };
}
```

### 4.9 `TaggerPanel`

**新 Props：**

```ts
type Props = {
  tags: string[];           // $bindable
  rating: number;           // $bindable
  selected: Set<number>;    // $bindable
  list: string[];           // 唯讀
  loading: boolean;         // $bindable
  imageLoading: boolean;    // $bindable
};
```

**新 `taggerPanel.svelte.ts`：**

```ts
type TaggerPanelOptions = {
  tags: string[];               // getter/setter
  rating: number;               // getter/setter
  cursorIndex: number;          // getter（已 resolve）
  selected: Set<number>;        // getter/setter
  list: string[];               // getter
  loading: boolean;             // getter/setter
  imageLoading: boolean;        // getter/setter
  currentParams: URLSearchParams; // getter
};

export function createTaggerPanel(options: TaggerPanelOptions) {
  let tagInputWrapEl = $state<HTMLDivElement>();
  const selectedCount = $derived(options.selected.size);

  function selectedFilenames(): string[] {
    return [...options.selected].sort((a, b) => a - b).map((i) => options.list[i]);
  }

  /** 上一張/下一張。cursorIndex 找不到時已 fallback 至 0，±1 從該處開始 */
  function navigate(delta: -1 | 1) {
    const next = options.cursorIndex + delta;
    if (next < 0 || next >= options.list.length) return;
    options.imageLoading = true;
    replaceState(buildTaggerUrl({ cursor: options.list[next] }, options.currentParams), {});
    options.selected = new Set([next]);
  }

  function toggleRating(n: number) {
    options.rating = n === options.rating ? 0 : n;
  }

  function focusTagInput() {
    tagInputWrapEl?.querySelector("input")?.focus();
  }

  function handleResetClick() {
    options.tags = [];
    options.rating = 0;
  }

  async function doCommit() {
    if (options.loading || options.selected.size === 0) return;
    if (options.tags.length === 0) {
      addToast("請至少加入一個標籤才能提交", "error");
      return;
    }

    options.loading = true;
    const names = selectedFilenames();

    try {
      const [ok, fail] = await batchRun(names, 5, async (fn) =>
        api.post(`/api/staged/${encodeURIComponent(fn)}`, {
          tags: options.tags,
          rating: options.rating,
        }),
      );

      if (ok) addToast(ok === 1 ? `已提交: ${names[0]}` : `已提交 ${ok} 張圖片`, "success");
      if (fail) addToast(`${fail} 張提交失敗`, "error");

      tagCache.invalidate();
      await invalidateAll();
      // cursor 是檔名——若被 commit 的圖片消失，indexOf 自動 fallback 至第一張
    } finally {
      options.loading = false;
    }
  }

  async function doTrash() {
    if (options.loading || options.selected.size === 0) return;

    const n = options.selected.size;
    const cursorFile = options.list[options.cursorIndex];
    const msg = n === 1
      ? `確定要將「${cursorFile}」移至垃圾桶？`
      : `確定要將選取的 ${n} 張圖片移至垃圾桶？`;
    if (!(await requestConfirm(msg))) return;

    options.loading = true;
    const names = selectedFilenames();

    try {
      const [ok, fail] = await batchRun(names, 5, (fn) =>
        api.del(`/api/staged/${encodeURIComponent(fn)}`),
      );

      if (ok) addToast(ok === 1 ? `已移至垃圾桶: ${names[0]}` : `已將 ${ok} 張圖片移至垃圾桶`, "info");
      if (fail) addToast(`${fail} 張刪除失敗`, "error");

      await invalidateAll();
    } finally {
      options.loading = false;
    }
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (isInEditable(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const { key } = e;
    if (key >= "0" && key <= "5") { e.preventDefault(); toggleRating(parseInt(key)); return; }

    const actions: Record<string, () => void> = {
      ArrowLeft: () => navigate(-1),
      ArrowRight: () => navigate(1),
      t: () => focusTagInput(),
      T: () => focusTagInput(),
      Enter: () => doCommit(),
      Delete: () => doTrash(),
    };
    const action = actions[key];
    if (action) { e.preventDefault(); action(); }
  }

  return {
    get tagInputWrapEl() { return tagInputWrapEl as HTMLDivElement; },
    set tagInputWrapEl(el: HTMLDivElement) { tagInputWrapEl = el; },
    get selectedCount() { return selectedCount; },
    get loading() { return options.loading; },
    handleWindowKeydown,
    handleCommitClick: () => doCommit(),
    handleTrashClick: () => doTrash(),
    handleTagEnter: () => doCommit(),
    handleResetClick,
  };
}
```

### 4.10 移除的共用邏輯

以下手動同步邏輯全部消除：

- `removeByNames`——不再手動突變 list
- `reselectAfterRemoval` / reconciliation `$effect`——cursor 是檔名，`indexOf` 自動 fallback
- `refreshList`——改為 `invalidateAll()`
- `selectSingle`（taggerSidebar、taggerPanel 中的重複版本）——sidebar 拆分後不再需要，panel 的 `navigate` 只寫 URL + selected

---

## 五、遷移後的檔案結構

```
tagger/
├── +page.server.ts                （小改：首次訪問 redirect 設定 cursor 檔名 + total）
├── +page.svelte                   （重構：$state + <header>/<aside> 佈局，無 $effect）
├── url.ts                         （新增：buildTaggerUrl + resolveCursorIndex）
├── TaggerProgress.svelte          （重構：僅進度條 + 文字，自行讀 URL total，無 .svelte.ts）
├── TaggerLoading.svelte           （新增：載入指示器，純展示，無 .svelte.ts）
├── TaggerSidebarHeader.svelte     （新增：badge + 重新整理按鈕）
├── taggerSidebarHeader.svelte.ts  （新增：refresh → invalidateAll + 更新 total）
├── TaggerSidebarFooter.svelte     （新增：上傳按鈕）
├── taggerSidebarFooter.svelte.ts  （新增：upload → invalidateAll）
├── TaggerList.svelte              （大改：props + snippet，cursor 檔名 from URL，自動捲動 $effect）
├── taggerList.svelte.ts           （大改：options-based，cursor 檔名 via replaceState）
├── TaggerPreview.svelte           （小改：props-based，cursor 檔名 from URL）
├── taggerPreview.svelte.ts        （小改：zoomPan 內化，$effect auto-reset on file change）
├── TaggerPanel.svelte             （中改：props-based，新增 Reset 按鈕）
├── taggerPanel.svelte.ts          （中改：commit/trash → invalidateAll，navigate → replaceState，Reset 內部處理）
├── (DELETED: context.svelte.ts)
├── (DELETED: taggerProgress.svelte.ts)
├── (DELETED: TaggerSidebar.svelte)
└── (DELETED: taggerSidebar.svelte.ts)
```

---

## 六、建議遷移順序

| 步驟 | 操作 | 驗證點 |
|------|------|--------|
| 1 | 建立 `url.ts` | TypeScript 編譯通過 |
| 2 | 改寫 `+page.server.ts`：首次訪問 redirect | 訪問 `/tagger` → 跳轉至 `?cursor=<first>&total=N` |
| 3 | 重寫 `+page.svelte`：`$state` + `<header>/<aside>` 佈局；暫保 context | 頁面可載入 |
| 4 | 拆分 TaggerProgress → TaggerProgress + TaggerLoading，刪 `taggerProgress.svelte.ts` | header 正常 |
| 5 | 遷移 TaggerPreview：props-based，cursor 檔名 from URL，zoomPan 內化 | 圖片預覽 + 縮放正常 |
| 6 | 遷移 TaggerList：options-based + renderItem snippet + cursor 檔名 from URL | 虛擬列表 + 選取 + 自動捲動 |
| 7 | 建立 TaggerSidebarHeader + TaggerSidebarFooter | 重新整理 + 上傳正常 |
| 8 | 遷移 TaggerPanel：cursor 檔名 from URL，navigate → replaceState，Reset 按鈕 | 全功能驗證 |
| 9 | 刪除 context.svelte.ts、TaggerSidebar.svelte、taggerSidebar.svelte.ts | grep 確認無殘留 |

---

## 七、設計抉擇紀錄

### 7.1 為何 cursor 存檔名而非索引

**核心觀察：** commit/trash/refresh 後已選取圖片消失時，「選附近的圖片」並不重要——直接選第一張即可。真正重要的是**如果該圖片還在，就繼續指向它**。

索引型 cursor 在 list 變動後需要複雜的 reconciliation（找舊檔名新位置、clamp、server 驗證 + redirect）。檔名型 cursor 天然解決：

| 場景 | 索引型 cursor | 檔名型 cursor |
|------|-------------|-------------|
| commit/trash 後圖片消失 | 需 clamp + reconciliation $effect | `indexOf` 回傳 -1 → fallback 第一張 |
| commit/trash 後圖片還在 | 索引可能漂移，需找新位置 | `indexOf` 直接找到 |
| refresh 新增圖片 | 索引指向的檔案可能改變 | 檔名不變，穩定指向 |
| 手動改 URL 為無效值 | 需 server 驗證 + redirect | 無效檔名 → fallback 第一張 |
| 使用者離開再返回 | 索引可能已過期（list 改變） | 檔名仍可能有效 |

**代價：** 上一張/下一張需要 `indexOf` 查找 index（O(n)），但 staged files 量級小，開銷可忽略。

### 7.2 為何使用 `replaceState` 而非 `goto`

`goto()` 會觸發 `+page.server.ts` 的 load 重跑。cursor 是高頻更新，每次都重跑 load 會產生不必要的 `getStagedFiles()` 掃描和 `data.stagedFiles` 引用更新。

`replaceState` 僅更新 `history.state` 和 `$page` stores，零 server 開銷。cursor 從 `$page.url.searchParams` 讀取的 `$derived` 自動響應。

### 7.3 為何移除自動表單重置

- **UX：** 批次標記相似圖片時保留上一張的 tags/rating，使用者可直接 commit 下一張或按 Reset 清空。
- **架構：** 消除 `onselect` 回調穿透元件樹的需求。所有元件少一個 prop，`+page.svelte` 少一個膠水函數。
- **zoomPan：** 由 TaggerPreview 內部 `$effect` 在檔案改變時自動重置。與表單重置解耦。

### 7.4 為何不再需要 TaggerRefs / 共享引用

- `zoomPan.reset()`——移除自動重置後，只有 TaggerPreview 自己需要
- `scrollToActive(listEl, ...)`——TaggerList 自己監聽 cursorIndex 並自動捲動
- 不再有任何跨元件引用需求

### 7.5 為何 URL 不需要驗證

cursor 存的是檔名，`resolveCursorIndex(list, cursor)` 在找不到時 fallback 至 0。無效的 cursor 值（手動改 URL、圖片被刪）不會導致錯誤——渲染端自然降級為選取第一張。

這消除了：

- `+page.server.ts` 的 cursor range 驗證 + redirect
- `+page.svelte` 的初始化 clamp block
- `+page.svelte` 的 reconciliation `$effect`
- 擔心 `replaceState` 寫入的值被下次 load 觸發 redirect 的問題
