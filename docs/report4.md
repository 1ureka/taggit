# Report 4：Editor Detail（`editor/[id]`）路由遷移計畫

> 範圍：`src/routes/editor/[id]/` 下所有檔案

---

## 一、現況結構

| 檔案 | 職責 | 使用 Context? |
|---|---|---|
| `+page.server.ts` | SSR：查詢單張圖片，回傳 `{ image }` | — |
| `+page.svelte` | 接收 data、建立 `EditorDetailContext`、組裝子元件、顯示 header 與載入指示 | `setEditorDetailContext` |
| `context.svelte.ts` | 定義 `EditorDetailContext` class（含 `$state`）+ `createContext` | 定義者 |
| `EditorPanel.svelte` + `.ts` | 右側編輯面板（名稱、標籤、評等、儲存、刪除、metadata） | `getEditorDetailContext` |
| `EditorPreview.svelte` + `.ts` | 左側圖片預覽（含縮放平移） | `getEditorDetailContext` |

---

## 二、違規項目

### 2.1 ❌ 使用 `createContext`（規範 §1.2 — 嚴重違規）

> **規範**：不使用 Svelte 的 `createContext` API——狀態只有兩種歸屬：`+page.svelte` 的 `$state`，或無頭 UI 內部的 `$state`。

**現況**：`context.svelte.ts` 以 `createContext<EditorDetailContext>()` 建立 Context，`+page.svelte` 呼叫 `setEditorDetailContext(new EditorDetailContext())`。兩個子元件的 `.svelte.ts`（`editorPanel.svelte.ts`、`editorPreview.svelte.ts`）透過 `getEditorDetailContext()` 直接讀取共享狀態。

**影響**：資料流不透明——從 `.svelte.ts` 看不出資料來源，必須追溯到 context 定義才能理解。子元件不透過 props 接收任何資料，完全依賴隱式的 Context 注入。

### 2.2 ❌ `+page.svelte` 包含業務邏輯（規範 §1.2）

> **規範**：`+page.svelte` 不含業務邏輯。樣式規則只允許布局上的。

**現況**：`+page.svelte` 中包含：

```ts
const proxy = {
  get image() { return data.image; },
  set image(v) { data.image = v; },
};

const ctx = setEditorDetailContext(new EditorDetailContext());
ctx.image = proxy.image;
```

proxy 建立、Context 實例化與初始化賦值都是業務邏輯，不應出現在頁面殼中。

### 2.3 ❌ `+page.svelte` 直接讀取 Context 狀態渲染 UI（規範 §1.2）

**現況**：`+page.svelte` 模板中直接使用 `ctx.image` 與 `ctx.loading`：

```svelte
<title>{ctx.image?.name || ctx.image?.id || "Editor"} — Image Manager</title>
<span class="page-header-title">{ctx.image?.name || ctx.image?.id || ""}</span>
{#if ctx.loading}
  <CircularProgress label="操作中…" />
{/if}
```

頁面殼不應直接操作外部狀態物件，應透過 `$state` / props 機制存取。

### 2.4 ❌ 子元件不接收任何 props（規範 §1.2 / §1.3）

> **規範**：SSR `data` 由 `+page.svelte` 接收後，透過 props 傳給子元件。

**現況**：`EditorPreview` 和 `EditorPanel` 在 `+page.svelte` 中不接收任何 props：

```svelte
<EditorPreview />
<EditorPanel />
```

所有資料透過 Context 隱式注入，完全違背「props 向下、bind 向上」的資料流模式。

### 2.5 ❌ 無頭 UI 從 Context 取資料，而非從 options 接收（規範 §1.3）

> **規範**：子元件把 `$props()` 解構出的值透過 getter-based options 傳給工廠函數。

**現況**：兩個工廠函數都在內部呼叫 `getEditorDetailContext()` 取得資料：

```ts
// editorPanel.svelte.ts
export function createEditorPanel() {
  const ctx = getEditorDetailContext();
  // 全部透過 ctx.* 存取
}

// editorPreview.svelte.ts
export function createEditorPreview() {
  const ctx = getEditorDetailContext();
  // 全部透過 ctx.* 存取
}
```

工廠函數應接收 `options` 物件，由 `.svelte` 將 props 以 getter/setter 傳入。

### 2.6 ❌ `EditorPanel.svelte` 中宣告 `$derived` 與直接使用 Context（規範 §1.2）

> **規範**：不應該在 `+page.svelte` 以外的任意 `.svelte` 中宣告 `$state`——狀態只能是頁面級或無頭 UI 的。

**現況**：`EditorPanel.svelte` 的 `<script>` 中：

```ts
const ctx = getEditorDetailContext();
const ui = createEditorPanel();
let image = $derived(ctx.image!);
```

- 直接從 Context 讀取狀態（應由 props 傳入）
- 宣告 `$derived`（響應式邏輯應在無頭 UI 中）
- 模板直接使用 `image.*` 操作 context 中的資料（如 `bind:value={image.rating}`、`bind:tags={image.tags}`），繞過了無頭 UI

### 2.7 ❌ `EditorPreview.svelte` 不接收 props、工廠函數無 options

**現況**：`EditorPreview.svelte` 完全沒有 `$props()`，工廠函數 `createEditorPreview()` 無參數。所有資料來自 Context。

### 2.8 ⚠️ Context class 將響應式與非響應式引用混合

**現況**：`EditorDetailContext` class 同時包含：
- 響應式 `$state`（`image`、`dirty`、`loading`）
- 非響應式引用（`saveTimer`）
- 常數（`SAVE_DEBOUNCE`）

依規範 §1.4，非響應式引用（如 timer）應在 `+page.svelte` 建立為普通物件並以 prop 傳下去；常數則直接定義在使用它的無頭 UI 模組中即可。

---

## 三、Context 中各狀態的實際消費者分析

| 狀態 | 寫入者 | 讀取者 | 跨元件共享？ |
|---|---|---|---|
| `image` | SSR（初始）、Panel（儲存/重載後更新） | Panel（表單欄位）、Preview（圖片路徑）、`+page.svelte`（標題/header） | ✅ 是 — 讀寫 |
| `dirty` | Panel（`markDirty()`、儲存後重置） | Panel（按鈕 disabled、auto-save effect） | ❌ 否 — 僅 Panel |
| `loading` | Panel（儲存/刪除操作中） | Panel（按鈕文字）、Preview（圖片透明度）、`+page.svelte`（header spinner） | ✅ 是 — Panel 寫，三處讀 |
| `saveTimer` | Panel（debounce 設定/清除） | Panel（clearTimeout） | ❌ 否 — 僅 Panel |
| `SAVE_DEBOUNCE` | 常數 | Panel | ❌ 否 — 僅 Panel |

**關鍵發現**：

- `image` 與 `loading` 是真正的跨元件共享狀態，需提升至 `+page.svelte` 的 `$state`。
- `dirty`、`saveTimer`、`SAVE_DEBOUNCE` 僅由 Panel 使用，應收歸 `editorPanel.svelte.ts` 內部。
- `image` 需要雙向綁定（Panel 儲存後會更新 `image`），因此使用 `$bindable` + getter/setter options。
- `loading` 僅 Panel 寫入，Preview 與 `+page.svelte` 唯讀，因此同樣使用 `$bindable` + getter/setter options 由 Panel 寫回。

---

## 四、遷移計畫

### Step 1：刪除 `context.svelte.ts`

整個檔案移除。

### Step 2：修改 `+page.svelte` — 移除 Context，改用 `$state` + props

```svelte
<script lang="ts">
  import CircularProgress from "$lib/components/CircularProgress.svelte";
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  import EditorPreview from "./EditorPreview.svelte";
  import EditorPanel from "./EditorPanel.svelte";

  let { data }: { data: PageData } = $props();

  /** 目前編輯中的圖片完整資料（跨元件共享） */
  let image = $state(data.image);
  /** 操作載入狀態（跨元件共享） */
  let loading = $state(false);
</script>

<svelte:head>
  <title>
    {image?.name || image?.id || "Editor"} — Image Manager
  </title>
</svelte:head>

<div class="page">
  <header class="page-header">
    <a href="/editor" class="btn btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      返回搜尋
    </a>
    <span class="page-header-title">
      {image?.name || image?.id || ""}
    </span>
    {#if loading}
      <div class="editor-header-loading">
        <CircularProgress label="操作中…" />
      </div>
    {/if}
  </header>

  <main class="page-content">
    <EditorPreview {image} {loading} />
    <EditorPanel bind:image bind:loading />
  </main>
</div>

<!-- <style> 不變 -->
```

變更摘要：
- 移除 `context.svelte.ts` import、proxy 物件、`setEditorDetailContext` 呼叫
- 宣告 `image` 與 `loading` 為頁面級 `$state`（跨元件共享狀態的唯一合法歸屬）
- `image` 初始值從 `data.image` 取得
- `EditorPanel` 使用 `bind:image` 和 `bind:loading`（Panel 需要寫入）
- `EditorPreview` 以唯讀 props 傳入（Preview 只讀取不寫入）
- 模板中 `ctx.image` → `image`、`ctx.loading` → `loading`

**注意**：`image` 使用 `$state(data.image)` 而非 `$derived(data.image)`。這是因為 Panel 在儲存成功後會寫入 `image = res.data`（本地更新），而不是透過 `goto()` / `invalidateAll()` 重跑 SSR load。若未來改為 invalidate 模式，需同步調整為 `$derived`。

### Step 3：修改 `EditorPanel.svelte` — 改用 props + 移除 Context 與 `$derived`

```svelte
<script lang="ts">
  import { IconDeviceFloppy, IconTrash } from "@tabler/icons-svelte";
  import Rating from "$lib/components/Rating.svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  import { formatDate, formatSize } from "$lib/utils.js";
  import type { ImageWithId } from "$lib/types.js";
  import { createEditorPanel } from "./editorPanel.svelte.js";

  type Props = {
    image: ImageWithId;
    loading: boolean;
  };
  let { image = $bindable(), loading = $bindable(false) }: Props = $props();

  const ui = createEditorPanel({
    get image() { return image; },
    set image(v) { image = v; },
    get loading() { return loading; },
    set loading(v) { loading = v; },
  });
</script>

<svelte:window onkeydown={ui.handleWindowKeydown} />

<aside class="editor-panel">
  <div class="editor-rating">
    <Rating bind:value={image.rating} size="1.5rem" onchange={ui.handleRatingChange} />
  </div>

  <!-- ... 其餘模板不變，但移除 ctx 引用 ... -->
  <!-- ui.dirty → ui.dirty -->
  <!-- ui.loading → ui.loading -->
  <!-- image.* 直接從 props 的 image 取用（Svelte 自動追蹤） -->
</aside>

<!-- <style> 不變 -->
```

變更摘要：
- 移除 `getEditorDetailContext` import 與 `ctx` 變數
- 移除 `let image = $derived(ctx.image!)`
- 新增 `Props` 型別，`image` 與 `loading` 皆為 `$bindable`
- 透過 getter/setter options 傳給工廠函數
- 模板中 `image.*` 繼續使用（現在來自 props 而非 context）

### Step 4：修改 `editorPanel.svelte.ts` — 改用 options，本地化 `dirty` / `saveTimer`

```ts
import type { ImageWithId } from "$lib/types.js";
import { goto } from "$app/navigation";
import { api } from "$lib/client/api.js";
import { addToast, isInEditable, requestConfirm } from "$lib/client/dom.js";

/**
 * 編輯面板組件的配置選項
 */
type EditorPanelOptions = {
  /** 雙向綁定：目前編輯中的圖片完整資料 */
  image: ImageWithId;
  /** 雙向綁定：操作載入狀態 */
  loading: boolean;
};

/** 自動儲存 debounce 毫秒數 */
const SAVE_DEBOUNCE = 800;

/**
 * 建立編輯面板邏輯的核心工廠函數
 */
export function createEditorPanel(options: EditorPanelOptions) {
  /** 是否有未儲存的變更 */
  let dirty = $state(false);
  /** 名稱驗證錯誤訊息 */
  let nameError = $state("");
  /** 自動儲存 debounce 計時器 */
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  // ---

  /** 執行儲存變更至伺服器 */
  async function saveChanges() {
    const img = options.image;
    if (!img || !dirty || options.loading) return;
    options.loading = true;

    if (saveTimer) clearTimeout(saveTimer);

    try {
      const res = await api.patch<ImageWithId>(
        `/api/images/${encodeURIComponent(img.id)}`,
        {
          tags: img.tags,
          rating: img.rating,
          name: img.name,
          expectedUpdatedAt: img.updatedAt,
        },
      );
      if (!res.ok) {
        if (res.status === 409) {
          addToast("儲存衝突：資料已被其他操作修改，正在重新載入", "error");
          await reloadImage();
        } else {
          addToast("儲存失敗: " + (res.error || "未知錯誤"), "error");
        }
        return;
      }
      if (res.data) {
        options.image = res.data;
      }
      dirty = false;
      addToast("已儲存", "success");
    } finally {
      options.loading = false;
    }
  }

  /** 從伺服器重新載入圖片資料 */
  async function reloadImage() {
    const img = options.image;
    if (!img) return;
    const res = await api.get<ImageWithId>(
      `/api/images/${encodeURIComponent(img.id)}`,
    );
    if (res.ok && res.data) {
      options.image = res.data;
      dirty = false;
    }
  }

  /** 以 debounce 方式觸發自動儲存 */
  function debouncedSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveChanges(), SAVE_DEBOUNCE);
  }

  /** 標記資料為已變更 */
  function markDirty() {
    dirty = true;
  }

  /** 驗證名稱格式，回傳錯誤訊息或空字串 */
  function validateName(value: string): string {
    if (value.trim().length === 0) return "名稱不可為空白";
    if (value.length > 200) return "名稱不可超過 200 字元";
    return "";
  }

  // ---

  /** 監聽 dirty 狀態變化，自動觸發 debounce 儲存 */
  $effect(() => {
    if (dirty) {
      debouncedSave();
    }
  });

  // ---

  /** 將圖片移入垃圾桶 */
  async function doTrash() {
    const img = options.image;
    if (!img || options.loading) return;
    const ok = await requestConfirm("確定要將此圖片移入垃圾桶嗎？");
    if (!ok) return;

    options.loading = true;
    try {
      const res = await api.del(
        `/api/images/${encodeURIComponent(img.id)}`,
      );
      if (!res.ok) {
        addToast("操作失敗: " + (res.error || "未知錯誤"), "error");
        return;
      }
      addToast("已移入垃圾桶", "success");
      goto("/editor");
    } finally {
      options.loading = false;
    }
  }

  // ---

  /** 處理評等變更事件，標記為已變更 */
  function handleRatingChange() { markDirty(); }

  /** 處理標籤變更事件，標記為已變更 */
  function handleTagChange() { markDirty(); }

  // ---

  /** 處理名稱輸入框失焦事件，驗證名稱並標記變更 */
  function handleNameBlur(e: FocusEvent) { /* ... 同現有，ctx.image → options.image ... */ }

  /** 處理名稱輸入框鍵盤事件，Enter 時觸發失焦以確認變更 */
  function handleNameKeydown(e: KeyboardEvent) { /* ... 不變 ... */ }

  // ---

  /** 處理儲存按鈕點擊事件，立即儲存變更 */
  function handleSaveClick() { saveChanges(); }

  /** 處理刪除按鈕點擊事件，確認後將圖片移入垃圾桶 */
  function handleTrashClick() { doTrash(); }

  // ---

  /** 處理 Window 鍵盤事件，執行儲存與導航快捷鍵操作 */
  function handleWindowKeydown(e: KeyboardEvent) { /* ... 不變 ... */ }

  // ---

  return {
    /** 存取是否有未儲存變更的 getter */
    get dirty() { return dirty; },
    /** 存取載入狀態的 getter */
    get loading() { return options.loading; },
    /** 存取名稱驗證錯誤訊息的 getter */
    get nameError() { return nameError; },

    /** 處理評等變更事件，標記為已變更 */
    handleRatingChange,
    /** 處理標籤變更事件，標記為已變更 */
    handleTagChange,
    /** 處理名稱輸入框失焦事件，驗證名稱並標記變更 */
    handleNameBlur,
    /** 處理名稱輸入框鍵盤事件，Enter 時觸發失焦以確認變更 */
    handleNameKeydown,
    /** 處理儲存按鈕點擊事件，立即儲存變更 */
    handleSaveClick,
    /** 處理刪除按鈕點擊事件，確認後將圖片移入垃圾桶 */
    handleTrashClick,
    /** 處理 Window 鍵盤事件，執行儲存與導航快捷鍵操作 */
    handleWindowKeydown,
  };
}
```

變更摘要：
- 移除 `getEditorDetailContext` import
- 新增 `EditorPanelOptions` 型別，`image` 與 `loading` 為雙向綁定屬性
- `ctx.image` → `options.image`，`ctx.loading` → `options.loading`，`ctx.dirty` → 本地 `dirty`
- `ctx.saveTimer` → 本地 `saveTimer`，`ctx.SAVE_DEBOUNCE` → 模組常數 `SAVE_DEBOUNCE`

### Step 5：修改 `EditorPreview.svelte` — 改用 props

```svelte
<script lang="ts">
  import type { ImageWithId } from "$lib/types.js";
  import { createEditorPreview } from "./editorPreview.svelte.js";

  type Props = {
    image: ImageWithId;
    loading: boolean;
  };
  let { image, loading }: Props = $props();

  const ui = createEditorPreview({
    get image() { return image; },
    get loading() { return loading; },
  });
</script>

<!-- 模板不變 -->
```

變更摘要：
- 新增 `Props` 型別，接收 `image` 和 `loading`（皆為唯讀）
- 透過 getter options 傳給工廠函數

### Step 6：修改 `editorPreview.svelte.ts` — 改用 options

```ts
import { imgSrc } from "$lib/client/api.js";
import { useZoomPan } from "$lib/client/use-zoom-pan.svelte.js";
import type { ImageWithId } from "$lib/types.js";

/**
 * 圖片預覽組件的配置選項
 */
type EditorPreviewOptions = {
  /** 目前編輯中的圖片完整資料 */
  image: ImageWithId;
  /** 操作載入狀態 */
  loading: boolean;
};

/**
 * 建立圖片預覽邏輯的核心工廠函數
 */
export function createEditorPreview(options: EditorPreviewOptions) {
  /** 目前預覽的檔案名稱 */
  const previewFilename = $derived(
    options.image ? options.image.id + options.image.ext : null,
  );
  /** 目前預覽的圖片路徑 */
  const previewSrc = $derived(
    previewFilename ? imgSrc("committed", previewFilename) : "",
  );

  // ---

  /** 縮放平移控制器 */
  const zp = useZoomPan();

  /** 當圖片路徑變更時重置縮放 */
  $effect(() => {
    previewSrc;
    zp.reset();
  });

  // ---

  return {
    /** 存取預覽檔案名稱的 getter */
    get previewFilename() { return previewFilename; },
    /** 存取預覽圖片路徑的 getter */
    get previewSrc() { return previewSrc; },
    /** 存取載入狀態的 getter */
    get loading() { return options.loading; },
    /** 存取縮放平移控制器的 getter */
    get zp() { return zp; },
  };
}
```

變更摘要：
- 移除 `getEditorDetailContext` import
- 新增 `EditorPreviewOptions` 型別
- `ctx.image` → `options.image`，`ctx.loading` → `options.loading`

---

## 五、遷移後的資料流

```
+page.server.ts
  ↓ data: { image }
+page.svelte
  ├── $state: image (初始值 = data.image)
  ├── $state: loading (初始值 = false)
  │
  ├── EditorPreview  ← props: image (唯讀), loading (唯讀)
  └── EditorPanel    ← bind:image (讀寫), bind:loading (讀寫)
```

**資料流模式**：
- `image`：`+page.svelte` 持有 `$state`，Panel 透過 `$bindable` 寫入（儲存/重載後更新），Preview 唯讀
- `loading`：`+page.svelte` 持有 `$state`，Panel 透過 `$bindable` 寫入（操作開始/結束時切換），Preview 與 header 唯讀
- `dirty`、`saveTimer`、`SAVE_DEBOUNCE`：Panel 內部私有，不外流
- 完全符合「props 向下、bind 向上、getter/setter options 傳入無頭 UI」的單一 pattern

---

## 六、遷移後檔案清單

| 檔案 | 動作 |
|---|---|
| `context.svelte.ts` | **刪除** |
| `+page.server.ts` | **不變** |
| `+page.svelte` | 修改（移除 Context/proxy，宣告 `$state`，改用 props/bind） |
| `EditorPanel.svelte` | 修改（新增 Props，移除 Context 與 `$derived`） |
| `editorPanel.svelte.ts` | 修改（新增 options，移除 Context，本地化 dirty/saveTimer） |
| `EditorPreview.svelte` | 修改（新增 Props） |
| `editorPreview.svelte.ts` | 修改（新增 options，移除 Context） |

---

## 七、風險與注意事項

1. **`image` 的寫入路徑**：Panel 在 `saveChanges()` 成功後執行 `options.image = res.data`，直接以 API 回傳值更新本地狀態，而非透過 `invalidateAll()` 重跑 SSR load。這意味著 `+page.svelte` 中的 `image` 必須是 `$state`（可寫）而非 `$derived(data.image)`（只讀追蹤 SSR data）。若未來改為 invalidate 模式，需將 `$state(data.image)` 改為 `$derived(data.image)` 並移除 Panel 的 `$bindable` 寫入。

2. **`image` 的 `$state` 初始化時機**：`$state(data.image)` 在元件掛載時取一次初始值。由於此路由是動態路由 `[id]`，若使用者從 `/editor/A` 導航到 `/editor/B`（SvelteKit 可能複用元件），`data.image` 變化但 `$state` 不會自動跟隨。需要確認此情境是否存在。若存在，需加一個 `$effect` 同步：

   ```ts
   $effect(() => { image = data.image; });
   ```

   或者使用 Svelte 的 `{#key data.image.id}` 強制重建元件。但依現有程式碼（從 editor 列表點進詳情頁、Escape 返回），通常是銷毀再重建而非元件複用，此風險較低。

3. **`loading` prop 的方向性**：`loading` 僅由 Panel 寫入，Preview 和 header 只讀。使用 `bind:loading` 傳給 Panel 即可完成雙向通訊。Preview 只需唯讀 prop `{loading}`，不需要 `$bindable`。

4. **模板中直接 `bind:value={image.rating}` 與 `bind:tags={image.tags}`**：這些 bind 直接修改 props 中的 `image` 物件屬性。因為 `image` 本身是 `$bindable`，而 Svelte 5 對物件屬性的深層響應式追蹤（fine-grained reactivity）會確保這些修改被追蹤到。這個模式在遷移後仍然可行——`image` 從 `+page.svelte` 的 `$state` 透過 `bind:image` 傳下來，Panel 內部對 `image.rating` 的修改會自動反映到所有訂閱者。

5. **向後相容**：此遷移全部是內部重構，不改變 URL、API 或使用者可見行為。
