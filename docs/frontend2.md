# Frontend 開發規範

> 本文件定義了專案的前端架構、元件開發規範與 Page 組織方式，確保 UI 開發保持一致性、可維護性與清晰的職責分工。

---

## 一、檔案職責與 API 限制

### 1.1 檔案角色

| 檔案                  | 職責                                                                                     |
| --------------------- | ---------------------------------------------------------------------------------------- |
| `+page.server.ts`     | 查詢資料庫、組裝 `data`                                                                  |
| `+page.svelte`        | 接收 `data`、共享狀態、組裝子元件、佈局。不得包含事件處理、UI 衍生計算或模板內的業務判斷 |
| `Component.svelte`    | 子元件結構與樣式，props 解構與無頭 UI class 實例化，模板只使用 `ui.*`                    |
| `component.svelte.ts` | 無頭 UI，以 `export class` 管理狀態與邏輯                                                |

即便頁面極其簡單（僅一個表單），仍須將 UI 抽出為至少一個子元件。

### 1.2 允許的 API

狀態管理只使用以下四個 API：

| API        | 用途                                 |
| ---------- | ------------------------------------ |
| `$state`   | 宣告可變響應式狀態                   |
| `$derived` | 從既有響應式來源衍生唯讀值           |
| `$effect`  | 監聽外部來源變動，同步回本地狀態     |
| `untrack`  | 讀取響應式狀態的當下值，但不建立追蹤 |

### 1.3 禁用的 API

- `afterNavigate`——狀態同步一律使用 `$effect`
- `createContext` / `setContext` / `getContext`（見 [§3.3](#33-不使用-context-api)）

### 1.4 `$state` 的宣告位置

`$state` 只允許出現在兩個地方：

1. **`+page.svelte`**——跨子元件共享的狀態
2. **無頭 UI class（`*.svelte.ts`）**——僅該元件使用的狀態

**不得**在子元件的 `.svelte` 檔案中宣告 `$state`。`$derived` 若涉及運算邏輯也應收進無頭 UI，`.svelte` 中的 `$derived` 僅限直覺的一行式轉換。

---

## 二、本地狀態

本章只處理最簡單的情境：**一個元件自己的狀態**，不來自外部、不需要與其他元件共享。

### 2.1 雙檔案結構

含有互動邏輯的元件由兩個檔案組成：

```
Component.svelte          ← 結構 + 樣式
component.svelte.ts       ← 互動邏輯
```

若元件完全沒有 handler、`$state`、`$derived` 或 `$effect`（純展示），只需 `.svelte` 一個檔案。反之，若一段可重用邏輯不需要對應的 template（如選單定位、鍵盤導航），也可只有 `.svelte.ts`。

### 2.2 無頭 UI class

無頭 UI 以 `export class` 撰寫。`.svelte` 中直接 `new` 取得 instance：

```ts
// component.svelte.ts

/**
 * Component 的配置選項
 */
type ComponentOptions = {
  /** 選項列表 */
  items: string[];
};

/**
 * Component 的無頭 UI
 */
export class Component {
  /** 下拉選單是否開啟 */
  open = $state(false);
  /** 目前聚焦的選項索引 */
  activeIndex = $state(-1);

  /** 過濾後的選項列表 */
  filtered: string[];

  constructor(private options: ComponentOptions) {
    this.filtered = $derived(options.items.filter((item) => item.length > 0));
  }

  // ---

  /** 開啟選單 */
  #openMenu() {
    this.open = true;
    this.activeIndex = 0;
  }

  /** 關閉選單並重置聚焦索引 */
  #closeMenu() {
    this.open = false;
    this.activeIndex = -1;
  }

  // ---

  /** 處理按鈕點擊事件，切換選單開關 */
  handleButtonClick = () => {
    if (this.open) this.#closeMenu();
    else this.#openMenu();
  };

  /** 處理按鈕失焦事件，關閉選單 */
  handleButtonBlur = () => {
    this.#closeMenu();
  };

  // ---

  /** 處理選項滑鼠按下事件，阻止失焦並選取 */
  handleItemMouseDown = (e: MouseEvent) => {
    e.preventDefault();
  };

  /** 處理選項滑鼠移入事件，更新聚焦索引 */
  handleItemMouseEnter = (index: number) => {
    this.activeIndex = index;
  };
}
```

#### 結構說明

- `$state` 宣告為 class field，`$derived` 的型別宣告在 field 區域、賦值在 constructor 內。
- `$effect` 若有需要，寫在 constructor 內，位於 `$derived` 下方。
- class 內部以 `// ---` 作為唯一的視覺分隔符。
- Private helper 以 `#methodName()` 宣告（private method）。
- Handler 以 `handleXxx = () => {}` 宣告（公開箭頭屬性），命名結構為 `handle` + 目標元素 + 事件類型。
- 同一目標元素的 handler 連續排列，不加分隔；不同目標元素之間以 `// ---` 分隔。
- 排列順序：① `$state` fields → ② `$derived` fields → ③ constructor → ④ 常數 → ⑤ private helpers → ⑥ handlers。

### 2.3 `.svelte` 的 `<script>` 只做實例化

當所有邏輯都收進無頭 UI 後，`.svelte` 的 `<script>` 只剩 props 解構與 class 實例化，模板只使用 `ui.*`：

```svelte
<!-- Component.svelte -->
<script lang="ts">
  import { Component } from "./component.svelte.js";

  type Props = { items: string[] };
  let { items }: Props = $props();

  const ui = new Component({
    get items() { return items; },
  });
</script>

<button onclick={ui.handleButtonClick} onblur={ui.handleButtonBlur}>
  {ui.open ? "Close" : "Open"}
</button>

{#if ui.open}
  <ul>
    {#each ui.filtered as item, i}
      <li
        class:active={ui.activeIndex === i}
        onmousedown={ui.handleItemMouseDown}
        onmouseenter={() => ui.handleItemMouseEnter(i)}
      >
        {item}
      </li>
    {/each}
  </ul>
{/if}

<style>
  .active { background: var(--color-surface-hover); }
</style>
```

模板中不應出現任何業務判斷或脫離 `ui` 的狀態計算。樣式直接寫在 `<style>` 塊中（scoped），不另外提取 `.css` 檔案。

### 2.4 共用元件

專案的共用元件也遵循上述雙檔案結構，分別放在兩個資料夾：

- `src/lib/components/`——`.svelte` 檔案
- `src/lib/ui/`——`.svelte.ts` 檔案

**開發新功能前，先檢視這兩個資料夾**，避免重複建造已存在的元件，並且注意：

- 部分共用元件是純展示，沒有對應的 `.svelte.ts`，比如 `Alert.svelte`
- 部分是獨立的無頭 UI，沒有對應的 `.svelte`，比如 `menu.svelte.ts`

---

## 三、共享狀態

當多個子元件需要共享狀態時，`+page.svelte` 作為**唯一的**狀態持有者，透過 `props` 向下傳遞、`bind` 向上回寫。

### 3.1 基本模式

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import Child1 from "./Child1.svelte";
  import Child2 from "./Child2.svelte";

  let selected = $state<Set<string>>(new Set());
</script>

<Child1 bind:selected />
<Child2 bind:selected />
```

```svelte
<!-- Child1.svelte -->
<script lang="ts">
  import { Child1 } from "./child1.svelte.js";

  type Props = { selected: Set<string> };
  let { selected = $bindable(new Set()) }: Props = $props();

  const ui = new Child1({
    get selected() { return selected; },
    set selected(v) { selected = v; },
  });
</script>
```

```ts
// child1.svelte.ts

/**
 * Child1 的配置選項
 */
type Child1Options = {
  /** 雙向綁定：目前選取的項目 */
  selected: Set<string>;
};

/**
 * Child1 的無頭 UI
 */
export class Child1 {
  constructor(private options: Child1Options) {}

  // ---

  /** 處理項目點擊事件，切換選取狀態 */
  handleItemClick = (id: string) => {
    const next = new Set(this.options.selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.options.selected = next;
  };
}
```

### 3.2 Options 的三種屬性

Options 物件的屬性分三種類型，在 `.svelte` 實例化時以不同寫法傳入：

| 類型      | 存取需求   | 傳入寫法                                                     |
| --------- | ---------- | ------------------------------------------------------------ |
| 雙向綁定  | 需要讀寫   | `get value() { return value; }, set value(v) { value = v; }` |
| 唯讀 prop | 只需讀取   | `get items() { return items; }`                              |
| Callback  | 通知父元件 | `onchange: () => onchange?.()`                               |

Options 使用 getter 傳入，Svelte 的 rune 系統能正確追蹤 getter 的回傳值。因此 class 內部任何地方讀 `this.options.items` 都能響應式地取得最新值，不需要再包 `$state` 副本。

### 3.3 不使用 Context API

本專案所有路由的子元件皆只有一到兩層深度（不計共用元件），`props` / `bind` 足以覆蓋所有跨元件共享需求。資料流只有一個 pattern：**props 向下、`bind` 向上、getter/setter options 傳入無頭 UI**。

### 3.4 共享非響應式引用

若多個子元件需要共享的是 timer ID、AbortController 等**非響應式**協調物件，在 `+page.svelte` 建立普通物件，以 prop 傳下去即可。JS 物件是 pass-by-reference，所有子元件操作的是同一塊記憶體：

```svelte
<!-- +page.svelte -->
<script lang="ts">
  const refs = {
    timer: null as ReturnType<typeof setTimeout> | null,
    controller: null as AbortController | null,
  };
</script>

<Child1 {refs} />
<Child2 {refs} />
```

### 3.5 機制與策略分離

當元件的 props 列表膨脹時，通常代表它混入了不屬於核心職責的邏輯。區分方式：

- **機制（mechanism）**：元件之所以存在的核心——移除後元件無法運作。
- **策略（policy）**：呼叫者注入的具體行為——移除後元件的核心機制仍可獨立運作。

**判斷方法：「如果移除這個 prop，元件的核心機制還能運作嗎？」** 若能，它就是策略，應透過 callback 或 Svelte snippet 交由呼叫者注入：

```svelte
<!-- ✗ ListComponent 不該接收它不消費的 props -->
<ListComponent {items} {itemHeight} {selectedIds} {onItemClick} />

<!-- ✓ 機制歸元件，策略歸呼叫者 -->
<ListComponent {items} {itemHeight}>
  {#snippet renderItem(item)}
    <div class:selected={selectedIds.has(item.id)} onclick={() => onItemClick(item)}>
      {item.name}
    </div>
  {/snippet}
</ListComponent>
```

### 3.6 Prop Drilling 處理

當遇到 prop drilling 時，依序嘗試：

1. **提取成 URL query**——讓子元件直接從 `page.url.searchParams` 讀取（見[第五章](#五url-狀態)）
2. **重新審視元件介面**——以 callback / snippet 重構，將策略交還呼叫者（見 [§3.5](#35-機制與策略分離)）
3. **拆分路由結構**——將該路由拆成子路由，或重新組織子元件
4. **提取共用元件**——減少心智上的層級認知

---

## 四、SSR 狀態

`+page.server.ts` 回傳的 `data` 是一個 read-only reactive object。`+page.svelte` 透過 `$props()` 接收後，直接以 props 傳給子元件。`goto()` 或 `invalidateAll()` 導致 `load` 重跑時，props 自動更新，子元件響應式重繪。

**命名慣例：** SSR 資料變數使用純粹的名稱（如 `items`、`total`、`count`），不得使用 `initial`、`preload` 等前綴。

### 4.1 唯讀

**如果沒有「寫」的需求，直接透過 props 使用就好**，不需要 `$state`、`$effect` 或 `untrack`：

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import Child1 from "./Child1.svelte";
  import Child2 from "./Child2.svelte";

  let { data } = $props();
</script>

<Child1 items={data.items} />
<Child2 total={data.total} />
```

子元件的無頭 UI 透過 options getter 讀取，響應式自動連動：

```ts
// child1.svelte.ts
export class Child1 {
  /** 已篩選的項目數量 */
  count: number;

  constructor(private options: { items: Item[] }) {
    this.count = $derived(this.options.items.filter((i) => i.active).length);
  }
}
```

### 4.2 需要寫

當元件需要**編輯** SSR 資料的本地副本（如表單編輯、選取狀態），才需要這個模式。

#### 問題

`$state()` 初始化器中若直接讀取 reactive proxy，Svelte 會建立不必要的追蹤關係，且後續 `data` 更新時 `$state` 不會連動：

```ts
// ✗ Svelte 警告：This reference only captures the initial value
let name = $state(data.name);
```

這導致 `$state` 想避開警告，只能初始化為空值，從而 SSR 輸出的第一幀就是錯的

#### 解法

`untrack` 讓 `$state` 讀到外部來源的當下值但不建立追蹤，再由 `$effect` 負責後續同步：

```ts
// child2.svelte.ts

/**
 * Child2 的配置選項
 */
type Child2Options = {
  /** 唯讀：項目資料 */
  item: Item;
};

/**
 * Child2 的無頭 UI
 */
export class Child2 {
  /** 項目名稱（可編輯的本地副本） */
  name = $state("");
  /** 項目標籤（可編輯的本地副本） */
  tags = $state<string[]>([]);

  constructor(private options: Child2Options) {
    // untrack 提供正確的 SSR 初始值
    this.name = untrack(() => options.item.name);
    this.tags = untrack(() => [...options.item.tags]);

    // $effect 負責後續同步（goto / invalidateAll 導致 data 變動時）
    $effect(() => {
      this.name = options.item.name;
      this.tags = [...options.item.tags];
    });
  }

  // ---

  /** 處理名稱輸入事件 */
  handleNameInput = (e: Event) => {
    this.name = (e.target as HTMLInputElement).value;
  };
}
```

`$state` 從第一幀就帶正確值，`$effect` 只負責後續的增量同步。

#### 複雜場景——多狀態交叉校正

當 `data` 變動需要同時調整多個狀態時（如列表增減後調整選取），`$effect` 內進行 reconciliation：

```svelte
<!-- +page.svelte -->
<script lang="ts">
  let { data } = $props();

  let current = $state<string | null>(untrack(() => data.items[0]?.id ?? null));
  let selected = $state<Set<string>>(untrack(() => {
    const first = data.items[0];
    return first ? new Set([first.id]) : new Set();
  }));

  $effect(() => {
    const list = data.items;

    // N => N'（列表變動但未清空）
    if (current !== null && list.length > 0) {
      if (!list.some((i) => i.id === current)) current = list[0].id;
      const next = new Set([...selected].filter((id) => list.some((i) => i.id === id)));
      if (next.size === 0) selected = new Set([current]);
      else if (next.size !== selected.size) selected = next;
      return;
    }

    // 0 => N（從空到有）
    if (current === null && list.length > 0) {
      current = list[0].id;
      selected = new Set([list[0].id]);
      return;
    }

    // N => 0（清空）
    if (current !== null && list.length <= 0) {
      current = null;
      selected = new Set();
      return;
    }
  });
</script>

<Child1 items={data.items} bind:current bind:selected />
<Child2 bind:selected />
```

`$effect` 內的 reconciliation 邏輯依實際需求設計，但初始值一律由 `untrack` 提供。

### 4.3 就近原則

若同一份 SSR 資料有多個消費者，**只有需要「寫」的元件才走 `$state` + `untrack` + `$effect`**，其餘元件直接透過 props 原封不動使用即可：

```svelte
<!-- +page.svelte -->
<script lang="ts">
  let { data } = $props();
</script>

<!-- 唯讀：直接用 props -->
<Display item={data.item} />
<Summary item={data.item} />

<!-- 需要寫：元件內部才建立 $state 副本 -->
<Editor item={data.item} />
```

Display、Summary 的無頭 UI 直接從 `options.item`（getter）讀取即可；只有 Editor 需要建立可寫副本：

```ts
// editor.svelte.ts
import { invalidateAll } from "$app/navigation";
import { untrack } from "svelte";

// ... (略)

export class Editor {
  /** 項目名稱（可編輯的本地副本） */
  name = $state("");

  constructor(private options: EditorOptions) {
    this.name = untrack(() => options.item.name);

    $effect(() => {
      this.name = options.item.name;
    });
  }

  // ---

  /** 處理名稱輸入事件 */
  handleNameInput = (e: Event) => {
    this.name = (e.target as HTMLInputElement).value;
  };

  /** 處理儲存按鈕點擊事件，將修改寫回伺服器 */
  handleFormSubmit = async () => {
    await api.post("/update-item", { id: this.options.item.id, name: this.name });
    invalidateAll();
  };
}
```

#### 核心概念

`$effect` 若用於同步外部來源，應宣告在**消費該狀態的位置**：

- 頁面級共享狀態的 `$effect` → 寫在 `+page.svelte`
- 無頭 UI 內部狀態的 `$effect` → 寫在 `*.svelte.ts` 的 class constructor 內

---

## 五、URL 狀態

URL query params（`page.url.searchParams`）是另一種 read-only reactive source，概念上與 SSR `data` 相同——唯讀直接用，需要寫才走 `$state` + `untrack` + `$effect`。

差異在於：URL 參數由**需要讀取的元件就近讀取**，不透過上層以 props 傳入。

### 5.1 唯讀

直接在 `.svelte` 或 `.svelte.ts` 中從 `page.url.searchParams` 讀取：

```svelte
<!-- Component.svelte -->
<script lang="ts">
  import { page } from "$app/state";

  const tab = $derived(page.url.searchParams.get("tab") ?? "default");
</script>

<div class:active={tab === "settings"}>...</div>
```

### 5.2 需要寫

與 SSR 狀態相同的模式——`$state(untrack(...))` + `$effect`，只是來源改為 `page.url.searchParams`。使用 `goto()` 更新 URL：

```ts
// component.svelte.ts
import { page } from "$app/state";
import { goto } from "$app/navigation";
import { untrack } from "svelte";

/**
 * Component 的無頭 UI
 */
export class Component {
  /** 目前排序方式 */
  sort = $state("");

  constructor() {
    this.sort = untrack(() => page.url.searchParams.get("sort") ?? "name");

    $effect(() => {
      const q = page.url.searchParams.get("sort") ?? "name";
      this.sort = q;
    });
  }

  // ---

  /** 處理排序按鈕點擊事件，更新排序方式並同步至 URL */
  handleSortClick = (value: string) => {
    this.sort = value;
    goto(`/list?sort=${encodeURIComponent(this.sort)}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  };
}
```

使用 `goto()` 時，三個選項 `{ replaceState, noScroll, keepFocus }` 確保 URL 更新不干擾使用者體驗。

---

## 六、Debounce

### 6.1 輸入 debounce

> 注意，只有**連續輸入**（如搜尋框）才需要 debounce。一般的離散選擇操作（select、checkbox、按鈕）不需要。

連續輸入存在一個競態：debounce 到期 → `goto()` 送出 → 使用者在 URL 同步回來前又輸入了新值。使用 `dirty` flag 區分 source of truth。**`dirty` 在 `$effect` 中必須以 `untrack` 讀取**——否則 `dirty` 本身的變動會觸發 `$effect` 重跑：

```ts
// searchForm.svelte.ts
import { page } from "$app/state";
import { goto } from "$app/navigation";
import { untrack } from "svelte";

/**
 * SearchForm 的無頭 UI
 */
export class SearchForm {
  /** URL 同步鎖：本地正在修改時為 true，跳過外部同步 */
  dirty = $state(false);
  /** 搜尋關鍵字 */
  search = $state("");
  /** debounce 計時器 */
  timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.search = untrack(() => page.url.searchParams.get("q") ?? "");

    $effect(() => {
      const q = page.url.searchParams.get("q") ?? "";
      if (untrack(() => this.dirty)) return;
      this.search = q;
    });
  }

  // ---

  /** 處理輸入框輸入事件，啟動 debounce 計時 */
  handleInput = (e: Event) => {
    this.search = (e.target as HTMLInputElement).value;
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.dirty = false;
      goto(`/search?q=${encodeURIComponent(this.search)}`, {
        replaceState: true,
        noScroll: true,
        keepFocus: true,
      });
    }, 300);
  };
}
```

#### 時序

1. 使用者輸入 → `dirty = true`，本地狀態更新
2. debounce 到期 → `goto()` 送出 → 立刻 `dirty = false`
3. `$effect` 偵測到 URL 變動：
   - `dirty === false` → 正常同步
   - `dirty === true` → 跳過（使用者又輸入了新值，舊值不該覆蓋）

#### 為什麼 `dirty` 要用 `untrack`？

若 `$effect` 追蹤 `dirty`，當 `dirty` 從 `true` 變為 `false`（`goto()` 送出後）時 `$effect` 會立刻重跑——但此時 `goto()` 是非同步的，URL 尚未更新，`$effect` 會把舊值同步回本地，覆蓋使用者的新輸入。`untrack` 確保 `$effect` 只在外部來源真正變動時才觸發。

### 6.2 載入 debounce

使用者觸發導航（`goto()` / `invalidateAll()`）時，若立刻顯示載入狀態，快速完成的導航（< 200ms）會造成閃爍。

這時請採用**純 CSS `transition-delay`** 實現載入提示的 debounce，零 JavaScript 開銷：

```svelte
<script lang="ts">
  import { navigating } from "$app/state";
</script>

<div class="container" style:opacity={navigating.to ? 0.4 : 1}>
  <!-- 正常內容 -->
</div>

<style>
  .container {
    transition: opacity 0s step-end 0.2s;
  }
</style>
```

#### transition 的三個值

| 值         | 意義                         |
| ---------- | ---------------------------- |
| `0s`       | duration——瞬間跳變，不做漸變 |
| `step-end` | timing function——離散跳變    |
| `0.2s`     | delay——變化延遲 200ms 才生效 |

#### 免 JavaScript 的原理

若導航在 200ms 內完成，`opacity` 已回到 `1`，瀏覽器自動取消尚未生效的 pending transition——不需要任何 JavaScript 清理，天然無競態。

最後，此模式不限於 `navigating`——任何布林旗標驅動的暫態視覺回饋（如 API 呼叫中的 `loading`）都適用，只要希望「短暫切換不產生視覺變化、長時間停留才顯示」。
