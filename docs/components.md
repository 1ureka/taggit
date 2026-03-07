# Components & Page 開發規範

> 本章節定義了專案的元件開發規範與頁面組織架構，確保團隊在構建 UI 時保持一致性、可維護性與清晰的職責分工。

---

## 一、架構概覽

本專案的 UI 開發圍繞兩個核心規則：

1. **每個有 UI 表現的元件，都必須拆為一對檔案**：`*.svelte`（結構 + 樣式）與 `*.svelte.ts`（無頭 UI 邏輯）。
2. **每個路由，無論多麼簡單，`+page.svelte` 都至少委託一個子元件**——頁面層只做資料接收、context 注入、子元件組裝。

---

## 二、共用元件（N + 1）

### 2.1 概覽

| 元件                  | Svelte 封裝                                     | 無頭 UI                                                    | 說明                                      |
| --------------------- | ----------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------- |
| `Autocomplete`        | `src/lib/components/Autocomplete.svelte`        | `src/lib/client/autocomplete.svelte.ts`                    | 多標籤輸入，含下拉補全                    |
| `AutocompleteCompact` | `src/lib/components/AutocompleteCompact.svelte` | `src/lib/client/autocomplete.svelte.ts` + `menu.svelte.ts` | 緊湊版，多餘標籤收入 overflow popover     |
| `Select`              | `src/lib/components/Select.svelte`              | `src/lib/client/select.svelte.ts`                          | 單選下拉選單，保有已選狀態                |
| `Rating`              | `src/lib/components/Rating.svelte`              | `src/lib/client/rating.svelte.ts`                          | 五星評分，支援唯讀模式                    |
| `createMenu`          | **（無 Svelte 封裝）**                          | `src/lib/client/menu.svelte.ts`                            | 純無頭 UI 選單，用於一次性操作 / 導航收納 |

「N + 1」中的 **1** 即 `createMenu`——它僅提供無頭 UI factory，沒有對應的 `.svelte` 封裝元件，消費者需自行在目標元件的模板中組裝觸發器與項目清單。`AutocompleteCompact` 即是一個直接消費 `createMenu` 的例子。

---

### 2.2 Autocomplete

**Props**

| Prop          | 型別                | 預設值          | 說明                                       |
| ------------- | ------------------- | --------------- | ------------------------------------------ |
| `tags`        | `string[]`          | `[]`            | `$bindable`：目前選中的標籤                |
| `placeholder` | `string`            | `"輸入標籤..."` | 輸入框佔位符                               |
| `variant`     | `"top" \| "inline"` | `"top"`         | 版面配置，`"inline"` 使 chip 與 input 同行 |
| `onenter`     | `() => void`        | —               | 空輸入按 Enter 時觸發（例：提交）          |
| `onchange`    | `() => void`        | —               | 標籤新增或移除時觸發                       |

> **注意**：緊湊版請改用 `AutocompleteCompact`，後者額外支援 `maxVisible` 限制可見 chip 數量。

**用法範例**

```svelte
<Autocomplete
  bind:tags={ui.tags}
  variant="top"
  placeholder="添加標籤..."
  onchange={ui.handleTagChange}
/>
```

---

### 2.3 Select

**Props**

| Prop       | 型別                            | 預設值      | 說明                              |
| ---------- | ------------------------------- | ----------- | --------------------------------- |
| `value`    | `string \| number \| undefined` | `undefined` | `$bindable`：目前選中值           |
| `options`  | `SelectItem[]`                  | `[]`        | 選項列表，`{ value, label }` 格式 |
| `size`     | `"sm" \| "md"`                  | `"sm"`      | 按鈕尺寸                          |
| `stretch`  | `boolean`                       | `false`     | 是否撐滿容器寬度                  |
| `onchange` | `() => void`                    | —           | 選項變更時觸發                    |

**用法範例**

```svelte
<Select
  bind:value={ui.sort}
  options={ui.sortOptions}
  size="md"
  stretch
/>
```

---

### 2.4 Rating

**Props**

| Prop       | 型別                  | 預設值      | 說明                         |
| ---------- | --------------------- | ----------- | ---------------------------- |
| `value`    | `number`              | `0`         | `$bindable`：0–5，0 = 未評分 |
| `size`     | `string`              | `"1.25rem"` | 星號大小（CSS rem 長度字串） |
| `readonly` | `boolean`             | `false`     | 唯讀模式（純展示，不可互動） |
| `onchange` | `(v: number) => void` | —           | 分數變更時觸發               |

**用法範例**

```svelte
<!-- 互動模式 -->
<Rating bind:value={ui.rating} size="1.5rem" onchange={ui.handleRatingChange} />

<!-- 唯讀展示 -->
<Rating value={item.rating} readonly />
```

---

### 2.5 createMenu（純無頭 UI）

`createMenu` 不提供任何 UI，呼叫者需自行渲染觸發器與選單項目，並將 factory 回傳的事件處理器綁到對應的 DOM 元素上。

**配置選項**

| 選項               | 型別             | 說明                                              |
| ------------------ | ---------------- | ------------------------------------------------- |
| `list`             | `MenuItem[]`     | 選單項目（`{ value, label }`），支援響應式 getter |
| `onselect`         | `(item) => void` | 使用者選取項目時觸發（不保存狀態）                |
| `disableAutoClose` | `boolean`        | 選取後是否不自動關閉（預設 `false`，即自動關閉）  |

**與 Select 的差異**

`createSelect` 保存「目前已選中值」狀態；`createMenu` **不保存**選取狀態，適合導航跳轉、一次性操作收納等場景。

**使用範例（inline，不另開元件）**

```svelte
<script lang="ts">
  import { createMenu } from "$lib/client/menu.svelte.js";

  const menu = createMenu({
    list: [
      { value: "edit", label: "編輯" },
      { value: "delete", label: "刪除" },
    ],
    onselect: (item) => console.log(item.value),
  });
</script>

<button
  bind:this={menu.triggerEl}
  onclick={menu.handleTriggerClick}
  onblur={menu.handleTriggerBlur}
  onkeydown={menu.handleTriggerKeydown}
>
  操作
</button>

{#if menu.open}
  <div role="listbox">
    {#each menu.list as item, i}
      <button
        role="option"
        class:active={i === menu.activeIndex}
        aria-selected={i === menu.activeIndex}
        onmousedown={(e) => menu.handleItemMouseDown(e, item)}
        onmouseenter={() => menu.handleItemMouseEnter(i)}
      >
        {item.label}
      </button>
    {/each}
  </div>
{/if}
```

---

## 三、Page 開發規範

### 3.1 職責分工

| 層級     | 檔案                                               | 職責                                                            |
| -------- | -------------------------------------------------- | --------------------------------------------------------------- |
| SSR 資料 | `+page.server.ts`                                  | 查詢資料庫，回傳 `data` 物件；**不含任何 UI 邏輯**              |
| 頁面殼   | `+page.svelte`                                     | 接收 `data`、初始化 context（若需要）、組裝子元件並傳入初始資料 |
| 子元件   | `ComponentName.svelte` + `componentName.svelte.ts` | 負責該頁面的所有 UI 邏輯與樣式                                  |

### 3.2 規則

- `+page.svelte` **不含業務邏輯、樣式規則只允許布局上的**，僅做「接收 → 分發」。
- 即便頁面極其簡單（僅一個表單），仍須將 UI 抽出為至少一個子元件。
- 若跨元件需要共享響應式狀態，於 `+page.svelte` 呼叫 `setMyContext(new MyContext())` 注入，子元件以 `getMyContext()` 取用，詳見 [context.md](./context.md)。

### 3.3 範例（`/browse` 路由）

```
src/routes/browse/
├── +page.server.ts   ← SSR：預查總數，回傳 { initialCount }
├── +page.svelte      ← 接收 data，傳入 <Form>，僅有 <main> 殼層樣式
├── Form.svelte       ← 篩選表單 UI（結構 + 樣式）
└── form.svelte.ts    ← 表單邏輯（無頭 UI）
```

**`+page.server.ts`**

```ts
// SSR: 以預設篩選條件預查總數，免去頁面載入後的第一次 client 查詢
export const load: PageServerLoad = () => {
  const db = getDB();
  const result = queryImages(db, { limit: 1 });
  return { initialCount: result.total };
};
```

**`+page.svelte`**

```svelte
<script lang="ts">
  import type { PageData } from "./$types.js";
  import Form from "./Form.svelte";

  let { data }: { data: PageData } = $props();
</script>

<main class="page">
  <Form matchCount={data.initialCount} />
</main>

<style>
  main.page {
    height: 100vh;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }
</style>
```

`+page.svelte` 除了 `<main>` 的殼層樣式外，業務邏輯全在 `Form.svelte` / `form.svelte.ts` 中。

---

## 四、元件開發規範

### 4.1 檔案結構

每個元件恰好由**兩個檔案**組成：

```
ComponentName.svelte       ← 結構 + 樣式（<template> + <style>）
componentName.svelte.ts    ← 無頭 UI（純邏輯，不含任何 HTML/CSS）
```

**不推薦**將樣式單獨提取為 `.css` 檔案——元件的 `<style>` 塊已自帶 scoped 作用域，與結構並存更易維護。

### 4.2 無頭 UI（`*.svelte.ts`）

無頭 UI 以**工廠函數**（`createXxx`）形式撰寫，遵循以下模式：

1. **接收 `options` 物件**，其中雙向綁定的 prop 需暴露為 getter/setter pair（以承接 Svelte 5 的 reactive proxy）；callbacks 直接放在 options 中。
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

### 4.3 Svelte 封裝（`*.svelte`）

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

### 4.4 參考實作

- **`autocomplete.svelte.ts`**（`src/lib/client/autocomplete.svelte.ts`）：完整展示 `$state`、`$derived.by`、多個 handler、開關選單生命週期、響應式 getter/setter options 傳遞的最佳範例。
- **`select.svelte.ts`**（`src/lib/client/select.svelte.ts`）：展示 `activeIndex` 虛擬聚焦、鍵盤導航完整實作（Tab / Arrow / Enter / Space / Escape）、以及 blur → closeDropdown 的焦點管理模式。

---

## 五、快速對照表

| 情境                            | 應放在哪裡                               |
| ------------------------------- | ---------------------------------------- |
| 資料庫查詢、SSR 初始資料        | `+page.server.ts`                        |
| context 注入（`setMyContext`）  | `+page.svelte`（`<script>` 頂層）        |
| 子元件組裝、初始資料傳遞        | `+page.svelte`                           |
| 元件 UI 結構、scoped 樣式       | `ComponentName.svelte`                   |
| 元件響應式邏輯、事件處理        | `componentName.svelte.ts`                |
| 跨元件共享狀態                  | context（見 [context.md](./context.md)） |
| 一次性操作 / 導航收納的選單邏輯 | `createMenu`（`menu.svelte.ts`）         |
| 保有已選狀態的下拉選單          | `createSelect` / `<Select>`              |
