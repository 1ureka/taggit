# Frontend 開發規範

> 本文件定義了專案的前端架構、元件開發規範與 Page 組織方式，確保 UI 開發保持一致性、可維護性與清晰的職責分工。

---

## 一、狀態

本章定義了所有響應式狀態的規則。無論狀態宣告在 `+page.svelte` 還是無頭 UI（`*.svelte.ts`），規則都相同——我們統稱為「狀態」。

### 1.1 狀態的宣告位置

本專案中，「狀態」指以 `$state` 宣告的響應式變數。狀態只允許出現在兩個地方：

1. **`+page.svelte`**——跨子元件共享的狀態
2. **無頭 UI 工廠函數（`*.svelte.ts`）**——僅該元件使用的狀態

**不得**在子元件的 `.svelte` 檔案中宣告 `$state`。同理，`$derived` 若涉及運算邏輯也應收進無頭 UI，`.svelte` 中的 `$derived` 僅限直覺的一行式轉換。

無論狀態宣告在哪裡，本章後續的所有規則都一體適用。關於 `+page.svelte` 與無頭 UI 各自的職責與檔案結構，詳見第二章與第三章。

### 1.2 API 約束

狀態只能使用以下四個 API：

| API | 用途 |
|---|---|
| `$state` | 宣告可變響應式狀態 |
| `$derived` | 從既有響應式來源衍生唯讀值 |
| `$effect` | 監聽外部來源變動，同步回本地狀態 |
| `untrack` | 在 `$state` 初始化器中讀取外部來源的當下值，不建立追蹤 |

**禁用清單：**

以下 API **不得用於狀態管理**：

- `afterNavigate`——狀態同步一律使用 `$effect`
- `createContext` / `setContext` / `getContext`——不使用 Context API（詳見第二章）
- Class-based state——不以 class 宣告 `$state`

### 1.3 狀態的兩個維度

狀態由兩個維度決定寫法：**讀寫需求**與**資料來源**。

#### 資料來源

| 來源 | 說明 |
|---|---|
| SSR `data` | `+page.server.ts` 回傳的 `data` 物件，透過 props 傳入 |
| URL params | `page.url.searchParams`，由需要的元件就近讀取 |
| 純本地 | 不來自外部，元件自身產生的狀態 |

SSR `data` 與 `page.url.searchParams` 本身就是 **read-only 的 reactive object**。

#### 寫法對照表

| 來源 | 唯讀 | 需要寫 |
|---|---|---|
| SSR `data` | `$derived` 或直接透過 props 使用 | `$state(untrack(...))` + `$effect` 同步 |
| URL params | `$derived(page.url.searchParams.get(...))` | `$state(untrack(...))` + `$effect` + `draft`（§1.5） |
| 純本地 | `$derived` | `$state` |

**核心原則：如果你沒有「寫」的需求，直接 `$derived` 就好，不需要 `$state`、`$effect` 與 `untrack`。**

### 1.4 `untrack` 與 `$effect` 的角色

#### 問題

`$props()` 解構後的 `data` 是 reactive proxy，但若直接寫在 `$state()` 初始化器中：

```ts
// ✗ Svelte 警告：This reference only captures the initial value of 'data'.
let name = $state(data.image.name);
```

Svelte 會建立不必要的追蹤關係，且後續 `data` 更新時 `$state` 不會連動。

#### 解法

`untrack` 讓 `$state` 讀到外部來源的當下值，但不建立追蹤，再由 `$effect` 負責後續同步：

```ts
let name = $state(untrack(() => data.image.name));

$effect(() => {
  // data.image 變動時（invalidateAll / goto 導致 load 重跑），同步回本地
  name = data.image.name;
});
```

**`untrack` 解決了 SSR 後、`$effect` 執行前的真空問題**——沒有 `untrack`，`$state` 只能初始化為空值（`null` / `new Set()`），SSR 輸出的第一幀就是錯的。有了 `untrack`，`$state` 從第一幀就帶正確值，`$effect` 只負責後續的增量同步。

#### 簡單 vs 複雜場景

**簡單場景**——外部來源整個替換即可（如單一物件的欄位）：

```ts
let user = $state<User>(untrack(() => data.user));

$effect(() => {
  if (user.id !== data.user.id) user = data.user;
});
```

**複雜場景**——需要交叉校正多個狀態（如列表增減後調整選取）：

```ts
let currentFile = $state<string | null>(untrack(() => data.stagedFiles[0] ?? null));
let selectedFiles = $state<Set<string>>(untrack(() => {
  const first = data.stagedFiles[0];
  return first ? new Set([first]) : new Set();
}));

$effect(() => {
  const list = data.stagedFiles;

  // 第一幀由 untrack 處理，此處只處理後續變動

  // 波動 (N => N')
  if (currentFile !== null && list.length > 0) {
    if (!list.includes(currentFile)) currentFile = list[0];
    const next = new Set([...selectedFiles].filter((f) => list.includes(f)));
    if (next.size === 0) selectedFiles = new Set([currentFile]);
    else if (next.size !== selectedFiles.size) selectedFiles = next;
    return;
  }

  // 新增 (0 => N)
  if (currentFile === null && list.length > 0) {
    currentFile = list[0];
    selectedFiles = new Set([list[0]]);
    return;
  }

  // 清空 (N => 0)
  if (currentFile !== null && list.length <= 0) {
    currentFile = null;
    selectedFiles = new Set();
    return;
  }
});
```

`$effect` 內的 reconciliation 邏輯依實際需求設計，但初始值一律由 `untrack` 提供。

### 1.5 下放原則

若同一份外部資料有多個消費者，**只有需要「寫」的元件才走 `$state` + `untrack` + `$effect`**，其餘元件直接透過 `$props` 原封不動使用即可。

**範例**：頁面有 A、B、C 三個子元件都需要 `data.image` (SSR)，但只有 C 需要編輯：

```svelte
<!-- +page.svelte -->
<A image={data.image} />        <!-- A 唯讀：直接用 props -->
<B image={data.image} />        <!-- B 唯讀：直接用 props -->
<C image={data.image} bind:loading />  <!-- C 需要寫 -->
```

```ts
// c.svelte.ts — 只有 C 的無頭 UI 才需要 $state + untrack + $effect
export function createC(options: COptions) {
  let name = $state(untrack(() => options.image.name));
  let tags = $state<string[]>(untrack(() => [...options.image.tags]));

  $effect(() => {
    name = options.image.name;
    tags = [...options.image.tags];
  });

  // ...
}
```

A、B 元件的無頭 UI 直接從 `options.image`（getter）讀取即可，不建立自己的 `$state` 副本。

### 1.6 輸入 debounce

當使用者的連續輸入需要 debounce 後才同步回外部來源（URL params 的 `goto()`、SSR data 的 `invalidateAll()` 等），需要處理一個競態：debounce 到期 → 同步送出 → 使用者在同步回來前又輸入了新值。

#### 機制

使用 `dirty` flag 區分 source of truth。`dirty` 在 `$effect` 中必須以 `untrack` 讀取——否則 `dirty` 本身的變動會觸發 `$effect` 重跑，此時外部來源可能尚未更新，導致舊值覆蓋使用者的新輸入：

```ts
import { goto } from "$app/navigation";
import { page } from "$app/state";

export function createSomeForm() {
  /** 本地是否有尚未送出的修改（true 時本地狀態為準） */
  let dirty = $state(false);

  // --- 本地狀態（從外部來源初始化）

  let sort = $state<"name" | "date">(untrack(() =>
    (page.url.searchParams.get("sort") as "name" | "date") ?? "date"
  ));

  let rating = $state(untrack(() =>
    Number(page.url.searchParams.get("rating")) || 0
  ));

  // --- $effect：外部來源變動時同步回本地（popstate、其他元件的 goto 等）

  $effect(() => {
    const params = page.url.searchParams;   // 追蹤外部來源變動
    if (untrack(() => dirty)) return;       // 本地正在修改，跳過
    sort = (params.get("sort") as "name" | "date") ?? "date";
    rating = Number(params.get("rating")) || 0;
  });

  // --- debounce 寫回外部來源

  let timer: ReturnType<typeof setTimeout> | null = null;

  function scheduleGoto() {
    dirty = true;                           // 使用者輸入，信任本地
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const q = buildQueryString({ sort, rating });
      goto(`/some-page${q}`, { replaceState: true, noScroll: true, keepFocus: true });
      dirty = false;                        // 送出，交回外部來源（不 await goto）
    }, 300);
  }

  // ...
}
```

#### 時序

1. 使用者輸入 → `dirty = true`，本地狀態更新
2. debounce 到期 → `goto()` 送出 → **立刻** `dirty = false`
3. `$effect` 偵測到外部來源變動：
   - `dirty === false` → 正常同步（這次的同步或 popstate 回來了）
   - `dirty === true` → 跳過（使用者在同步回來前又輸入了新值，舊值不該覆蓋）

#### 為什麼 `dirty` 要用 `untrack`？

若 `$effect` 追蹤 `dirty`，當 `dirty` 從 `true` 變為 `false`（`goto()` 送出後）時 `$effect` 會立刻重跑——但此時 `goto()` 是非同步的，`page.url.searchParams` 尚未更新，`$effect` 會把**舊 URL 的值**同步回本地，覆蓋使用者的新輸入。`untrack` 確保 `$effect` 只在外部來源真正變動時才觸發。

#### 不需要 debounce 時

若變更是離散選擇（如 select、checkbox），不需要 debounce，直接在 handler 中同步即可。此時不需要 `dirty`——同步完成後 `$effect` 偵測到外部來源變動會同步回本地，但本地值已是最新的，同步是冪等的：

```ts
function handleFilterChange() {
  const q = buildQueryString({ sort, rating });
  goto(`/some-page${q}`, { replaceState: true, noScroll: true, keepFocus: true });
}
```

### 1.7 載入 debounce

當使用者觸發導航（`goto()` / `invalidateAll()`），SvelteKit 的 `navigating` 會在導航期間變為非 `null`。若立刻顯示載入狀態，快速完成的導航（< 200ms）會造成內容閃爍。

本專案採用**純 CSS `transition-delay`** 取代 JavaScript 計時器，以零邏輯開銷實現載入提示的 debounce：

```svelte
<div class="container" style:opacity={navigating.to ? 0.4 : 1}>
  <!-- 正常內容 -->
</div>

<style>
  .container {
    transition: opacity 0s step-end 0.2s;
  }
</style>
```

**`transition: opacity 0s step-end 0.2s` 的三個值：**

| 值 | 意義 |
|---|---|
| `0s` | duration——opacity 變化是瞬間跳變，不做漸變 |
| `step-end` | timing function——離散跳變（與 `0s` 搭配確保行為明確） |
| `0.2s` | delay——opacity 變化延遲 200ms 才生效 |

若導航在 200ms 內完成，`opacity` 已回到 `1`，瀏覽器**自動取消尚未生效的 pending transition**——不需要任何 JavaScript 清理邏輯，天然無競態。

此模式不限於 `navigating`——任何布林旗標驅動的暫態視覺回饋（如 API 呼叫中的 `loading`）都適用，只要希望「短暫切換不產生視覺變化、長時間停留才顯示」。

### 1.8 `$effect` 就近原則

`$effect` 若用於同步外部狀態，應宣告在**消費該狀態的位置**：

- 頁面級共享狀態的 `$effect` → 寫在 `+page.svelte`
- 無頭 UI 內部狀態的 `$effect` → 寫在 `*.svelte.ts` 的工廠函數內

不應將 `$effect` 集中到一個獨立的檔案或函數中統一管理。
