# UI（互動邏輯）

> 所有互動邏輯收進 `*.svelte.ts` 的 class 中——`$state`、`$derived`、`$effect`、event handlers 都在這裡。Template（`.svelte`）只做實例化與綁定。

---

## Class 結構

### 基本結構

每個 class 遵循固定的排列順序：

```ts
// component.svelte.ts

/**
 * Component 的配置選項
 */
type ComponentOptions = {
  /** 雙向綁定：目前的值 */
  value: number;
  /** 唯讀：選項列表 */
  items: string[];
  /** Callback：值變更時通知 */
  onchange?: () => void;
};

/**
 * Component 的互動邏輯
 */
export class Component {
  // 1. $state fields
  /** 下拉選單是否開啟 */
  open = $state(false);
  /** 目前聚焦的選項索引 */
  activeIndex = $state(-1);

  // 2. $derived fields（型別宣告在 field 區域）
  /** 過濾後的選項列表 */
  filtered: string[];

  // 3. constructor（$derived 賦值 + $effect）
  constructor(private options: ComponentOptions) {
    this.filtered = $derived(options.items.filter(i => i.length > 0));

    $effect(() => {
      // 副作用：監聽外部來源變動，同步回本地狀態
    });
  }

  // ---

  // 4. Private helpers
  #openMenu() { ... }
  #closeMenu() { ... }

  // ---

  // 5. Public handlers（按目標元素分組）
  /** 處理按鈕點擊事件 */
  handleButtonClick = () => { ... };

  /** 處理按鈕失焦事件 */
  handleButtonBlur = () => { ... };

  // ---

  /** 處理選項滑鼠按下事件 */
  handleItemMouseDown = (e: MouseEvent) => { ... };

  /** 處理選項滑鼠移入事件 */
  handleItemMouseEnter = (index: number) => { ... };
}
```

### 排列順序

1. `$state` fields
2. `$derived` fields（型別宣告）
3. Constructor（`$derived` 賦值 → `$effect`）
4. Private helpers（`#methodName()`）
5. Public handlers（`handleXxxYyy = () => {}`）

### 分隔符

- Class 內部以 `// ---` 作為唯一的視覺分隔符
- 同一目標元素的 handler 連續排列，不加分隔
- 不同目標元素之間以 `// ---` 分隔

### Handler 命名

Handler 以箭頭函式屬性宣告（確保 `this` 綁定），命名結構為 `handle` + **目標元素** + **事件類型**：

| Handler                     | 目標元素    | 事件     |
| --------------------------- | ----------- | -------- |
| `handleButtonClick`         | Button      | Click    |
| `handleInputKeydown`        | Input       | Keydown  |
| `handleContainerWheel`      | Container   | Wheel    |
| `handleWindowMousemove`     | Window      | Mousemove |
| `handleDropdownMouseDown`   | Dropdown    | MouseDown |
| `handleItemMouseEnter`      | Item        | MouseEnter |
| `handleOverlayKeydown`      | Overlay     | Keydown  |

### Private Methods

內部邏輯以 `#` private method 宣告（JS private class fields），不暴露給 template：

```ts
#selectSingle(id: string) { ... }
#selectCtrl(id: string) { ... }
#selectShift(id: string) { ... }
#openDropdown() { ... }
#closeDropdown() { ... }
#commit(value: number) { ... }
```

---

## Options Pattern

Class 透過 constructor 的 options 物件接收外部依賴。Options 使用 getter，Svelte 的 rune 系統能正確追蹤 getter 的回傳值，class 內部讀 `this.options.xxx` 都能響應式取得最新值。

### 三種屬性類型

| 類型     | 用途           | Options 寫法                                                     |
| -------- | -------------- | ---------------------------------------------------------------- |
| 唯讀     | 讀取外部資料   | `get items() { return data.items; }`                             |
| 雙向綁定 | 讀寫共享狀態   | `get value() { return value; }, set value(v) { value = v; }`    |
| Callback | 通知外部       | `onchange: () => onchange?.()`                                   |

### 頁面中的 Class 連接

在 `+page.svelte` 中，一個 class 的 `$state` 可以透過另一個 class options 的 getter/setter 被讀寫，消除 prop 嫁接鏈：

```svelte
<script lang="ts">
  const pg = new TaggerPage({
    get stagedFiles() { return data.stagedFiles; },
  });

  // listSelect 透過 getter/setter 直接讀寫 pg 的狀態
  const listSelect = new TaggerListSelect({
    get currentFile() { return pg.currentFile; },
    set currentFile(v) { pg.currentFile = v; },
    get selectedFiles() { return pg.selectedFiles; },
    set selectedFiles(v) { pg.selectedFiles = v; },
  });

  // form 也能讀寫同一份 pg 的狀態
  const form = new TaggerForm({
    get selectedFiles() { return pg.selectedFiles; },
    set selectedFiles(v) { pg.selectedFiles = v; },
    get progress() { return pg.progress; },
    set progress(v) { pg.progress = v; },
  });
</script>
```

### 組件中的 Props → Options 橋接

在共用組件的 `.svelte` 中，props 透過 options 物件傳入 class：

```svelte
<script lang="ts">
  let { value = $bindable(0), onchange, readonly = false }: Props = $props();

  const ui = new RatingUI({
    get value() { return value; },
    set value(v) { value = v; },
    get onchange() { return onchange; },
    get readonly() { return readonly; },
  });
</script>
```

→ 詳見 [pages.md](./pages.md)（頁面的 class 實例化）與 [components.md](./components.md)（組件的 props 橋接）

---

## 多 Class 拆分

### 拆分時機

當一個 class 內部出現**彼此無交集的狀態群組**——各自的 `$state`、`$derived`、handler 互不引用——就是拆分的訊號。

### 一檔多 Class

相關的 class 可以共存在同一個 `.svelte.ts` 檔案中：

```ts
// taggerList.svelte.ts

export class TaggerListSelect {
  activeId = $state<string | null>(null);
  // 選取相關的 state + handlers...
}

export class TaggerListActions {
  pending = $state(false);
  // 操作相關的 state + handlers...
}
```

### 多檔多 Class

當關注點差異較大時，拆成不同的 `.svelte.ts` 檔案：

```
taggerPage.svelte.ts      ← 頁面級共享狀態
taggerList.svelte.ts      ← 列表選取 + 操作
taggerForm.svelte.ts      ← 表單邏輯
taggerPreview.svelte.ts   ← 預覽邏輯
```

### 在 template 中區分

實例化時每個 class 各自命名，模板透過不同前綴存取：

```svelte
const listSelect = new TaggerListSelect({ ... });
const listActions = new TaggerListActions();
const form = new TaggerForm({ ... });

<!-- template -->
<span>{listSelect.badgeLabel}</span>
<button onclick={listActions.handleRefreshClick}>...</button>
<input bind:value={form.name} />
```

前綴讓閱讀者一眼分辨每段互動屬於哪個關注點。

---

## SSR 資料

`+page.server.ts` 回傳的 `data` 是 read-only reactive object，透過 `$props()` 接收後以 options getter 傳入 class。

### 唯讀

不需要「寫」時，直接透過 getter 使用即可——不需要 `$state`、`$effect` 或 `untrack`：

```ts
export class TaggerProgress {
  total: number;
  progressPct: number;

  constructor(private options: { stagedFiles: string[]; progress: number }) {
    this.total = $derived(options.stagedFiles.length);
    this.progressPct = $derived(
      this.total > 0 ? (options.progress / this.total) * 100 : 0
    );
  }
}
```

`goto()` 或 `invalidateAll()` 導致 `load` 重跑時，options getter 自動回傳新值，`$derived` 響應式重算。

### 可寫入

當需要**編輯** SSR 資料的本地副本時（如表單），使用 `$state` 建立副本，並以 `$effect` 在外部來源變動時同步：

```ts
export class EditorForm {
  name = $state("");
  rating = $state(0);

  constructor(private options: { currentRecord: ImageWithId }) {
    // 1. 同步初始化
    this.name = options.currentRecord.name;
    this.rating = options.currentRecord.rating;

    // 2. 後續的增量同步（goto / invalidateAll 後）
    $effect(() => {
      this.name = options.currentRecord.name;
      this.rating = options.currentRecord.rating;
    });
  }
}
```

在 class constructor 中，`options` 只是普通的 constructor 參數，直接賦值不會建立追蹤、不觸發警告。`$effect` 負責後續外部來源變動時的同步。

### 就近原則

若同一份 SSR 資料有多個消費者，**只有需要「寫」的 class 才建立 `$state` 副本**，其餘 class 直接透過 options getter 使用：

```svelte
<!-- 唯讀：直接傳 getter -->
<Display item={data.item} />
<Summary item={data.item} />

<!-- 可寫：class 內部建立 $state 副本 -->
<!-- EditorForm 的 constructor 會建立可編輯的本地狀態 -->
```

---

## URL 狀態

URL query params（`page.url.searchParams`）是另一種 read-only reactive source。`page` 來自 `$app/state`，是 Svelte 認識的 module-level reactive proxy——無論在 `.svelte` 還是 class constructor 中讀取都會建立追蹤。

### 唯讀

直接讀取，不需要額外的 `$state`：

```ts
import { page } from "$app/state";

export class CompareShuffle {
  // 直接在 $derived 中讀取 URL 參數
  currentTab: string;

  constructor() {
    this.currentTab = $derived(page.url.searchParams.get("tab") ?? "default");
  }
}
```

### 可寫入

需要先以 `untrack` 初始化（避免 `$state` 警告），再以 `$effect` 同步：

```ts
import { page } from "$app/state";
import { goto } from "$app/navigation";
import { untrack } from "svelte";

export class EditorFilter {
  sort = $state("");
  search = $state("");

  constructor() {
    // untrack：讀取當下值但不建立追蹤
    const params = untrack(() => parseQueryParams(page.url));
    this.sort = params.sort;
    this.search = params.search;

    // $effect：後續 URL 變動時同步
    $effect(() => {
      const params = parseQueryParams(page.url);
      this.sort = params.sort;
      this.search = params.search;
    });
  }

  // ---

  handleSortClick = (value: string) => {
    this.sort = value;
    goto(`/editor?sort=${value}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  };
}
```

使用 `goto()` 更新 URL 時，三個選項 `{ replaceState, noScroll, keepFocus }` 確保 URL 更新不干擾使用者體驗。

### `untrack` 的必要性

`page` 是 module-level reactive proxy——在任何地方讀取都會建立追蹤。若要在 `$state` 初始化器中讀取 URL 參數，必須用 `untrack` 包裹，否則 Svelte 會警告「This reference only captures the initial value」。

```ts
// ✗ 會觸發警告
this.sort = page.url.searchParams.get("sort") ?? "name";

// ✓ untrack 讀取當下值，不建立追蹤
this.sort = untrack(() => page.url.searchParams.get("sort") ?? "name");
```

### URL 參數的就近讀取

URL 參數由**需要讀取的 class 就近讀取**，不透過 options 或 props 傳入。每個 class 直接 import `page` from `$app/state` 並讀取所需的參數。

---

## Debounce

### 輸入 Debounce

只有**連續輸入**（如搜尋框）才需要 debounce。一般離散操作（select、checkbox、按鈕）不需要。

連續輸入存在競態：debounce 到期 → `goto()` 送出 → 使用者在 URL 同步回來前又輸入了新值。使用 `dirty` flag 區分 source of truth，**`dirty` 在 `$effect` 中必須以 `untrack` 讀取**：

```ts
export class SearchForm {
  dirty = $state(false);
  search = $state("");
  timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.search = untrack(() => page.url.searchParams.get("q") ?? "");

    $effect(() => {
      const q = page.url.searchParams.get("q") ?? "";
      // dirty 以 untrack 讀取——避免 dirty 本身的變動觸發 $effect 重跑
      if (untrack(() => this.dirty)) return;
      this.search = q;
    });
  }

  // ---

  handleInput = (e: Event) => {
    this.search = (e.target as HTMLInputElement).value;
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.dirty = false;
      goto(`/search?q=${encodeURIComponent(this.search)}`, {
        replaceState: true, noScroll: true, keepFocus: true,
      });
    }, 300);
  };
}
```

時序：

1. 使用者輸入 → `dirty = true`，本地狀態更新
2. Debounce 到期 → `goto()` 送出 → `dirty = false`
3. `$effect` 偵測到 URL 變動：
   - `dirty === false` → 正常同步
   - `dirty === true` → 跳過（使用者又輸入了新值）

### 載入 Debounce

使用 CSS-only 方案避免短暫導航的載入閃爍。

→ 詳見 [css.md](./css.md) 的「載入 Debounce」

---

## 允許的 API

| API        | 用途                                 |
| ---------- | ------------------------------------ |
| `$state`   | 宣告可變響應式狀態                   |
| `$derived` | 從既有響應式來源衍生唯讀值           |
| `$effect`  | 監聯外部來源變動，同步回本地狀態     |
| `untrack`  | 讀取響應式狀態的當下值，但不建立追蹤 |

不使用的 API：

- `afterNavigate`——狀態同步一律使用 `$effect`
- `createContext` / `setContext` / `getContext`——所有路由的子元件只有一到兩層深度，props / bind 足以覆蓋所有跨元件共享需求

---

## 頁面級共享狀態

當頁面有多個 class 需要共享狀態時，有兩種做法：

### 1. Hub Class

建立一個專門管理共享狀態的 class（如 `TaggerPage`、`EditorPage`），其他 class 透過 options getter/setter 連接它的 `$state`：

```ts
// taggerPage.svelte.ts
export class TaggerPage {
  currentFile = $state<string | null>(null);
  selectedFiles = $state<Set<string>>(new Set());
  progress = $state(0);

  constructor(private options: { stagedFiles: string[] }) {
    // SSR 資料同步 reconciliation
    $effect(() => {
      const list = options.stagedFiles;
      if (this.currentFile && !list.includes(this.currentFile)) {
        this.currentFile = list[0] ?? null;
      }
      // ... 清理 selectedFiles ...
    });
  }
}
```

### 2. Cross-class Callback

`options` callback 讓 class 之間能在不直接引用彼此的情況下協調：

```svelte
<script lang="ts">
  const preview = new TaggerPreview({
    get currentFile() { return pg.currentFile; },
    onChangeImage: () => zp.handleContainerReset(),
  });
</script>
```

### 3. 共享非響應式引用

Timer ID、AbortController 等**非響應式**協調物件，在 `+page.svelte` 建立普通物件以 prop 傳入即可（JS pass-by-reference）：

```svelte
<script lang="ts">
  const refs = {
    timer: null as ReturnType<typeof setTimeout> | null,
    controller: null as AbortController | null,
  };

  const classA = new ClassA({ refs });
  const classB = new ClassB({ refs });
</script>
```

---

## Effect-only Class

有些 class 只有 constructor + `$effect`，不暴露 handler——純粹用於副作用管理：

```ts
export class PlayerAutoHide {
  visible = $state(true);

  constructor(private options: { timeout: number }) {
    $effect(() => {
      const onMove = () => { this.visible = true; /* reset timer */ };
      window.addEventListener("mousemove", onMove);
      return () => window.removeEventListener("mousemove", onMove);
    });
  }
}
```

即使內部只有一個 `$effect`，封裝成 class 也為這段邏輯提供了清晰的邊界和可搜尋的名稱。

---

## Derived-only Class

有些 class 只有 `$derived`，不包含 `$state` 或 handler——純計算 class：

```ts
export class TaggerProgress {
  total: number;
  progressPct: number;
  progressLabel: string;

  constructor(private options: { stagedFiles: string[]; progress: number }) {
    this.total = $derived(options.stagedFiles.length);
    this.progressPct = $derived(
      this.total > 0 ? (options.progress / this.total) * 100 : 0
    );
    this.progressLabel = $derived(`${options.progress} / ${this.total}`);
  }
}
```

這種 class 的價值在於：集中管理相關的衍生運算，給予它一個名稱，並讓 template 能以 `progress.progressPct` 清晰地讀取。
