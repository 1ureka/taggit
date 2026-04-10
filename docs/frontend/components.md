# Components

> 共用組件（`src/lib/components/`）是跨頁面復用的 UI 單元，維持 `.svelte` + `.svelte.ts` 雙檔案結構。

---

## 職責

共用組件提供**可復用的 UI 機制**——Rating、Autocomplete、Modal、Select 等。每個組件有明確的 props 介面，可以在任何頁面中以 import 使用，與使用原生 HTML 元素無異。

共用組件分為兩個資料夾：

| 資料夾               | 內容                         | 範例                                    |
| -------------------- | ---------------------------- | --------------------------------------- |
| `src/lib/components/` | `.svelte` 檔案（template）   | `Rating.svelte`、`Modal.svelte`         |
| `src/lib/ui/`         | `.svelte.ts` 檔案（互動邏輯）| `rating.svelte.ts`、`modal.svelte.ts`   |

並非所有組件都有對應的 `.svelte.ts`：

- **純展示組件**：只有 `.svelte`，不需要互動邏輯（如 `Alert.svelte`、`Tags.svelte`）
- **純邏輯模組**：只有 `.svelte.ts`，不需要對應 template（如 `zoom-pan.svelte.ts`）——由頁面直接消費
- **完整組件**：`.svelte` + `.svelte.ts` 配對（如 `Rating`、`Autocomplete`、`Select`、`Modal`）

---

## 何時適用

**是共用組件的情境：**

- 在兩個以上的頁面中使用
- 有獨立的 props 介面與 scoped 樣式
- 提供可復用的 UI 機制（如 dropdown、rating、modal）

**不是共用組件的情境：**

- 只在一個頁面出現的 HTML 結構 → HTML 歸 `+page.svelte`、邏輯歸 `*.svelte.ts`
- 頁面特有的互動邏輯 → 同路由目錄下的 `*.svelte.ts`

**開發前先檢視 `src/lib/components/` 和 `src/lib/ui/`**，避免重複建造已存在的組件。

---

## Pattern 與組織

### 雙檔案結構

含有互動邏輯的組件由兩個檔案組成：

```
src/lib/components/Rating.svelte       ← 結構 + 樣式
src/lib/ui/rating.svelte.ts            ← 互動邏輯（export class Rating）
```

若組件完全沒有 handler、`$state`、`$derived` 或 `$effect`（純展示），只需 `.svelte` 一個檔案。

### `.svelte` 的 Script：僅做實例化

當所有邏輯都收進 class 之後，`.svelte` 的 `<script>` 只剩 props 解構與 class 實例化：

```svelte
<script lang="ts">
  import { Rating as RatingUI } from "$lib/ui/rating.svelte.js";

  type Props = {
    name?: string;
    value: number;
    size?: string;
    readonly?: boolean;
    onchange?: (v: number) => void;
  };

  let {
    name, value = $bindable(0), size = "1.25rem",
    readonly = false, onchange,
  }: Props = $props();

  const ui = new RatingUI({
    get value() { return value; },
    set value(v) { value = v; },
    get onchange() { return onchange; },
    get readonly() { return readonly; },
  });
</script>
```

模板中只使用 `ui.*` 存取狀態與 handler。

→ Class 的內部結構詳見 [ui.md](./ui.md)

### Props 與 Options 的橋接

組件的 Props 透過 options 物件傳入 class。三種存取模式：

| Props 性質           | Options 寫法                                                   |
| -------------------- | -------------------------------------------------------------- |
| 可 bind 的值         | `get value() { return value; }, set value(v) { value = v; }`  |
| 唯讀值               | `get items() { return items; }`                               |
| Callback             | `onchange: () => onchange?.()`                                |

`$bindable` 的 prop 在 options 中以 getter+setter 傳入，讓 class 能響應式地讀寫。

→ Options pattern 詳見 [ui.md](./ui.md)

### 機制與策略分離

設計組件的 props 介面時，區分：

- **機制（mechanism）**：組件之所以存在的核心——移除後組件無法運作
- **策略（policy）**：呼叫者注入的具體行為——移除後組件的核心機制仍可獨立運作

**判斷方法：如果移除這個 prop，組件的核心機制還能運作嗎？** 若能，它就是策略，應透過 callback 或 Svelte snippet 交由呼叫者注入。

```svelte
<!-- ✗ 組件不該接收它不消費的 props -->
<ListComponent {items} {itemHeight} {selectedIds} {onItemClick} />

<!-- ✓ 機制歸組件，策略歸呼叫者 -->
<ListComponent {items} {itemHeight}>
  {#snippet renderItem(item)}
    <div class:selected={selectedIds.has(item.id)} onclick={() => onItemClick(item)}>
      {item.name}
    </div>
  {/snippet}
</ListComponent>
```

專案中的主要範例：

| 組件      | 機制                         | 策略（由呼叫者注入）            |
| --------- | ---------------------------- | ------------------------------- |
| `Modal`   | overlay、focus trap、轉場動畫 | `children` snippet（內容區域）  |
| `ImageList` | 虛擬滾動、鍵盤導航          | `onClickItem` callback（選取行為）|
| `Rating`  | 星星互動、鍵盤操作           | `onchange` callback（值變更後的行為）|

### Custom CSS Properties（元件級變數）

組件可以暴露 CSS custom properties 供外部覆寫，實現主題化而不破壞封裝：

```svelte
<!-- Rating.svelte -->
<style>
  .rating {
    color: var(--rating-color, var(--text-dim));
  }
  .rating-star.bright {
    color: var(--rating-color-active, var(--color-warning));
  }
</style>
```

外部透過容器的 `style` 覆寫：

```svelte
<div style="--rating-color-active: red">
  <Rating bind:value={form.rating} />
</div>
```

元件內部使用 `--_` 前綴（底線前綴）標示私有 CSS 變數，與公開的覆寫點區隔：

```svelte
<div style="--_size: {size}; --_bg: {bg}">...</div>

<style>
  div { width: var(--_size); background: var(--_bg); }
</style>
```

### 全域 Class 的使用

組件的 template 中可以直接使用全域原子 class（`.chip`、`.text-input`、`.btn-*` 等），組件的 scoped `<style>` 只負責佈局與組合：

```svelte
<!-- Autocomplete.svelte -->
<input class="text-input" ... />
<button class="chip chip-removable">...</button>

<style>
  /* scoped style 只管佈局，不重造基礎外觀 */
  .autocomplete { display: flex; flex-wrap: wrap; gap: 0.25rem; }
</style>
```

→ 全域原子 class 的完整列表詳見 [css.md](./css.md)

### Scoped 樣式

組件的樣式寫在 `<style>` 區塊中（scoped），不另外提取 `.css` 檔案。命名以結構角色為主，不需要 BEM 或命名空間前綴——Svelte scope 天然隔離。

→ 選擇器策略詳見 [css.md](./css.md)

---

## 專案中的共用組件一覽

### Template 組件（`src/lib/components/`）

| 組件             | 類型     | 用途                           |
| ---------------- | -------- | ------------------------------ |
| `Alert`          | 純展示   | 型別化的警告橫幅               |
| `Autocomplete`   | 完整     | 標籤輸入 + 自動完成下拉        |
| `ConfirmModal`   | 完整     | 全域確認對話框（event-bus 驅動）|
| `FilterFields`   | 協調     | 篩選表單（組合其他組件）       |
| `ImageList`      | 完整     | 虛擬化可選列表                 |
| `InverseRadius`  | 純展示   | 凹圓角裝飾效果                 |
| `Modal`          | 完整     | 通用 Modal（focus trap、轉場） |
| `Rating`         | 完整     | 星級評分（互動 + 唯讀模式）    |
| `ScrollButton`   | 完整     | 滾動置頂浮動按鈕               |
| `Select`         | 完整     | 自訂下拉選擇                   |
| `Tags`           | 純展示   | 唯讀標籤列表                   |
| `Toast`          | 完整     | 堆疊通知（event-bus 驅動）     |

### 無頭 UI（`src/lib/ui/`）

| 模組                   | 用途                        | 配對組件           |
| ---------------------- | --------------------------- | ------------------ |
| `autocomplete.svelte.ts` | 標籤篩選、鍵盤導航、下拉    | `Autocomplete`     |
| `confirmModal.svelte.ts` | 確認 Promise、event 監聽    | `ConfirmModal`     |
| `modal.svelte.ts`       | Focus trap、Escape 關閉      | `Modal`            |
| `rating.svelte.ts`      | 星星互動、hover 預覽、鍵盤   | `Rating`           |
| `scrollButton.svelte.ts`| 滾動方向偵測、顯示/隱藏     | `ScrollButton`     |
| `select.svelte.ts`      | 下拉開關、鍵盤導航、選取     | `Select`           |
| `toast.svelte.ts`       | Toast 堆疊、計時、動畫       | `Toast`            |
| `zoom-pan.svelte.ts`    | 縮放平移、拖曳、鍵盤操作     | （無，頁面直接消費）|
