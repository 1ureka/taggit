# URL Query String 與 Svelte 5 Writable Derived 分析

> 本文件分析專案中所有 URL query string（以下簡稱 URL QS）的用法與位置，並評估 Svelte 5 的 writable `$derived`（樂觀更新）是否能取代現有的 `$effect` 同步 pattern。

---

## 1. 背景：Writable `$derived`

Svelte 5 在近期版本中移除了 `$derived` 的 read-only 限制，使得 `$derived` 的值可以被直接寫入。這形成了一種官方推薦的「樂觀更新」pattern：

```ts
// 舊寫法：$state + untrack 初始化 + $effect 同步
let value = $state(untrack(() => source.value));
$effect(() => { value = source.value; });

// 新寫法：writable $derived（樂觀更新）
let value = $derived(source.value);
// 可以直接寫入 value，下次 source 變動時 $derived 會重新計算
```

**核心語意**：`$derived` 宣告了值的「權威來源」，但允許在來源尚未更新時先行寫入（樂觀更新）。當來源變動時，`$derived` 重新計算，覆蓋先前的樂觀寫入。

這與 URL QS 的互動模式天然契合：

1. 使用者操作 → 立即更新本地狀態（樂觀寫入）
2. `goto()` 送出新 URL → 觸發 server `load` 重跑
3. `page.url` 更新 → `$derived` 重新計算（來源確認）

---

## 2. 專案中的 URL QS 用法一覽

### 2.1 Server 端讀取（`+page.server.ts`）

所有路由的 `+page.server.ts` 透過 `parseQueryParams(url)` 從 URL 提取篩選條件，查詢資料庫後回傳 SSR 資料。這些是純 server 端邏輯，不涉及客戶端狀態同步，**不受本次分析影響**。

| 路由 | 檔案 | 讀取方式 |
| --- | --- | --- |
| `/` | `(home)/+page.server.ts` | `parseQueryParams(url)` |
| `/compare` | `compare/+page.server.ts` | `parseQueryParams(url)` + `sort: "random"` |
| `/editor` | `editor/+page.server.ts` | `parseQueryParams(url)` + `url.searchParams.get("currentId")` |
| `/player` | `player/+page.server.ts` | `parseQueryParams(url)` |

### 2.2 Client 端用法

以下是所有客戶端讀寫 URL QS 的位置，按用法分類：

---

#### A. `FilterFields`（`src/lib/ui/filterFields.svelte.ts`）— ⚡ 可寫入 URL 同步

**目前 pattern**：`untrack` 初始化 + `$effect` 同步 + `goto()` 寫入

```ts
// 7 個 $state 欄位
search = $state<string>("");
includedTags = $state<string[]>([]);
excludedTags = $state<string[]>([]);
rating = $state<number | undefined>(undefined);
ratingOp = $state<"gte" | "lte" | "eq">("gte");
sort = $state<SortField>("rating");
order = $state<"asc" | "desc">("desc");

constructor() {
    // 初始化：untrack 避免追蹤警告
    this.#setFields(untrack(() => parseQueryParams(page.url)));
    // 後續同步：URL 變動時重置欄位
    $effect(() => {
        this.#setFields(parseQueryParams(page.url));
    });
}
```

**讀取的參數**：`search`、`includedTags`、`excludedTags`、`rating`、`ratingOp`、`sort`、`order`

**寫入方式**：`goto(pathname + queryString, { replaceState, noScroll, keepFocus })`，其中 `search` 欄位額外套用 500ms debounce。

**消費者**：
- `(home)/+page.svelte` — 首頁左側面板篩選
- `editor/+page.svelte` — 編輯頁面篩選 Modal

---

#### B. `EditorPage`（`src/routes/editor/editorPage.svelte.ts`）— ⚡ URL 導航

**目前 pattern**：`goto()` 直接寫入 URL

```ts
navigateTo = (id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("currentId", id);
    goto(url.pathname + url.search, { replaceState: true, noScroll: true, keepFocus: true });
};

handleFilterReset = (e: Event) => {
    const qs = new URLSearchParams(page.url.search);
    const search = buildQueryString({}, qs);
    goto(`${page.url.pathname}${search}`, { replaceState: true, noScroll: true, keepFocus: true });
};
```

**讀取的參數**：`page.url.search`、`page.url.pathname`

**特點**：此 class 不從 URL 同步 `$state`——它只讀取 URL 用於構建新 URL，然後用 `goto()` 導航。其 `$effect` 負責 SSR 資料的 reconciliation（`selectedFiles` 與 `imageIds` 的同步），不涉及 URL → `$state` 同步。

---

#### C. `BrowseModal`（`src/routes/(home)/browseModal.svelte.ts`）— ✅ 已使用 `$derived`

**目前 pattern**：純 `$derived.by()` + `replaceState()`（shallow routing）

```ts
this.record = $derived.by(() => {
    const modalClose = (page.state as { modalClose?: boolean }).modalClose;
    if (modalClose) return null;

    const modalSSR = page.url.searchParams.get("modal");
    const modalCSR = (page.state as { modal?: string }).modal;
    const modal = modalCSR || modalSSR;
    if (!modal) return null;

    return options.items.find((item) => item.id === modal) || null;
});
```

**讀取的參數**：`modal`（URL QS）+ `page.state`（shallow routing 狀態）

**寫入方式**：`replaceState()` 更新 URL 與 `page.state`

**特點**：已經是純 `$derived` 唯讀 pattern，沒有 `$effect`，**不需要改動**。

---

#### D. `+layout.svelte` — ✅ 純唯讀

**目前 pattern**：`$derived` / `$derived.by()` 直接讀取

```ts
const currentStatus = $derived.by(() => {
    const path = page.url.pathname;
    const searchParams = page.url.searchParams;
    // ... 根據路徑顯示狀態文字
});

const currentActiveItem = $derived.by(() => {
    const path = page.url.pathname;
    // ... 判斷活躍導航項目
});

const fullscreen = $derived(page.url.pathname.includes("player"));
```

**讀取的參數**：`page.url.pathname`、`page.url.searchParams`（`currentId`）、`page.url.search`

**特點**：純展示用途，不寫入 URL。已是最佳 pattern，**不需要改動**。

---

#### E. `settings/+page.svelte` — ✅ 純唯讀（模板內聯）

**目前 pattern**：直接在 Svelte 模板中讀取

```svelte
{#if page.url.searchParams.get("alert") === "default"}
    <Alert type="default" message="..." />
{:else if page.url.searchParams.get("alert") === "error"}
    <Alert type="error" message="..." />
{/if}
```

**讀取的參數**：`alert`

**特點**：一次性的路由跳轉參數（`redirect(303, "/settings?alert=error")`），不涉及狀態同步，**不需要改動**。

---

#### F. `(home)/+page.svelte` — ✅ 純唯讀（連結生成）

**目前 pattern**：在模板中拼接 URL

```svelte
<a class="btn-primary" href={`/player${page.url.search}`}>播放</a>
<a class="btn-outlined" href={`/compare${page.url.search}`}>比較</a>
```

**讀取的參數**：`page.url.search`（完整 query string，傳遞給 player/compare 路由）

**特點**：純 URL 傳遞，不涉及狀態管理，**不需要改動**。

---

## 3. 非 URL 但使用 `$effect` 同步的相關 Pattern

以下 class 使用 `$effect` 從 SSR 資料（非 URL QS）同步狀態，為比較分析一併列出：

| Class | 檔案 | 同步來源 | 用途 |
| --- | --- | --- | --- |
| `EditorForm` | `editor/editorForm.svelte.ts` | `options.currentRecord` | 表單欄位（name、tags、rating）的 SSR 資料同步 |
| `EditorPage` | `editor/editorPage.svelte.ts` | `options.imageIds` + `options.currentRecord` | `selectedFiles` 的 reconciliation |
| `TaggerPage` | `tagger/taggerPage.svelte.ts` | `options.stagedFiles` | `currentFile` + `selectedFiles` 的 reconciliation |
| `EditorPreview` | `editor/editorPreview.svelte.ts` | `options.currentRecord` | 圖片切換時觸發 `onChangeImage` callback |
| `TaggerPreview` | `tagger/taggerPreview.svelte.ts` | `options.currentFile` | 圖片切換時觸發 `onChangeImage` callback + `imageLoading` |

---

## 4. 逐案分析：Writable `$derived` 是否能取代

### 4.1 `FilterFields` — ✅ 可以取代

這是專案中最典型的「URL QS ↔ 本地 `$state`」雙向同步，也是 writable `$derived` 最適合的場景。

**現況問題**：

- 需要 `untrack()` 避免 `$state` 初始化器的追蹤警告
- 需要 `$effect` 處理後續 URL 變動的同步
- 7 個欄位的 `$state` + `#setFields()` 有一定的 boilerplate

**改用 writable `$derived` 後**：

```ts
export class FilterFields {
  search: string;
  includedTags: string[];
  excludedTags: string[];
  rating: number | undefined;
  ratingOp: "gte" | "lte" | "eq";
  sort: SortField;
  order: "asc" | "desc";

  constructor() {
    const params = () => parseQueryParams(page.url);

    this.search = $derived(params().search ?? "");
    this.includedTags = $derived(params().includedTags ?? []);
    this.excludedTags = $derived(params().excludedTags ?? []);
    this.rating = $derived(params().rating);
    this.ratingOp = $derived(params().ratingOp ?? "gte");
    this.sort = $derived(params().sort ?? "rating");
    this.order = $derived(params().order ?? "desc");
  }
}
```

**效益**：

- 移除 `untrack` + `$effect` + `#setFields()`
- 「URL 是 source of truth」的語意更明確——`$derived` 天然表達「此值來自 URL」
- 樂觀更新的時序自然正確：
  1. 使用者操作 → 直接寫入 `$derived`（樂觀更新）→ UI 立即反映
  2. `goto()` 送出 → server `load` 重跑
  3. `page.url` 更新 → `$derived` 重新計算（來源確認，值相同則無變化）

**Debounce 的影響**：

目前 `search` 欄位使用 `debounce(this.handleChange, 500)`。在 writable `$derived` 下：

- 使用者打字 → 直接寫入 `this.search`（樂觀更新，UI 跟隨）
- 500ms 後 → `goto()` 送出新 URL
- URL 更新 → `$derived` 重新計算（值相同，無視覺變化）

與現況行為一致，但 **不再需要 `dirty` flag 邏輯**——因為 `$derived` 的語意已經隱含了「來源更新時覆蓋樂觀寫入」的行為。若使用者在 debounce 期間瀏覽器返回導致 URL 變動，`$derived` 會正確重新計算，用 URL 的值覆蓋使用者的輸入，這其實是**更正確**的行為。

---

### 4.2 `EditorPage` — ❌ 不適用

`EditorPage` 的 `$effect` 不是在做 URL → `$state` 同步，而是 SSR 資料的 reconciliation：

```ts
$effect(() => {
    const ids = options.imageIds;
    const record = options.currentRecord;
    // 清理 selectedFiles 中已不存在的 id...
});
```

這是**有條件的複雜邏輯**（非簡單的值映射），無法用 `$derived` 表達。同時 `navigateTo()` 與 `handleFilterReset()` 是純命令式操作，不涉及 `$state` 同步。

---

### 4.3 `EditorForm` — ⚠️ 原則上可以，但需謹慎

**現況**：

```ts
name = $state("");
tags = $state<string[]>([]);
rating = $state(0);

constructor(private options: EditorFormOptions) {
    this.#resetForm();
    $effect(() => { this.#resetForm(); });
}
```

**若改用 writable `$derived`**：

```ts
name = $derived(this.options.currentRecord?.name ?? "");
tags = $derived([...(this.options.currentRecord?.tags ?? [])]);
rating = $derived(this.options.currentRecord?.rating ?? 0);
```

**可行性**：語意上正確——表單的「初始值」來自 `currentRecord`，使用者的編輯是「樂觀寫入」，切換圖片時 `currentRecord` 變動，`$derived` 重新計算（重置表單）。

**需注意**：

- `dirty` flag 判斷需要調整——目前 `dirty` 在 `#resetForm()` 中被設為 `false`。writable `$derived` 沒有明確的「重置」時機，需要另外用 `$derived` 追蹤 `currentRecord` 的變動來重置 `dirty`
- `tags` 是陣列，需確保 `$derived` 每次產生新參考（`[...tags]`），避免共享參考導致意外

**結論**：可行但不像 `FilterFields` 那樣直覺，改寫時需處理 `dirty` flag 的配套邏輯。此外，這裡同步的是 SSR 資料而非 URL QS，嚴格來說不在本次分析的主要範圍內。

---

### 4.4 `TaggerPage` — ❌ 不適用

```ts
$effect(() => {
    const list = options.stagedFiles;
    if (this.currentFile === null && list.length > 0) { ... }
    if (this.currentFile !== null && list.length > 0) { ... }
    if (this.currentFile !== null && list.length <= 0) { ... }
});
```

這是複雜的 reconciliation 邏輯，包含多個條件分支與交叉引用（`currentFile`、`selectedFiles`、`stagedFiles`），不適合用 `$derived` 表達。

---

### 4.5 `EditorPreview` / `TaggerPreview` — ❌ 不適用

```ts
$effect(() => {
    const id = options.currentRecord?.id ?? null;
    if (id !== this.#prevId) {
        this.#prevId = id;
        options.onChangeImage(); // 副作用：觸發外部 callback
    }
});
```

這些 `$effect` 的目的是**觸發副作用**（`onChangeImage` callback），而非同步狀態。`$derived` 不應該有副作用，因此不適用。

---

### 4.6 `BrowseModal` — ✅ 已是最佳 pattern

已使用純 `$derived.by()` 從 URL + `page.state` 計算 `record`，沒有 `$effect`。

若未來需要支持「樂觀更新」（如先顯示 modal 再更新 URL），可以直接寫入 `this.record`，但目前的 `replaceState()` shallow routing 已經足夠快，不需要。

---

## 5. 總結

### 可取代的位置

| Class | 檔案 | 難度 | 效益 |
| --- | --- | --- | --- |
| `FilterFields` | `src/lib/ui/filterFields.svelte.ts` | 🟢 低 | 移除 `untrack` + `$effect` + `#setFields()`，7 個欄位全部簡化 |

### 原則上可取代但需謹慎

| Class | 檔案 | 難度 | 備註 |
| --- | --- | --- | --- |
| `EditorForm` | `src/routes/editor/editorForm.svelte.ts` | 🟡 中 | 需重新設計 `dirty` flag 邏輯。同步來源是 SSR 資料而非 URL QS |

### 不適用的位置

| Class | 檔案 | 原因 |
| --- | --- | --- |
| `EditorPage` | `src/routes/editor/editorPage.svelte.ts` | `$effect` 做 reconciliation，非簡單值映射 |
| `TaggerPage` | `src/routes/tagger/taggerPage.svelte.ts` | 複雜的多條件 reconciliation |
| `EditorPreview` | `src/routes/editor/editorPreview.svelte.ts` | `$effect` 觸發副作用（callback） |
| `TaggerPreview` | `src/routes/tagger/taggerPreview.svelte.ts` | `$effect` 觸發副作用（callback） |

### 已經是最佳 pattern 的位置

| 位置 | 用法 |
| --- | --- |
| `BrowseModal` | 純 `$derived.by()` 唯讀 |
| `+layout.svelte` | 純 `$derived` / `$derived.by()` 唯讀 |
| `settings/+page.svelte` | 模板內聯讀取 |
| `(home)/+page.svelte` | 模板內聯讀取（連結生成） |

---

## 6. 判斷準則

經過本次分析，可歸納出「何時使用 writable `$derived` 取代 `$effect` 同步」的判斷準則：

| ✅ 適用 writable `$derived` | ❌ 不適用 |
| --- | --- |
| 外部來源 → 本地 `$state` 的**簡單值映射** | 需要**條件邏輯**的 reconciliation |
| 使用者可以「樂觀寫入」，來源更新時覆蓋 | `$effect` 內觸發**副作用**（callback、DOM 操作） |
| 每個欄位**獨立**對應來源的一個值 | 多個 `$state` 之間有**交叉引用** |
| 來源更新 = 完整重置（無需保留本地修改） | 需要根據情境**選擇性地**同步或跳過 |

簡言之：如果現有 pattern 是 `$state(init) + $effect(() => { state = source })` 且 `$effect` 內部沒有分支邏輯或副作用，就可以安全地替換為 writable `$derived(source)`。
