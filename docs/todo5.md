# TODO 5：共用元件遷移至新規範（S–T）

> 範圍：`src/lib/components/` + `src/lib/ui/`（字母 S–T）
> 依據：`docs/frontend2.md`
> 涵蓋：Select、SelectCheckbox、SelectionDock、Toast、TooSmallOverlay

---

## 一、Select（`Select.svelte` + `select.svelte.ts`）

**現況：** 使用工廠函數 `createSelect`，167 行。含 `$derived`（`selectedLabel`）、三個 private helpers（`selectOption`、`openDropdown`、`closeDropdown`）、五個 handlers。

### `select.svelte.ts`

1. `export function createSelect(options: SelectOptions)` → `export class Select`，options 移至 `constructor(private options: SelectOptions)`
2. `$state` fields：
   ```ts
   triggerEl = $state<HTMLButtonElement>();
   open = $state(false);
   activeIndex = $state(-1);
   ```
3. `$derived` 的 `selectedLabel`：
   - field 宣告：`selectedLabel: string;`
   - constructor 賦值：`this.selectedLabel = $derived(this.options.list.find((item) => item.value === this.options.value)?.label ?? "")`
4. Private helpers → private methods：
   - `selectOption(item)` → `#selectOption(item)`
   - `openDropdown()` → `#openDropdown()`
   - `closeDropdown()` → `#closeDropdown()`
5. Handlers → arrow properties：
   ```ts
   handleTriggerClick = () => { ... };
   handleTriggerBlur = () => { ... };
   handleTriggerKeydown = (e: KeyboardEvent) => { ... };
   handleOptionMouseDown = (e: MouseEvent, item: SelectItem) => { ... };
   handleOptionMouseEnter = (index: number) => { ... };
   ```
6. 移除 `return { ... }`

### `Select.svelte`

7. `import { createSelect }` → `import { Select }`
8. `.svelte` 中目前使用的是 `createSelect`，需改為 `new Select({...})`（options 格式不變）

---

## 二、SelectCheckbox.svelte（新增 `selectCheckbox.svelte.ts`）

**現況：** 只有 `.svelte`，但其中定義了 `function handleClick`（包含 `e.stopPropagation()` / `e.preventDefault()` 與 `onchange` 呼叫）。根據新規範 §2.1，任何含有 handler 的元件都必須拆出至對應的 `.svelte.ts`。`$derived(iconSize)` 為一行式計算，符合規範，無需移至 class。

**需要新建 `src/lib/ui/selectCheckbox.svelte.ts`：**

```ts
// selectCheckbox.svelte.ts

/**
 * SelectCheckbox 的配置選項
 */
type SelectCheckboxOptions = {
  /** 雙向綁定：是否選中 */
  checked: boolean;
  /** 當狀態變更時觸發的回調 */
  onchange?: (checked: boolean) => void;
};

/**
 * SelectCheckbox 的無頭 UI
 */
export class SelectCheckbox {
  constructor(private options: SelectCheckboxOptions) {}

  // ---

  /** 處理點擊事件，阻止冒泡與預設行為後切換選取狀態 */
  handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    this.options.onchange?.(!this.options.checked);
  };
}
```

### `SelectCheckbox.svelte`

1. `import { SelectCheckbox } from "$lib/ui/selectCheckbox.svelte.js"`
2. 新增 class 實例化（放在 `$props()` 解構之後）：
   ```svelte
   const ui = new SelectCheckbox({
     get checked() { return checked; },
     get onchange() { return onchange; },
   });
   ```
3. `onclick={handleClick}` → `onclick={ui.handleClick}`
4. 移除 `.svelte` 中的 `function handleClick` 宣告

---

## 三、SelectionDock.svelte

**現況：** 純容器元件，接收 `count`、`onclose`、`children` snippet，以 `transition:fly` 控制進出場。無 handler、`$state`、`$derived` 或 `$effect`。`onclose` 為直接從 props 傳入的 callback，在模板中以 `onclick={onclose}` 使用。

**✅ 無需更動。**

---

## 四、Toast（`Toast.svelte` + `toast.svelte.ts`）

**現況：** 使用工廠函數 `createToast`，294 行（最複雜）。含 `$effect`（監聽 `window` custom event `toast:add`）、多個 private helpers、四個 handlers，以及三個公開的計算方法（`getOffset`、`getScale`、`getOpacity`、`getContainerHeight`）和一個 Svelte action（`measureEl`）。

> **命名決策：** `getOffset`、`getScale`、`getOpacity`、`getContainerHeight`、`measureEl` 為模板呼叫的公開計算/action，**不是 event handler**，應維持為普通 public method（非 arrow property）。只有 `handleXxx` 系列改為 arrow property。

### `toast.svelte.ts`

1. `export function createToast(options: ToastOptions)` → `export class Toast`，options 移至 `constructor(private options: ToastOptions)`
2. `$state` fields：
   ```ts
   items = $state<ToastItem[]>([]);
   hovered = $state(false);
   heights: Map<number, number> = $state(new Map());
   entering: Set<number> = $state(new Set());
   ```
3. 非響應式私有狀態改為 private class fields（**刻意不用 `$state`**，不需驅動 UI）：
   ```ts
   #nextId = 0;
   #timers = new Map<number, ReturnType<typeof setTimeout>>();
   ```
4. Private helpers → private methods（共 9 個）：
   - `clearTimer(id)` → `#clearTimer(id)`
   - `scheduleRemoval(id, delay)` → `#scheduleRemoval(id, delay)`
   - `addItem(payload)` → `#addItem(payload)`
   - `dismiss(id)` → `#dismiss(id)`
   - `finalizeRemoval(id)` → `#finalizeRemoval(id)`
   - `pauseAll()` → `#pauseAll()`
   - `resumeAll()` → `#resumeAll()`
   - `measureHeight(id, el)` → `#measureHeight(id, el)`
5. 公開計算方法不加 `#`（template 直接呼叫），維持為普通 method：
   ```ts
   getOffset(index: number): number { ... }
   getScale(index: number): number { ... }
   getOpacity(index: number, toast: ToastItem): number { ... }
   getContainerHeight(): number { ... }
   measureEl(node: HTMLDivElement, id: number) { ... }   // Svelte action
   ```
6. Handlers → arrow properties：
   ```ts
   handleContainerMouseEnter = () => { ... };
   handleContainerMouseLeave = () => { ... };
   handleTransitionEnd = (e: TransitionEvent, toast: ToastItem) => { ... };
   handleCloseClick = (id: number) => { ... };
   ```
7. `$effect`（監聽 `toast:add`）移至 constructor 最後
8. 移除 `return { ... }`

### `Toast.svelte`

9. `import { createToast }` → `import { Toast }`
10. `const ui = createToast({...})` → `const ui = new Toast({...})`（options 不變）

---

## 五、TooSmallOverlay.svelte

**現況：** 純展示元件，接收 `minWidth`、`minHeight`、`currentWidth`、`currentHeight`、`label` 等 props，無任何互動邏輯。

**✅ 無需更動。**
