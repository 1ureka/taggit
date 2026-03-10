# Frontend 開發規範

> 本文件定義了專案的前端架構、元件開發規範與 Page 組織方式，確保 UI 開發保持一致性、可維護性與清晰的職責分工。

---

## 一、架構與 Page 組織

本專案的 UI 開發圍繞兩個核心規則：

1. **每個含有互動邏輯的元件，都必須拆為一對檔案**：`*.svelte`（結構 + 樣式）與 `*.svelte.ts`（無頭 UI 邏輯）。
2. **每個路由，無論多麼簡單，`+page.svelte` 都至少委託一個子元件**——頁面層只做資料接收、狀態初始化、子元件組裝。

### 1.1 `+page.server.ts` — SSR 資料

負責查詢資料庫、組裝回傳的 `data` 物件。**不含任何 UI 邏輯。**

命名慣例：SSR 的資料變數不得使用 `initial`, `preload` 等詞彙，應使用純粹的名稱，如 `total`, `count`, `items` 等。

### 1.2 `+page.svelte` — 頁面殼

接收 `data`、初始化頁面級 `$state`（若需要）、組裝子元件並以 props 傳入資料。

**規則：**

- **不含業務邏輯**。樣式規則只允許布局上的（如 `<main>` 的 height、overflow）。
- 即便頁面極其簡單（僅一個表單），仍須將 UI 抽出為至少一個子元件。
- SSR `data` **透過 props 傳給子元件**，不額外中轉。`data` 是 `$props()` 的一部分，Svelte 自動追蹤其變更——`goto()` 或 `invalidateAll()` 導致 `load` 重跑後，props 自動更新，子元件響應式重繪。

**跨元件共享狀態：**

若多個子元件需要共享響應式狀態（如 `selected`），在 `+page.svelte` 中以 `$state` 宣告，再透過 props / `bind` 傳給子元件。

```svelte
<script lang="ts">
  let { data } = $props();
  let selected = $state<Set<string>>(new Set());
</script>

<EditorList items={data.result.items} bind:selected />
<EditorSelectionDock bind:selected />
```

**不在組件中使用 `$state`：**

不應該在 `+page.svelte` 以外的任意 `.svelte` 中宣告 `$state`——狀態只能是頁面級（`+page.svelte`）或無頭 UI（`*.svelte.ts`）的，絕不應該在其他 `.svelte` 中宣告 `$state`。

**不使用 Context（`createContext`）：**

本專案所有路由的子元件皆只有一到兩層深度（不計共用元件），props / `bind` 足以覆蓋所有跨元件共享需求。不使用 Svelte 的 `createContext` API——狀態只有兩種歸屬：

1. **`+page.svelte` 的 `$state`**——跨元件共享的狀態（透過 props / `bind` 傳遞）
2. **無頭 UI 內部的 `$state`**——僅該元件使用的狀態

這使得資料流永遠只有一個 pattern：**props 向下、`bind` 向上、getter/setter options 傳入無頭 UI**。

當開發者真的遇到 prop drilling 時，請先嘗試下列三種方案:

1. 提取成 url query（如 `?tab=xxx`），讓子元件從 `$page.url.searchParams` 讀取
2. 將該路由本身拆成多個子路由，或重新組織路由結構的各個子組件
3. 提取出新的共用元件，從而在心智上不再認為多一層級

若你是 AI Agent，請注意，當你注意到你需要執行這三種方案之一，甚至是完全無法解決 prop drilling 時，請停止目前的開發，並向人類開發者提出「我遇到了 prop drilling 問題，已嘗試以下方案但無法解決：...，請協助重新組織路由結構或提取共用元件」的訊息。

### 1.3 子元件 — `ComponentName.svelte` + `componentName.svelte.ts`

負責該頁面區塊的所有 UI 邏輯與樣式。詳見第二章元件開發規範。

**無頭 UI 如何接收 props：**

子元件把 `$props()` 解構出的值透過 getter-based options 傳給工廠函數，確保無頭 UI 讀到最新的 prop 值：

```svelte
<!-- EditorList.svelte -->
<script lang="ts">
  type Props = { items: ImageWithId[]; selected: Set<string>; /* ... */ };
  let { items, selected = $bindable(), /* ... */ }: Props = $props();

  const ui = createEditorList({
    get items() { return items; },
    get selected() { return selected; },
    set selected(v) { selected = v; },
  });
</script>
```

---

## 二、元件開發規範

### 2.1 檔案結構

含有互動邏輯的元件由**兩個檔案**組成：

```
ComponentName.svelte       ← 結構 + 樣式（<template> + <style>）
componentName.svelte.ts    ← 無頭 UI（純邏輯，不含任何 HTML/CSS）
```

**例外**：若元件完全沒有 handler、`$state`、`$derived` 或 `$effect`（純展示），只需 `*.svelte` 一個檔案即可。

**不推薦**將樣式單獨提取為 `.css` 檔案——元件的 `<style>` 塊已自帶 scoped 作用域，與結構並存更易維護。

### 2.2 無頭 UI（`*.svelte.ts`）

無頭 UI 以**工廠函數**（`createXxx`）形式撰寫，遵循以下模式：

1. **接收 `options` 物件**，其中雙向綁定的 prop 在外部傳入時要用 getter/setter 包裝，以確保無頭 UI 內部讀取到的永遠是最新值。
2. **以 `$state` / `$derived` 管理內部狀態**，工廠函數頂層即可直接使用 runes（因副檔名為 `.svelte.ts`）。
3. **回傳 `ui` 物件**，僅暴露 `.svelte` 需要用到的：
   - 狀態以 getter 形式暴露（必要時附 setter）
   - 事件處理一律以 `handle*` 命名

**工廠函數模式骨幹**

```ts
// componentName.svelte.ts
type ComponentOptions = {
  value: string; // 雙向綁定的值
  onchange?: (v: string) => void; // callback
};

export function createComponent(options: ComponentOptions) {
  let internalState = $state(false);

  function handleSomethingClick() {
    internalState = !internalState;
    options.onchange?.(options.value);
  }

  return {
    get internalState() {
      return internalState;
    },
    handleSomethingClick,
  };
}
```

### 2.3 Svelte 封裝（`*.svelte`）

`.svelte` 的 `<script>` 只做兩件事：

1. 宣告 `Props` 型別並以 `$props()` 解構
2. 呼叫工廠函數，將 bindable props 以 getter/setter proxy 傳入

**雙向綁定的傳入慣例**

```svelte
<script lang="ts">
  type Props = { value?: string; onchange?: () => void };
  let { value = $bindable(""), onchange }: Props = $props();

  const ui = createComponent({
    onchange: () => onchange?.(),
    get value() { return value; },
    set value(v) { value = v; },
  });
</script>
```

之後模板只需使用 `ui.*` 即可，不應在模板中加入任何業務判斷或脫離 `ui` 的狀態計算。

### 2.4 Handlers

永遠不得直接 return helper function，就算只包一層，也應該要包好後再 return：

```ts
function handleSomethingClick() {
    someHelper();
}
```

### 2.5 Handler 命名規範

Handler 一律採 `handle` + `目標元素` + `事件類型` 結構：

| Handler                      | 目標元素    | 事件類型         |
| ---------------------------- | ----------- | ---------------- |
| `handleInput`                | input       | input            |
| `handleInputFocus`           | input       | focus            |
| `handleInputBlur`            | input       | blur             |
| `handleInputKeydown`         | input       | keydown          |
| `handleChipClick`            | chip        | click            |
| `handleDropdownMouseDown`    | dropdown    | mousedown        |
| `handleDropdownMouseOver`    | dropdown    | mouseover        |
| `handleTriggerClick`         | trigger     | click            |
| `handleTriggerBlur`          | trigger     | blur             |
| `handleTriggerKeydown`       | trigger     | keydown          |
| `handleOptionMouseDown`      | option      | mousedown        |
| `handleOptionMouseEnter`     | option      | mouseenter       |
| `handleItemMouseDown`        | item        | mousedown        |
| `handleItemMouseEnter`       | item        | mouseenter       |
| `handleStarMouseEnter`       | star        | mouseenter       |
| `handleStarClick`            | star        | click            |
| `handleContainerMouseLeave`  | container   | mouseleave       |
| `handleContainerKeydown`     | container   | keydown          |

### 2.6 程式碼編排

工廠函數內部以 `// ---` 作為視覺段落分隔符，依固定順序排列：

```ts
export function createXxx(options: XxxOptions) {
  // ① $state 宣告（含 JSDoc）
  let stateA = $state(...);
  let stateB = $state(...);

  // ② $derived 宣告（含 JSDoc）
  const derivedC = $derived(...);

  // ---

  // ③ 常數（如 options 列表）
  const OPTIONS = [...];

  // ---

  // ④ Private helper functions（不回傳的內部函式）
  function doSomething() { /* ... */ }
  function openDropdown() { /* ... */ }
  function closeDropdown() { /* ... */ }

  // ---

  // ⑤ Handler functions（按目標元素分組，組間以 // --- 分隔）
  function handleTriggerClick() { /* ... */ }
  function handleTriggerBlur() { /* ... */ }
  function handleTriggerKeydown(e: KeyboardEvent) { /* ... */ }

  // ---

  function handleOptionMouseDown(e: MouseEvent, item: SelectItem) { /* ... */ }
  function handleOptionMouseEnter(index: number) { /* ... */ }

  // ---

  // ⑤ 可選: $effect（如有需要，放在 handler 之後）

  // ---

  // ⑥ Return 物件（getter/setter 在前，handler 在後）
  return {
    // DOM ref getter/setter
    get triggerEl() { ... },
    set triggerEl(el) { ... },

    // 狀態 getter
    get open() { ... },
    get activeIndex() { ... },
    get selectedLabel() { ... },

    // Handler references
    handleTriggerClick,
    handleTriggerBlur,
    handleTriggerKeydown,
    handleOptionMouseDown,
    handleOptionMouseEnter,
  };
}
```

**要點：**
- `// ---` 是唯一使用的分隔符，不使用 `// ===` 或 `// ───` 等其他變體。
- 同一目標元素的 handler 不加分隔符（如 `handleTriggerClick` / `handleTriggerBlur` / `handleTriggerKeydown` 連續排列）。
- 不同目標元素的 handler 之間以 `// ---` 分隔。
- return 物件中：先 DOM ref getter/setter，再狀態 getter，最後 handler reference（與定義順序一致）。

### 2.7 JSDoc 寫法

所有無頭 UI（`*.svelte.ts`）都遵循統一的 JSDoc 寫法。

**Type 定義**

- Type alias（無屬性）使用**單行** JSDoc：

```ts
/** 排序欄位類型 */
type Sort = "committedAt" | "rating" | "name" | "random";
```

- Options type 與 factory function 使用**多行** JSDoc：

```ts
/**
 * 下拉選單組件的配置選項
 */
type SelectOptions = {
  /** 雙向綁定：目前選中的值 */
  value: string | number | undefined;
  /** 選項列表 */
  list: SelectItem[];
  /** 當選項變更時觸發的回調 */
  onchange?: (value: string | number | undefined) => void;
};

/**
 * 建立下拉選單邏輯的核心工廠函數
 */
export function createSelect(options: SelectOptions) {
```

Options 屬性一律**單行** JSDoc。雙向綁定的屬性以 `/** 雙向綁定：描述 */` 開頭。

**`$state` / `$derived` 宣告**

每個 `$state` 或 `$derived` 變數上方加**單行** JSDoc：

```ts
/** 觸發器按鈕實例的引用 (DOM) */
let triggerEl = $state<HTMLButtonElement>();
/** 下拉選單是否開啟 */
let open = $state(false);
/** 下拉選單中目前「虛擬聯焦」的選項索引 */
let activeIndex = $state(-1);

/** 根據目前 options.value 找到對應的 label */
const selectedLabel = $derived(options.list.find((item) => item.value === options.value)?.label ?? "");
```

**Private helper functions**

使用**單行** JSDoc 描述行為：

```ts
/** 執行選取動作 */
function selectOption(item: SelectItem) { /* ... */ }

/** 開啟選單，預設虛擬聚焦到當前已選中的那一個，若無則為 -1 */
function openDropdown() { /* ... */ }

/** 關閉選單，重置虛擬聚焦索引 */
function closeDropdown() { /* ... */ }
```

**Handler functions**

使用**單行** JSDoc，格式為 `處理 [目標元素] [事件類型]事件，[具體行為]`：

```ts
/** 處理 Trigger 點擊事件，切換下拉選單的開啟/關閉狀態 */
function handleTriggerClick() { /* ... */ }

/** 處理 Trigger 失焦事件，關閉下拉選單 */
function handleTriggerBlur() { /* ... */ }

/** 處理 Trigger 鍵盤事件，根據按鍵執行相應操作 */
function handleTriggerKeydown(e: KeyboardEvent) { /* ... */ }
```

鍵盤 handler 內部的各 branch 也以單行 JSDoc 標註：

```ts
function handleInputKeydown(e: KeyboardEvent) {
  /** 當按下 Escape 鍵且下拉選單顯示時，關閉下拉選單 */
  if (e.key === "Escape" && showDropdown) {
    closeDropdown();
    return;
  }

  /** 當按下 Backspace 鍵且輸入框為空時，刪除最後一個標籤 */
  if (e.key === "Backspace" && !inputValue) {
    popTag();
    return;
  }
}
```

**Return 物件**

return 物件中的每個成員都**重複**其定義處的同一份 JSDoc（不省略）：

```ts
return {
  /** 獲取 Trigger 元素的 getter */
  get triggerEl() {
    return triggerEl as HTMLButtonElement;
  },
  /** 設定 Trigger 元素 setter */
  set triggerEl(el: HTMLButtonElement) {
    triggerEl = el;
  },

  /** 存取下拉選單狀態的 getter */
  get open() {
    return open;
  },
  /** 存取虛擬聚焦索引的 getter */
  get activeIndex() {
    return activeIndex;
  },

  /** 處理 Trigger 點擊事件，切換下拉選單的開啟/關閉狀態 */
  handleTriggerClick,
  /** 處理 Trigger 失焦事件，關閉下拉選單 */
  handleTriggerBlur,
  /** 處理 Trigger 鍵盤事件，根據按鍵執行相應操作 */
  handleTriggerKeydown,
};
```

getter JSDoc 慣用語：`獲取 XXX 的 getter` 或 `存取 XXX 的 getter`。
setter JSDoc 慣用語：`設定 XXX 的 setter` 或 `設置 XXX 的 setter`。

---

## 三、共用元件

所有共用元件都被放置於 `src/lib/components` 與 `src/lib/ui` 兩個資料夾中，前者為上述規範中的 `*.svelte` ，後者為 `*.svelte.ts` 無頭 UI 工廠函數

其中有些 `*.svelte` 是屬於上述規範中，無互動需求的純展示或容器，他們沒有對應的 `*.svelte.ts` 在 `src/lib/ui` 中；同理，有些無頭 UI 工廠函數沒有對應的 `.svelte`，比如 `src/lib/ui/menu.svelte.ts` 的 `createMenu`。

因此任何新功能或大更新時，都必須完整 `ls` 這兩個資料夾，避免重複造出已存在的元件或工廠函數。
