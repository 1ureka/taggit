# TODO 4：共用元件遷移至新規範（F–R）

> 範圍：`src/lib/components/` + `src/lib/ui/`（字母 F–R）
> 依據：`docs/frontend2.md`
> 涵蓋：FilterBar、Menu、Modal、Pagination、Rating

---

## 一、FilterBar.svelte

**現況：** 純組裝元件，將 `Autocomplete` 與 `Select` 拼裝為單一篩選列。本身無 handler、`$state`、`$derived` 或 `$effect`；幾個靜態選項陣列（`ratingOpOptions` 等）為普通 `const`，不需要 runes。

FilterBar 以 props/bindable 的方式與子元件溝通，子元件的內部實作從工廠函數改為 class 不影響 `.svelte` 的對外 API（props、事件）。

**✅ 無需更動。** 待 `Autocomplete.svelte` 與 `Select.svelte` 遷移完成後，自動相容。

---

## 二、Menu（`menu.svelte.ts`，無對應 `.svelte`）

**現況：** 使用工廠函數 `createMenu`，176 行。含 `$effect`（動態縮減 list 時自動夾緊 `activeIndex`）、三個 private helpers（`openMenu`、`closeMenu`、`selectItem`）、五個 handlers。此檔案**無對應 `.svelte`**；被 `AutocompleteCompact.svelte` 及各路由元件直接引用。

### `menu.svelte.ts`

1. `export function createMenu(options: MenuOptions)` → `export class Menu`，options 移至 `constructor(private options: MenuOptions)`
2. `$state` fields：
   ```ts
   triggerEl = $state<HTMLButtonElement>();
   open = $state(false);
   activeIndex = $state(-1);
   ```
3. `$effect`（夾緊 activeIndex / list 歸零自動關閉）移至 constructor
4. Private helpers → private methods：
   - `openMenu()` → `#openMenu()`
   - `closeMenu()` → `#closeMenu()`
   - `selectItem(item)` → `#selectItem(item)`
5. 所有 handlers → arrow properties：
   ```ts
   handleTriggerClick = () => { ... };
   handleTriggerBlur = () => { ... };
   handleTriggerKeydown = (e: KeyboardEvent) => { ... };
   handleItemMouseDown = (e: MouseEvent, item: MenuItem) => { ... };
   handleItemMouseEnter = (index: number) => { ... };
   ```
6. `list` getter 改為 class getter：
   ```ts
   get list() { return this.options.list; }
   ```
7. 移除 `return { ... }` 物件

> **注意呼叫方更新：** `AutocompleteCompact.svelte`（見 TODO 3）與各路由的 `*.svelte` / `*.svelte.ts` 中所有 `createMenu(...)` 呼叫都需同步更新為 `new Menu(...)`。

---

## 三、Modal（`Modal.svelte` + `modal.svelte.ts`）

**現況：** 使用工廠函數 `createModal`，103 行。含 `$effect`（監聽 `open` 狀態管理焦點 trap）、兩個 private helpers（`saveFocusAndTrap`、`restoreFocus`）、兩個 handlers。`previouslyFocused` 為非響應式私有引用；`FOCUSABLE_SELECTOR` 為靜態常數字串。

### `modal.svelte.ts`

1. `export function createModal(options: ModalOptions)` → `export class Modal`，options 移至 `constructor(private options: ModalOptions)`
2. `$state` field：`dialogEl = $state<HTMLDivElement>()`
3. 非響應式私有引用改為 private class field（不使用 `$state`）：
   ```ts
   #previouslyFocused: HTMLElement | null = null;
   ```
4. 靜態常數改為 private class field：
   ```ts
   #FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
   ```
5. Private helpers → private methods：
   - `saveFocusAndTrap()` → `#saveFocusAndTrap()`
   - `restoreFocus()` → `#restoreFocus()`
6. Handlers → arrow properties：
   ```ts
   handleOverlayClick = (e: MouseEvent) => { ... };
   handleOverlayKeydown = (e: KeyboardEvent) => { ... };
   ```
7. `$effect`（open 狀態 → 焦點 trap）移至 constructor
8. 移除 `return { ... }` 物件（`dialogEl` getter/setter、兩個 handlers 直接為 class 成員）

### `Modal.svelte`

9. `import { createModal }` → `import { Modal }`
10. `const ui = createModal({...})` → `const ui = new Modal({...})`

---

## 四、Pagination（`Pagination.svelte` + `pagination.svelte.ts`）

**現況：** 使用工廠函數 `createPagination`，34 行（最輕量）。無 `$state`、無 private helpers。只有一個 handler `handlePageClick`。

### `pagination.svelte.ts`

1. `export function createPagination(options: PaginationOptions)` → `export class Pagination`，options 移至 `constructor(private options: PaginationOptions)`
2. 無 `$state` fields 需處理
3. Handler → arrow property：
   ```ts
   handlePageClick = (p: number) => {
     if (p < 1 || p > this.options.pages) return;
     const params = new URLSearchParams(page.url.searchParams);
     if (p > 1) params.set("page", String(p));
     else params.delete("page");
     const qs = params.toString();
     goto(`${this.options.basePath}${qs ? `?${qs}` : ""}`, { noScroll: true, keepFocus: true });
   };
   ```
4. 移除 `return { ... }`

### `Pagination.svelte`

5. `import { createPagination }` → `import { Pagination }`
6. `const ui = createPagination({...})` → `const ui = new Pagination({...})`

---

## 五、Rating（`Rating.svelte` + `rating.svelte.ts`）

**現況：** 使用工廠函數 `createRating`，128 行。含一個 `$state`（`hoveredValue`）、兩個 private helpers（`getStarState`、`commit`）、四個 handlers。無 `$derived`，無 `$effect`。

> **注意：** `getStarState(i)` 雖命名為 `getXxx`，但它是純計算函數（非 handler），應保持為一般 method，不改為 arrow property。

### `rating.svelte.ts`

1. `export function createRating(options: RatingOptions)` → `export class Rating`，options 移至 `constructor(private options: RatingOptions)`
2. `$state` field：`hoveredValue = $state(0)`
3. Private helpers → private methods：
   - `getStarState(i)` → `#getStarState(i)`（改為 private，見下方補充）
   - `commit(next)` → `#commit(next)`
4. 公開方法：`getStarState` 需供模板呼叫，保持為公開 method（非 arrow property，因為不是 DOM event handler）：
   ```ts
   getStarState(i: number): RatingStarState { ... }
   ```
5. Handlers → arrow properties：
   ```ts
   handleStarMouseEnter = (i: number) => { ... };
   handleContainerMouseLeave = () => { ... };
   handleStarClick = (i: number) => { ... };
   handleContainerKeydown = (e: KeyboardEvent) => { ... };
   ```
6. 移除 `return { ... }`

### `Rating.svelte`

7. `import { createRating }` → `import { Rating }`
8. `const rating = createRating({...})` → `const rating = new Rating({...})`
9. `.svelte` 中的 `const iconPx = $derived(Math.round(parseFloat(size) * 16))` 為一行式計算，符合規範，**無需移至 class**
