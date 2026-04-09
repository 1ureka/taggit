# Popover 元件化重構方案

> 將 Select 與 Autocomplete 的下拉面板抽為獨立的 `Popover` 共用元件，以原生 `popover=manual` + Svelte 5 transition 取代現行的全域 `.popover` CSS + `use:float` portal。

---

## 1. 現行架構的問題

### 1.1 全域 `.popover` class

`app-basic.css` 中的 `.popover` 同時承載了三個職責：

| 職責       | 實作                                          |
| ---------- | --------------------------------------------- |
| 外觀       | `background`、`border`、`border-radius`、`box-shadow`、`padding` |
| 定位       | `position: fixed`、`z-index: var(--z-popover)`                  |
| 開關動畫   | `opacity`、`transform`、`pointer-events` + `data-open` + CSS transition |

三者綁在同一個 class 上，無法獨立變動。新增一種下拉動畫、調整最大高度、或改變定位策略都需要修改全域 CSS。

### 1.2 `use:float` action

`float.ts` 同樣混合了多個職責：

1. **Portal**——`document.body.appendChild(node)` 將元素搬到 body
2. **定位**——`@floating-ui/dom` 的 `computePosition` + `autoUpdate`
3. **開關狀態**——`node.dataset.open = "true" / "false"`

Portal 操作繞過 Svelte 的 DOM 管理，Svelte 不知道元素被搬走了；`data-open` 狀態控制與 CSS transition 配合，但 JS 無法感知動畫結束時機。

### 1.3 內容永遠存在

現行架構中，下拉選項在元件 mount 時就渲染至 DOM——無論使用者是否打開過選單。

---

## 2. 提案：`Popover` 共用元件

### 2.1 核心設計

建立一個獨立的 `Popover` 共用元件，遵循專案的 Template vs UI 雙檔案結構：

```
src/lib/components/Popover.svelte      ← 結構 + scoped 樣式
src/lib/ui/popover.svelte.ts           ← 互動邏輯（export class Popover）
```

`Popover` 的職責清晰且單一：

- **Portal**——原生 `popover=manual`（top layer）
- **定位**——`@floating-ui/dom`（保留，成熟且跨瀏覽器）
- **動畫**——Svelte transition + `onoutroend` 生命週期
- **惰性渲染**——`{#if}` 控制內容的 mount / unmount

消費端（Select、Autocomplete）只關心「開」與「關」，`Popover` 處理所有 portal、定位、動畫細節。

### 2.2 元素結構

```
┌──────────────────────────────────────────────────┐
│  <div popover="manual">            ← 永遠存在    │
│    作用：原生 top layer = portal                   │
│                                                  │
│    {#if open}                      ← 惰性渲染    │
│      <div transition:slide>        ← Svelte 動畫  │
│        {@render children()}        ← 消費端注入   │
│      </div>                                      │
│    {/if}                                         │
│                                                  │
│  </div>                                          │
└──────────────────────────────────────────────────┘
```

**三個關鍵角色：**

| 角色               | 元素                    | 說明                                         |
| ------------------ | ----------------------- | -------------------------------------------- |
| **容器（portal）** | `<div popover="manual">` | 永遠存在於 DOM，原生 top layer 實現 portal    |
| **邏輯狀態**       | `open` prop              | 由消費端傳入的開關狀態                        |
| **內容（策略）**   | `children` snippet       | 消費端注入的選項列表                          |

### 2.3 開關時序

#### 開啟（同步、立即）

```
消費端 open=true → showPopover() + {#if} 渲染 → intro 動畫開始
```

#### 關閉（延遲、等待 outro 結束）

```
消費端 open=false → outro 動畫開始（popover 仍可見）
                  → onoutroend → hidePopover() + {#if} 移除
```

關閉時，`open` prop 立即變為 `false`，但 `hidePopover()` **延遲到 outro 動畫結束**才呼叫。這確保出場動畫能完整播放。

### 2.4 快速開關與 transition 生命週期

Svelte 的 transition 生命週期天然處理快速開關：

| 情境                             | Svelte 行為                                     | `hidePopover()` 狀態                   |
| -------------------------------- | ----------------------------------------------- | -------------------------------------- |
| Outro 中斷（關閉後立即重新開啟） | 取消 outro → 開始 intro，`outroend` **不觸發**  | 不呼叫（正確：popover 應保持可見）     |
| Intro 中斷（開啟後立即關閉）     | 取消 intro → 開始 outro，`outroend` **最終觸發** | 呼叫（正確：popover 應隱藏）           |

中斷的 outro 不觸發 end 事件，中斷的 intro 會自然轉入 outro 流程。不存在 race condition。

---

## 3. 元件介面設計

### 3.1 `Popover.svelte` Props

```typescript
type Props = {
  /** 開關狀態（由消費端控制） */
  open: boolean;
  /** 參照元素（定位錨點） */
  reference: HTMLElement | undefined;
  /** 內容 */
  children: Snippet;
  /** 偏好位置，預設 'bottom-start' */
  placement?: Placement;
  /** 是否匹配參照元素寬度，預設 true */
  matchWidth?: boolean;
};
```

### 3.2 `popover.svelte.ts`

```typescript
import { computePosition, autoUpdate, flip, offset, shift, size } from "@floating-ui/dom";
import type { Placement, Middleware, ElementRects } from "@floating-ui/dom";

/**
 * Popover 互動邏輯的參數型別
 */
type PopoverOptions = {
  /** 開關狀態 */
  open: boolean;
  /** 參照元素（定位錨點） */
  reference: HTMLElement | undefined;
  /** 偏好位置，預設 'bottom-start' */
  placement?: Placement;
  /** 是否匹配參照元素寬度，預設 true */
  matchWidth?: boolean;
};

/**
 * Popover 的互動邏輯
 */
export class Popover {
  /** popover 容器的 DOM 引用 */
  popoverEl = $state<HTMLDivElement>();
  /** popover 的座標與尺寸 */
  coords = $state({ x: 0, y: 0, width: 0 });

  constructor(private options: PopoverOptions) {
    // 監聽選項變化，當關閉時重新計算確保離場動畫在正確的位置，當開啟時啟用 autoUpdate 以持續更新位置
    // #compute 利用參數接受參照，確保只使用該次 effect 的引用，不會因為 this.options 的變化而改變參照
    $effect(() => {
      const { reference, open, placement = "bottom-start" } = this.options;
      const node = this.popoverEl;
      if (!reference || !node) return;

      if (!open) {
        this.#compute(node, reference, placement);
        return;
      }

      if (!node.matches(":popover-open")) node.showPopover();
      return autoUpdate(reference, node, () => this.#compute(node, reference, placement));
    });
  }

  // ---

  /** 建立 Floating UI 的 middleware */
  #buildMiddleware(): Middleware[] {
    const middleware: Middleware[] = [offset(4), flip({ padding: 8 }), shift({ padding: 8 })];

    if (!this.options.matchWidth) return middleware;

    const apply = ({ rects }: { rects: ElementRects }) => {
      this.coords.width = rects.reference.width;
    };

    middleware.push(size({ apply, padding: 8 }));
    return middleware;
  }

  /** 建立 middleware 並計算 popover 位置 */
  #compute(node: HTMLElement, reference: HTMLElement, placement: Placement) {
    const middleware = this.#buildMiddleware();
    const config = { strategy: "fixed", placement, middleware } as const;

    computePosition(reference, node, config).then(({ x, y }) => {
      this.coords.x = x;
      this.coords.y = y;
    });
  }

  // ---

  /** outro 動畫結束後呼叫，隱藏原生 popover */
  handleOutroEnd = () => {
    if (!this.options.open && this.popoverEl?.matches(":popover-open")) {
      this.popoverEl.hidePopover();
    }
  };
}
```

**設計要點：**

- **Reactive 座標**——`coords` 以 `$state` 管理定位值，template 透過 `style:` 指令綁定。class 不直接操作 DOM style，符合 Template vs UI 分離原則
- **精簡的 `$effect`**——在 effect 頂部解構 `this.options` 與 `this.popoverEl`，Svelte 自動追蹤響應式依賴。`autoUpdate` 的清除函式直接以 `return` 交給 `$effect` 管理，無需手動維護 `#cleanup` 欄位
- **參數捕獲**——`#compute(node, reference, placement)` 接收明確參數，確保非同步的 `computePosition.then()` 中使用的是該次 effect 的引用，不會因 `this.options` 變化而讀到過期值

### 3.3 `Popover.svelte` Template

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Placement } from "@floating-ui/dom";
  import { slide } from "svelte/transition";
  import { Popover } from "$lib/ui/popover.svelte.js";

  type Props = {
    open: boolean;
    reference: HTMLElement | undefined;
    children: Snippet;
    placement?: Placement;
    matchWidth?: boolean;
  };

  let { open, reference, children, placement = "bottom-start", matchWidth = true }: Props = $props();

  const ui = new Popover({
    get open() { return open; },
    get reference() { return reference; },
    get placement() { return placement; },
    get matchWidth() { return matchWidth; },
  });
</script>

<div
  bind:this={ui.popoverEl}
  class="popover"
  popover="manual"
  style:left="{ui.coords.x}px"
  style:top="{ui.coords.y}px"
  style:width={matchWidth ? `${ui.coords.width}px` : undefined}
>
  {#if open}
    <div
      class="popover-content"
      transition:slide={{ duration: 120 }}
      onoutroend={ui.handleOutroEnd}
    >
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .popover {
    position: fixed;
    background: var(--bg-card);
    border: var(--border-style);
    border-radius: var(--radius);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
    padding: 0;
    overflow: visible;
  }

  .popover-content {
    max-height: 14rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.25rem 0;
  }
</style>
```

樣式完全 scoped 在元件內，不依賴任何全域 class。定位透過 `style:` 指令綁定 `ui.coords`，由 UI class 的 `$state` 驅動——class 提供資料，template 決定如何套用至 DOM。

---

## 4. 消費端改動

### 4.1 Select.svelte

```svelte
<script lang="ts">
  import { Select, type SelectItem } from "$lib/ui/select.svelte.js";
  import Popover from "$lib/components/Popover.svelte";
  import { IconChevronDown } from "$lib/icons";

  // ...現有的 Props、$props()、ui 實例化不變...
</script>

<button
  bind:this={ui.triggerEl}
  type="button"
  class="trigger"
  class:stretch
  onclick={ui.handleTriggerClick}
  onkeydown={ui.handleTriggerKeydown}
  onblur={ui.handleTriggerBlur}
>
  <span class="ellipsis">{ui.selectedLabel}</span>
  <span class="chevron" class:open={ui.open}>
    <IconChevronDown size={14} />
  </span>
</button>

<Popover open={ui.open} reference={ui.triggerEl}>
  {#each options as opt, i}
    <button
      type="button"
      role="option"
      class="option ellipsis"
      class:active={i === ui.activeIndex}
      class:selected={opt.value === value}
      aria-selected={opt.value === value}
      onmousedown={(e) => ui.handleOptionMouseDown(e, opt)}
      onmouseenter={() => ui.handleOptionMouseEnter(i)}
    >
      {opt.label}
    </button>
  {/each}
</Popover>
```

**變化：**

- `<div class="popover" use:float={...}>` → `<Popover open={...} reference={...}>`
- 移除 `import { float }` 與 `use:float`
- `role="listbox"` 由消費端決定是否保留（可加在 Popover 外層或以 prop 傳入）
- Select 的 scoped CSS 中不再需要任何 popover 相關樣式

### 4.2 Autocomplete.svelte

```svelte
<Popover open={ui.showDropdown && ui.dropdownTags.length > 0} reference={ui.inputEl}>
  {#each ui.dropdownTags as tag, i}
    <div
      role="option"
      tabindex="-1"
      class:active={i === ui.activeIndex}
      aria-selected={i === ui.activeIndex}
      onmousedown={(e) => ui.handleDropdownMouseDown(e, tag)}
      onmouseenter={() => ui.handleDropdownMouseOver(i)}
    >
      <span class="name">{tag.name}</span>
      <span class="count">{tag.count}</span>
    </div>
  {/each}
</Popover>
```

**變化同 Select**——`<div class="popover" use:float={...}>` 替換為 `<Popover>`。

### 4.3 select.svelte.ts / autocomplete.svelte.ts

UI class **完全不需要修改**。`open`、`showDropdown`、`activeIndex`、所有 handler 的邏輯保持不變。`Popover` 元件從消費端的 `open` prop 讀取開關狀態，UI class 不需要知道底層是 popover 還是 portal。

---

## 5. 移除項目

### 5.1 `app-basic.css` 中的 `.popover`

整個 `.popover` 區塊移除：

```css
/* 移除 */
.popover {
  position: fixed;
  z-index: var(--z-popover);
  background: var(--bg-card);
  border: var(--border-style);
  border-radius: var(--radius);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  max-height: 14rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.25rem 0;
  opacity: 0;
  transform: translateY(-4px);
  pointer-events: none;

  &[data-open="true"] {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  transition:
    opacity 0.12s ease-out,
    transform 0.12s ease-out;
}
```

全域原子 class 列表中的 `.popover` 條目同步移除。

### 5.2 `float.ts`

整個檔案移除。其定位邏輯遷移至 `popover.svelte.ts` 的 `PopoverUI` class 中。

### 5.3 `css.md` 相關段落

移除 `[data-*]` 屬性選擇器章節中關於 `.popover` 與 `data-open` 的範例。更新全域原子 class 列表，移除 `.popover` 條目。

---

## 6. 與現有架構的一致性

### 6.1 遵循 Template vs UI 分離

`Popover` 採用標準的雙檔案結構：`.svelte` 負責結構與 scoped 樣式，`.svelte.ts` 負責互動邏輯（定位、popover API 呼叫、動畫生命週期）。

### 6.2 遵循 Options Pattern

`Popover` 的 constructor 接收 options 物件，消費端以 getter 傳入：

```typescript
const ui = new Popover({
  get open() { return open; },
  get reference() { return reference; },
  // ...
});
```

### 6.3 遵循機制與策略分離

`Popover` 提供**機制**（portal、定位、動畫），**策略**（選項列表的結構與互動）由消費端透過 `children` snippet 注入。這與 Modal 的設計一致。

### 6.4 元件組件一覽表更新

| 組件      | 類型   | 用途                           |
| --------- | ------ | ------------------------------ |
| `Popover` | 完整   | 浮動面板（portal + 定位 + 動畫）|

新增至 `components.md` 的共用組件一覽。

---

## 7. 注意事項

1. **Top layer 堆疊順序**——原生 top layer 的堆疊由進入順序決定，不受 `z-index` 影響。若 Modal 開啟後再開啟 Popover，Popover 會在 Modal 之上（正確行為）。若 Modal 在 Popover 之後開啟，Modal 會覆蓋 Popover。實務上 Select/Autocomplete 在 Modal 內使用時，Popover 的 `showPopover()` 晚於 Modal 的 `showModal()`，堆疊順序正確。

2. **Accessibility**——原生 `popover` 的 `manual` 模式不會自動管理 focus。現有的 `role="listbox"` / `role="option"` / `aria-selected` 仍由消費端負責。`Popover` 元件本身不加 ARIA 屬性——它是一個通用容器，語意由消費端決定。

3. **`::backdrop`**——原生 popover 的 `::backdrop` 預設透明。Popover 的 scoped style 中不為其加樣式，確保不干擾。

4. **動畫自訂**——當前方案使用 `slide` 作為預設 transition。未來可擴充為 prop（如 `transition?: 'slide' | 'fade' | 'scale'`），但初版保持簡單。

---

## 8. 預期改動檔案

| 檔案                                   | 改動           |
| -------------------------------------- | -------------- |
| `src/lib/components/Popover.svelte`    | **新增**       |
| `src/lib/ui/popover.svelte.ts`         | **新增**       |
| `src/lib/components/Select.svelte`     | 修改——使用 `<Popover>` |
| `src/lib/components/Autocomplete.svelte` | 修改——使用 `<Popover>` |
| `src/lib/styles/app-basic.css`         | 修改——移除 `.popover` |
| `src/lib/client/float.ts`              | **刪除**       |
| `docs/frontend/css.md`                 | 修改——移除 `.popover` 相關段落 |
| `docs/frontend/components.md`          | 修改——新增 `Popover` 條目 |

---

## 9. 實作順序

1. **新增 `Popover.svelte` + `popover.svelte.ts`**——建立元件與 UI class，包含完整的定位、popover API、動畫邏輯
2. **重構 `Select.svelte`**——替換 `<div class="popover" use:float>` 為 `<Popover>`，驗證基本開關、鍵盤導航、選取
3. **重構 `Autocomplete.svelte`**——同上
4. **刪除 `float.ts`**——確認沒有其他消費者
5. **清理 `app-basic.css`**——移除 `.popover` 區塊
6. **更新文件**——`css.md`、`components.md`

---

## 10. 結論

將 popover 邏輯封裝為獨立的 `Popover` 共用元件，可以：

- **消除全域 `.popover` CSS**——樣式 scoped 在元件內，與專案的 CSS 策略一致
- **消除 `float.ts`**——portal、定位、動畫生命週期統一由元件管理
- **實現惰性渲染**——`{#if}` 控制內容的 mount / unmount
- **精確控制動畫**——`onoutroend` 確保 `hidePopover()` 在 outro 結束後才呼叫
- **保持消費端簡潔**——Select、Autocomplete 的 UI class 不需修改，template 只是替換一個元素

元件化後，`Popover` 與 `Modal` 站在同一抽象層級——都是提供 overlay 機制的共用元件，消費端透過 snippet 注入內容。
