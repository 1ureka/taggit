# Report 3：FilterBar 及其依賴元件的 HTML 結構與屬性分析

> 範圍：`FilterBar.svelte`、`Select.svelte`（+ `select.svelte.ts`）、`Autocomplete.svelte`（+ `autocomplete.svelte.ts`）
>
> 前提：Select / Autocomplete 的選項下拉是**純 JS 控制**，聚焦從頭到尾停留在同一元素（Select 的 trigger `<button>`、Autocomplete 的 `<input>`）。選項不可聚焦、不參與 Tab 序列。

---

## 一、Select 元件

### 1.1 現況結構

```html
<!-- trigger -->
<button type="button" class="select-trigger" ...>
  <span class="select-label">{label}</span>
  <span class="select-chevron">▼</span>
</button>

<!-- popover -->
<div class="popover" role="listbox">
  <button type="button" class="select-option"
    role="option" aria-selected={...}> ... </button>
</div>
```

### 1.2 問題

| # | 問題 | 說明 |
|---|---|---|
| S1 | **Trigger 缺少 `role="combobox"`** | 聚焦停留在 trigger 上而用方向鍵導航選項——這是 ARIA combobox pattern。Trigger 應宣告 `role="combobox"` 讓輔助技術理解「這個按鈕控制一個列表」。 |
| S2 | **Trigger 缺少 `aria-haspopup="listbox"`** | 告知輔助技術「此元素會打開一個 listbox」。 |
| S3 | **Trigger 缺少 `aria-expanded`** | 需要 `aria-expanded={ui.open}` 來告知輔助技術下拉選單是否展開。 |
| S4 | **Trigger 缺少 `aria-activedescendant`** | 聚焦不離開 trigger，但虛擬聚焦在選項間移動。應透過 `aria-activedescendant` 指向目前高亮的選項 ID，讓螢幕閱讀器跟蹤虛擬聚焦。 |
| S5 | **Listbox 容器缺少 `id`** | 需要一個 `id` 讓 trigger 的 `aria-controls` 指向它。 |
| S6 | **選項 `<button>` 缺少 `id`** | 每個 option 需要唯一 `id`，供 `aria-activedescendant` 引用。 |
| S7 | **選項用 `<button>` 語意衝突** | `role="option"` 的元素不應該是 `<button>`——option 不是一個可操作的按鈕，它是列表中的一個選項。使用 `<div role="option">` 即可（已有 `onmousedown` 處理互動）。 |
| S8 | **Trigger 缺少 `aria-controls`** | 應指向 listbox 容器的 `id`，建立 trigger 與 listbox 的程式化關聯。 |

### 1.3 建議結構

```html
<button
  type="button"
  role="combobox"
  aria-haspopup="listbox"
  aria-expanded={ui.open}
  aria-controls="select-{uid}-listbox"
  aria-activedescendant={ui.activeIndex >= 0 ? `select-{uid}-opt-${ui.activeIndex}` : undefined}
>
  ...
</button>

<div
  id="select-{uid}-listbox"
  role="listbox"
>
  {#each options as opt, i}
    <div
      id="select-{uid}-opt-{i}"
      role="option"
      aria-selected={opt.value === value}
    >
      {opt.label}
    </div>
  {/each}
</div>
```

### 1.4 UID 生成策略

每個 `createSelect()` 呼叫時需要一個唯一 ID。可用簡易遞增計數器：

```ts
let nextId = 0;
export function createSelect(options: SelectOptions) {
  const uid = `sel-${nextId++}`;
  // ...
}
```

或者使用 Svelte 內建的 `$.id()` (Svelte 5.20+)。前者更簡單且跨版本相容。

---

## 二、Autocomplete 元件

### 2.1 現況結構

```html
<div class="autocomplete">
  <!-- chips -->
  <div class="chip-list">
    <button type="button" class="chip"> tag <IconX/> </button>
  </div>

  <!-- input -->
  <input class="text-input" autocomplete="off" ... />

  <!-- popover -->
  <div class="popover">
    <div class="autocomplete-item" role="option" tabindex="-1" aria-selected={...}>
      ...
    </div>
  </div>
</div>
```

### 2.2 問題

| # | 問題 | 說明 |
|---|---|---|
| A1 | **`<input>` 缺少 `role="combobox"`** | 輸入框控制一個下拉候選列表——這是 combobox pattern。 |
| A2 | **`<input>` 缺少 `aria-haspopup="listbox"`** | 告知輔助技術存在候選列表。 |
| A3 | **`<input>` 缺少 `aria-expanded`** | 需要 `aria-expanded={ui.showDropdown && ui.dropdownTags.length > 0}` 來反映下拉選單狀態。 |
| A4 | **`<input>` 缺少 `aria-activedescendant`** | 虛擬聚焦移動時應指向高亮選項的 `id`。 |
| A5 | **`<input>` 缺少 `aria-controls`** | 應指向 listbox 容器的 `id`。 |
| A6 | **Popover 容器缺少 `role="listbox"` 和 `id`** | `role="option"` 在子元素上，但父容器缺少 `role="listbox"`。 |
| A7 | **選項 `<div>` 不應有 `tabindex="-1"`** | 選項不可聚焦（聚焦始終在 input 上），`tabindex="-1"` 使它可被程式聚焦但這裡不需要。移除即可。 |
| A8 | **選項缺少 `id`** | 同 Select，需要 `id` 供 `aria-activedescendant` 引用。 |
| A9 | **Chip 的 `<button>` 缺少 `aria-label`** | `<button>` 的文本是 tag 名 + IconX，螢幕閱讀器可能不清楚用途。建議 `aria-label="移除標籤 {tag}"`。 |

### 2.3 建議結構

```html
<div class="autocomplete">
  <div class="chip-list">
    <button type="button" class="chip" aria-label="移除標籤 {tag}">
      {tag}<IconX/>
    </button>
  </div>

  <input
    role="combobox"
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls="ac-{uid}-listbox"
    aria-activedescendant={activeIndex >= 0 ? `ac-{uid}-opt-${activeIndex}` : undefined}
    autocomplete="off"
  />

  <div id="ac-{uid}-listbox" role="listbox">
    {#each dropdownTags as tag, i}
      <div
        id="ac-{uid}-opt-{i}"
        role="option"
        aria-selected={i === activeIndex}
      >
        ...
      </div>
    {/each}
  </div>
</div>
```

---

## 三、FilterBar 元件

### 3.1 現況結構

```html
<div class="filter-bar">
  <Autocomplete ... />
  <div class="filter-controls">
    <span class="filter-label">評分</span>
    <Select ... />
    <Select ... />
    <span class="filter-label">排序</span>
    <Select ... />
    <Select ... />
  </div>
</div>
```

### 3.2 問題

| # | 問題 | 說明 |
|---|---|---|
| F1 | **外層容器缺少 `role="search"` 或 `role="group"`** | FilterBar 是一組篩選控制項的聚合。無論呼叫者是否用 `<form>` 包裝，FilterBar 自身應有 `role="group"` 或 `role="search"` 配合 `aria-label`，讓輔助技術將其識別為一個邏輯分組。建議 `role="group"` + `aria-label="篩選條件"`，因為 `role="search"` 更適合有明確搜尋按鈕的情境。 |
| F2 | **Label 與 Select 缺少程式化關聯** | `<span class="filter-label">評分</span>` 後面跟著兩個 `<Select>`，但 label 與 select 之間沒有 `id` / `aria-labelledby` 的關聯。螢幕閱讀器聚焦 Select trigger 時，不知道它代表什麼。 |
| F3 | **Autocomplete 缺少可見 label** | Autocomplete 使用 `placeholder` 作為唯一提示，但 placeholder 在輸入後消失，且不被所有輔助技術視為 label。需要 `aria-label` 或外部 `<label>`。 |

### 3.3 Label 關聯策略

FilterBar 內的 label 是 `<span>`，不是 `<label>`，且 Select 的 trigger 是 `<button>` 而非 `<input>`——`<label for>` 不適用於 button。正確方式是 `aria-labelledby`：

```html
<span id="filter-label-rating" class="filter-label">評分</span>
<Select aria-labelledby="filter-label-rating" ... />  <!-- ratingOp -->
<Select aria-labelledby="filter-label-rating" ... />  <!-- rating value -->
```

**實作方式**：

1. FilterBar 為每個 label `<span>` 加上 `id`
2. Select 元件新增 optional prop `labelledby?: string`
3. Select trigger 上加 `aria-labelledby={labelledby}`

如果認為不需要將 label id 傳入 Select 依舊可以在應用端以 `aria-labelledby` 直接加在 `<Select>` 組件上，但由於 Svelte 預設不會將未宣告的 props 自動展開到根元素（不像 React 的 spread），所以需要 Select 元件主動接收並套用此屬性。

### 3.4 建議結構

```html
<div class="filter-bar" role="group" aria-label="篩選條件">
  <Autocomplete ... aria-label="篩選標籤" />

  <div class="filter-controls">
    <span id="fl-rating" class="filter-label">評分</span>
    <Select ... labelledby="fl-rating" />
    <Select ... labelledby="fl-rating" />

    <span id="fl-sort" class="filter-label">排序</span>
    <Select ... labelledby="fl-sort" />
    <Select ... labelledby="fl-sort" />
  </div>
</div>
```

### 3.5 補充方案：使用 `<fieldset>` + `<legend>` 取代手動 ARIA

`<fieldset>` 是 HTML 原生的「相關控制項分組」元素，搭配 `<legend>` 可自動提供群組標題語意，不需要手動用 `id` / `aria-labelledby` 串接。且不依賴是否被 `<form>` 包裝。

```html
<div class="filter-bar" role="group" aria-label="篩選條件">
  <Autocomplete ... aria-label="篩選標籤" />

  <div class="filter-controls">
    <fieldset class="filter-fieldset">
      <legend class="filter-legend">評分</legend>
      <Select ... />
      <Select ... />
    </fieldset>

    <fieldset class="filter-fieldset">
      <legend class="filter-legend">排序</legend>
      <Select ... />
      <Select ... />
    </fieldset>
  </div>
</div>
```

此方案相比 §3.4 的優勢：

- **不需要為 label 生成 `id`**，也不需要 Select 新增 `labelledby` prop
- **`<legend>` 會被螢幕閱讀器自動宣告為群組標題**，語意更原生
- 總程式碼量更少，不涉及 Select 元件的修改

**⚠️ 注意：需要覆蓋 `<fieldset>` 的預設樣式。** 瀏覽器對 `<fieldset>` 有 `border`、`padding`、`margin`、`min-inline-size: min-content` 等預設樣式，必須 reset：

```css
.filter-fieldset {
  border: none;
  padding: 0;
  margin: 0;
  min-inline-size: 0;
}
```

若 `.filter-controls` 繼續使用 grid 佈局，`<fieldset>` 作為 grid item 可能需要配合 `display: contents` 讓 legend 與 Select 直接參與父級 grid，或改為每個 fieldset 自身是一個 sub-grid / flex 容器。需視最終佈局結構決定。

---

## 四、總覽：需修改的檔案

| 元件 | `.svelte` 修改 | `.svelte.ts` 修改 |
|---|---|---|
| **Select** | trigger 加 `role="combobox"`, `aria-*` 屬性；option 改 `<div>`；新增 `labelledby` prop | 新增 `uid` 生成；return 暴露 `uid`、`listboxId`、`activeOptionId` |
| **Autocomplete** | input 加 `role="combobox"`, `aria-*`；popover 加 `role="listbox"`, `id`；option 移除 `tabindex`；chip 加 `aria-label` | 新增 `uid` 生成；return 暴露 `uid`、`listboxId`、`activeOptionId` |
| **FilterBar** | 外層 div 加 `role="group"`, `aria-label`；label span 加 `id`；Select 傳入 `labelledby` | 無（FilterBar 無 `.svelte.ts`） |

注意：AutocompleteCompact 也使用相同的 `createAutocomplete`，其模板中的問題與 Autocomplete 完全相同（缺少 `role`, `aria-*`, option 多餘 `tabindex`），需同步修正。

---

## 五、注意事項

1. **`aria-activedescendant` 的條件性**：當 `activeIndex` 為 `-1`（無高亮）時，`aria-activedescendant` 應為 `undefined`（不渲染該屬性），而非空字串。空字串會被輔助技術視為指向一個不存在的元素。

2. **UID 唯一性**：模組級計數器（`let nextId = 0`）在 SSR 環境中每次請求會重置，但因為 ARIA ID 只在 client-side DOM 中有意義，這不構成問題。若使用 Svelte 5.20+ 的 `$.id()` 則可自動處理 SSR hydration 的 ID 匹對。

3. **FilterBar 的 label ID 唯一性**：如果頁面上同時存在多個 FilterBar 實例（目前不會），硬編碼的 `id="fl-rating"` 等會衝突。目前每個頁面只有一個 FilterBar，所以可以接受。若日後需要多實例，可改為由 FilterBar 內部生成 UID 前綴。

4. **FilterBar 不需要 `.svelte.ts`**：FilterBar 仍然是純展示/組裝元件，沒有 handler、`$state`、`$derived` 或 `$effect`，不需要拆出無頭 UI。新增的 `role`、`aria-*`、`id` 都是靜態屬性，不涉及互動邏輯。
