# TODO 2：重寫 `editor/[id]` 路由

> 範圍：`src/routes/editor/[id]/` 全部檔案
>
> 參照：`docs/frontend.md` 開發規範、`src/routes/tagger/` 作為符合規範的參考實作

---

## 一、現況問題分析

現行 `editor/[id]` 路由使用了 `createContext` + Class 形式的共享狀態，與 `docs/frontend.md` 的多條規範衝突：

### 1.1 使用了 Context API（違反 §1.3）

`context.svelte.ts` 定義了 `EditorDetailContext` 類別，並透過 `createContext` / `getEditorDetailContext` / `setEditorDetailContext` 共享。規範明確指出：

> 不使用 Svelte 的 `createContext` API——狀態只有兩種歸屬：`+page.svelte` 的 `$state`、無頭 UI 內部的 `$state`。

### 1.2 在 Class 中宣告 `$state`（違反 §1.3）

`EditorDetailContext` 類別內部直接宣告了 `image = $state(...)`, `dirty = $state(...)`, `loading = $state(...)`。規範中響應式狀態只應存在於 `+page.svelte`（頁面級）或 `*.svelte.ts` 的工廠函數內部，不應出現在獨立的 Class 中。

### 1.3 子元件未透過 props 接收資料（違反 §1.2、§1.3）

`EditorPanel.svelte` 和 `EditorPreview.svelte` 不接收任何 props，完全從 context 取得資料：

```svelte
<!-- EditorPanel.svelte -->
const ctx = getEditorDetailContext();
const ui = createEditorPanel(); // 無參數

<!-- EditorPreview.svelte -->
const ui = createEditorPreview(); // 無參數
```

規範要求 SSR `data` 透過 props 傳給子元件，資料流應為「props 向下、bind 向上」。

### 1.4 工廠函數未接收 options（違反 §1.5、§2.2）

`createEditorPanel()` 和 `createEditorPreview()` 均無參數，內部直接呼叫 `getEditorDetailContext()` 取得狀態。規範要求工廠函數接收 `options` 物件，雙向綁定的值以 getter/setter 傳入。

### 1.5 `+page.svelte` 的 SSR 資料初始化方式不正確（違反 §1.4）

現行程式碼：

```ts
const proxy = { get image() { return data.image; }, set image(v) { data.image = v; } };
const ctx = setEditorDetailContext(new EditorDetailContext());
ctx.image = proxy.image;
```

這直接將 `data.image` 的當下值賦給 `ctx.image`，後續 `data` 更新時 `ctx.image` 不會連動。正確做法是讓需要可變副本的元件（EditorPanel）在其無頭 UI 內部以 `$effect` 監聽 SSR 資料做 reconciliation。

### 1.6 `.svelte` 中出現 `$derived`（違反 §1.3）

`EditorPanel.svelte` 中宣告了 `let image = $derived(ctx.image!)`，規範指出不應在 `+page.svelte` 以外的 `.svelte` 中宣告 `$state`（同理推及 `$derived`），狀態計算應在無頭 UI 中完成。

### 1.7 非響應式引用無需跨元件共享

`saveTimer` 和 `SAVE_DEBOUNCE` 目前放在 Context class 中。實際上 `saveTimer` 僅有 EditorPanel 一個消費者，不需跨元件共享，應收進 `editorPanel.svelte.ts` 工廠函數內部作為普通變數。

---

## 二、重寫方案

以 `tagger/` 路由為範本，將 `editor/[id]` 重構為符合規範的 props / bind 模式。

### 2.1 刪除 `context.svelte.ts`

移除整個 Context 機制。所有共享狀態改為 `+page.svelte` 的頁面級 `$state`。

### 2.2 重寫 `+page.svelte`

```svelte
<script lang="ts">
  import CircularProgress from "$lib/components/CircularProgress.svelte";
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  import EditorPreview from "./EditorPreview.svelte";
  import EditorPanel from "./EditorPanel.svelte";

  let { data }: { data: PageData } = $props();

  // --- 頁面級共享響應式狀態（僅 loading：header + preview + panel 三方共用）

  let loading = $state(false);
</script>

<svelte:head>
  <title>
    {data.image.name || data.image.id || "Editor"} — Image Manager
  </title>
</svelte:head>

<div class="page">
  <header class="page-header">
    <a href="/editor" class="btn btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      返回搜尋
    </a>
    <span class="page-header-title">
      {data.image.name || data.image.id || ""}
    </span>
    {#if loading}
      <div class="editor-header-loading">
        <CircularProgress label="操作中…" />
      </div>
    {/if}
  </header>

  <main class="page-content">
    <EditorPreview image={data.image} {loading} />
    <EditorPanel image={data.image} bind:loading />
  </main>
</div>
```

**要點：**

- **唯一的頁面級 `$state` 是 `loading`**——它被 header、EditorPreview、EditorPanel 三方使用，必須由 `+page.svelte` 持有。
- **不需要頁面級 `$effect`**——`data.image` 是 SSR 回傳的響應式 proxy，直接作為 read-only prop 傳遞即可。
- `image`、`dirty`、`saveTimer` 均不需頁面級宣告——Preview 只讀 SSR 資料，Panel 在自己的無頭 UI 中管理可變副本與髒狀態。
- header 的標題直接讀 `data.image.name`，不中轉。

### 2.3 重寫 `editorPanel.svelte.ts`

改為接收 `options` 物件，採用 `invalidateAll` + `afterNavigate` 模式（與 compare 路由一致）。

可編輯欄位（`tags`、`rating`、`name`）各自以獨立 `$state` 管理，不使用 `structuredClone` 整包複製。SSR 唯讀欄位（`id`、`ext`、`updatedAt` 等）直接從 `options.image` 讀取：

```ts
import { afterNavigate, invalidateAll } from "$app/navigation";

const SAVE_DEBOUNCE = 800;

type EditorPanelOptions = {
  /** 唯讀：SSR 回傳的圖片資料 */
  get image(): ImageWithId;
  /** 雙向綁定：操作載入狀態（頁面級共享） */
  get loading(): boolean;
  set loading(v: boolean);
};

export function createEditorPanel(options: EditorPanelOptions) {
  // --- 可編輯欄位（各自 $state，由 afterNavigate 同步）

  /** 使用者可編輯的圖片名稱 */
  let name = $state(options.image.name);
  /** 使用者指派的標籤列表 */
  let tags = $state<string[]>([...options.image.tags]);
  /** 使用者評分 0–5 */
  let rating = $state(options.image.rating);

  // --- 內部狀態

  /** 是否有未儲存的變更 */
  let dirty = $state(false);
  /** 名稱驗證錯誤訊息 */
  let nameError = $state("");
  /** 自動儲存 debounce 計時器 */
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  // --- afterNavigate：在所有導航完成時同步可編輯欄位（§1.4）
  // 涵蓋三種情境：
  //   1. invalidateAll() 完成後（PATCH 儲存 → 重跑 load → data.image 刷新）
  //   2. popstate（瀏覽器前進/後退）
  //   3. 初始頁面載入（等同於重設，無副作用）
  afterNavigate(() => {
    name = options.image.name;
    tags = [...options.image.tags];
    rating = options.image.rating;
    dirty = false;
  });

  // ---

  async function saveChanges() {
    if (!dirty || options.loading) return;
    options.loading = true;
    if (saveTimer) clearTimeout(saveTimer);

    try {
      const res = await api.patch<ImageWithId>(
        `/api/images/${encodeURIComponent(options.image.id)}`,
        { name, tags, rating, expectedUpdatedAt: options.image.updatedAt },
      );
      if (!res.ok) {
        if (res.status === 409) {
          addToast("儲存衝突：資料已被其他操作修改，正在重新載入", "error");
        } else {
          addToast("儲存失敗: " + (res.error || "未知錯誤"), "error");
        }
        await invalidateAll();
        return;
      }
      addToast("已儲存", "success");
      await invalidateAll();
    } finally {
      options.loading = false;
    }
  }

  // ... 其餘 handlers 使用 name / tags / rating（markDirty、debouncedSave 等不變）
  // saveTimer 為工廠函數內部的普通變數，不需跨元件共享
  // reloadImage() 不再需要——衝突時直接 invalidateAll() 即可
}
```

**與 compare 路由的模式對照：**

| | Compare | Editor/[id] Panel |
|---|---|---|
| 觸發資料刷新 | `invalidateAll()`（shuffle） | `invalidateAll()`（PATCH 後） |
| 本地狀態同步 | `afterNavigate` popstate 時同步 filterTags 等 | `afterNavigate` 所有導航後同步 name/tags/rating |
| `loading` | 不需要（`navigating` 涵蓋） | **需要**（PATCH 時間不被 `navigating` 追蹤） |

**為什麼 `loading` 仍需保留？**

`navigating` 追蹤的是 SvelteKit 導航（`goto` / `invalidateAll`）的期間。但 PATCH API 呼叫本身不是導航——從使用者按下儲存到 PATCH 回應之間，`navigating` 為 `null`。`invalidateAll()` 的導航時間通常極短（本地 load），而 PATCH 可能需要數百毫秒。因此 `loading` 負責指示 PATCH 期間的狀態，`navigating` 負責 `invalidateAll` 的極短導航期。

### 2.4 重寫 `EditorPanel.svelte`

改為 props 接收，以 getter/setter 傳入工廠函數：

```svelte
<script lang="ts">
  import type { ImageWithId } from "$lib/types.js";
  import { createEditorPanel } from "./editorPanel.svelte.js";
  // ... icon / component imports

  type Props = {
    image: ImageWithId;
    loading: boolean;
  };

  let { image, loading = $bindable() }: Props = $props();

  const ui = createEditorPanel({
    get image() { return image; },
    get loading() { return loading; },
    set loading(v) { loading = v; },
  });
</script>

<!-- 模板中使用 ui.* 存取所有狀態與 handler -->
```

- `image` 是**唯讀** prop（SSR 來源），工廠函數從中初始化各可編輯欄位的 `$state`。
- `loading` 是 `$bindable()`——唯一需要回傳頁面級的狀態。
- `name`、`tags`、`rating`、`dirty`、`saveTimer` 完全封裝在工廠函數內部，不出現在 props 中。
- 模板中原本的 `ctx.image!` 改為 `ui.name`、`ui.tags`、`ui.rating` 等（從 return 物件的 getter/setter 暴露），SSR 唯讀欄位（如 metadata）則暴露為 `ui.image`（指向 `options.image`）。不再在 `.svelte` 中宣告 `$derived`。

### 2.5 重寫 `editorPreview.svelte.ts`

改為接收 `options` 物件。Preview **純粹唯讀**——直接從 SSR `data.image` 衍生所有值，不需要任何 reconciliation：

```ts
type EditorPreviewOptions = {
  /** 唯讀：SSR 回傳的圖片資料 */
  get image(): ImageWithId;
  /** 唯讀：操作載入狀態 */
  get loading(): boolean;
};

export function createEditorPreview(options: EditorPreviewOptions) {
  // 直接從 options.image（即 data.image）衍生，不建立內部副本
  const previewFilename = $derived(options.image.id + options.image.ext);
  const previewSrc = $derived(imgSrc("committed", previewFilename));
  // ... zoomPan 邏輯不變
}
```

### 2.6 重寫 `EditorPreview.svelte`

改為 props 接收，所有 props 均為唯讀：

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
```

---

## 三、檔案變更清單

| 檔案 | 動作 | 說明 |
|---|---|---|
| `context.svelte.ts` | **刪除** | 移除 Context 機制 |
| `+page.svelte` | **重寫** | 僅 `loading` 為頁面級 `$state`，無 `$effect`，直接傳遞 `data.image` |
| `editorPanel.svelte.ts` | **重寫** | 接收 `options`；各可編輯欄位獨立 `$state` + `afterNavigate` 同步；`invalidateAll` 刷新 SSR |
| `EditorPanel.svelte` | **重寫** | props 接收（`image` 唯讀, `loading` bindable）+ getter/setter 傳入工廠函數 |
| `editorPreview.svelte.ts` | **重寫** | 接收 `options`（全唯讀），從 SSR 資料直接衍生 |
| `EditorPreview.svelte` | **重寫** | props 接收（全唯讀）+ getter 傳入工廠函數 |
| `+page.server.ts` | **不變** | SSR load 邏輯無需調整 |

---

## 四、與 Tagger / Compare 的對應關係

重寫後的 `editor/[id]` 結合了 tagger 的 props/bind 資料流與 compare 的 `invalidateAll` + `afterNavigate` 同步模式：

| 職責 | Tagger | Compare | Editor/[id]（重寫後） |
|---|---|---|---|
| 頁面級共享狀態 | `currentFile`, `selectedFiles`, `loading` 等 | 無 | 僅 `loading` |
| 資料刷新方式 | `invalidateAll()`（提交/刪除後） | `invalidateAll()`（shuffle） | `invalidateAll()`（PATCH 後） |
| 本地狀態同步 | 頁面級 `$effect` 校正多個共享狀態 | `afterNavigate` popstate 同步 filter | `afterNavigate` 所有導航後同步 `editImage` |
| `loading` | 有（API 操作期間） | 無（`navigating` 涵蓋） | 有（PATCH 不被 `navigating` 追蹤） |
| 子元件資料流 | props 向下 + `bind` 向上 | props 向下 | props 向下 + `bind` 向上 |
| Context 使用 | 無 | 無 | **無**（刪除） |

**為什麼 Tagger 用頁面級 `$effect`，而 Editor/[id] 用 `afterNavigate`？**

Tagger 的 `currentFile` 和 `selectedFiles` 是**多個子元件共享的可變狀態**（TaggerList、TaggerForm、TaggerPreview 都需要讀寫），必須由 `+page.svelte` 持有，且需要在 `data.stagedFiles` 變動時做**複雜的交叉校正**（如刪除後 fallback 至第一項、清除已不存在的選取項、維持 selectedFiles 與 currentFile 的一致性）。這類校正涉及多個狀態間的依賴關係，用 `$effect` 集中處理最清晰。

Editor/[id] 的 `editImage` 只有 EditorPanel 一個消費者，且同步邏輯極其單純（`structuredClone` + `dirty = false`）。使用 `afterNavigate` 與 compare 路由一致——在導航完成時一次性同步，不需要追蹤 `data.image` 的細粒度變化。

---

## 五、注意事項

1. **PATCH 後一律 `invalidateAll()`**：無論 PATCH 成功或失敗（含 409 衝突），都呼叫 `invalidateAll()` 讓 SSR `load` 重跑。成功時 `data.image` 拿到最新值，header 標題與 Preview 自動同步；衝突時 `data.image` 回到伺服器端的真實狀態。`afterNavigate` 在導航完成後統一將 `editImage` 從 `data.image` 同步回來。原本的 `reloadImage()` 函數因此不再需要。

2. **`afterNavigate` 涵蓋所有同步情境**：初始載入、PATCH 後的 `invalidateAll`、popstate 前進/後退——`afterNavigate` 在這三種情境都會觸發，統一將 `name`、`tags`、`rating` 從 `options.image` 同步並重置 `dirty`。不需要 `$effect` 監聽 `options.image`。

3. **`SAVE_DEBOUNCE` 與 `saveTimer`**：兩者均為 `editorPanel.svelte.ts` 的模組/函數內部變數，不需跨元件共享。`SAVE_DEBOUNCE` 作為模組頂層常數，`saveTimer` 作為工廠函數內的普通變數（非 `$state`，無響應式開銷）。

4. **EditorPreview 的 zoomPan handler 暴露方式**：目前 `EditorPreview` 直接在模板中使用 `ui.zp.onWheel` 等方法。重寫時應維持 tagger 的模式——在工廠函數中包裝為 `handleContainerWheel` 等 handler 後再暴露，不直接 return 內部的 `zp` 物件（符合 §2.4 規則：不得直接 return helper function）。
