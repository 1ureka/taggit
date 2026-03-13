# TODO 3：共用元件遷移至新規範（A–C）

> 範圍：`src/lib/components/` + `src/lib/ui/`（字母 A–C）
> 依據：`docs/frontend2.md`
> 涵蓋：Alert、Autocomplete、AutocompleteCompact、CircularProgress、ConfirmModal

---

## 通用遷移模式

每個 `*.svelte.ts` 的遷移都遵循固定步驟，以下不再逐一重複：

| 舊模式（工廠函數） | 新模式（class） |
| --- | --- |
| `export function createXxx(options)` | `export class Xxx` |
| 函數內頂層 `let x = $state(...)` | class field：`x = $state(...)` |
| 函數內頂層 `const x = $derived(...)` | field 型別宣告 `x: T;` + constructor 內賦值 `this.x = $derived(...)` |
| 頂層 `$effect(...)` | constructor 內 `$effect(...)` |
| `function #doSomething()` private helper | `#doSomething()` private method |
| `function handleXxx()` | `handleXxx = () => {}` arrow property |
| `return { get x() {...}, handleXxx, ... }` | 移除 return（class 成員直接可存取） |
| `.svelte`: `const ui = createXxx({...})` | `.svelte`: `const ui = new Xxx({...})` |
| `.svelte`: `import { createXxx }` | `.svelte`: `import { Xxx }` |

Constructor 參數固定寫法：`constructor(private options: XxxOptions) {}`

---

## 一、Alert.svelte

**現況：** 純展示元件。`$derived(color)` 為直覺一行 ternary，符合新規範 §2.1。無 handler、`$state`、`$effect`。

**✅ 無需更動。**

---

## 二、Autocomplete（`Autocomplete.svelte` + `autocomplete.svelte.ts`）

**現況：** 使用工廠函數 `createAutocomplete`，250 行。含 `$effect`（從 `tagCache` 載入標籤）、三個 private helpers（`addTag`、`removeTag`、`popTag`）、多個 handlers。

### `autocomplete.svelte.ts`

1. 將 `export function createAutocomplete(options: AutocompleteOptions)` 改為 `export class Autocomplete`，options 移至 `constructor(private options: AutocompleteOptions)`
2. `$state` 宣告（`inputEl`、`showDropdown`、`inputValue`、`activeIndex`、`tags`）維持為 class fields
3. `$derived.by(() => ...)` 的 `dropdownTags`：
   - field 位置加型別宣告：`dropdownTags: TagInfo[];`
   - constructor 內賦值：`this.dropdownTags = $derived.by(() => { ... })`
4. 載入標籤快取的 `$effect` 移至 constructor 最後
5. `addTag`、`removeTag`、`popTag` → `#addTag()`、`#removeTag()`、`#popTag()`
6. 所有 `function handleXxx()` → `handleXxx = () => {}` arrow properties
7. 移除 `return { ... }` 物件

### `Autocomplete.svelte`

8. `import { createAutocomplete }` → `import { Autocomplete }`
9. `const ui = createAutocomplete({...})` → `const ui = new Autocomplete({...})`（options 格式不變）

---

## 三、AutocompleteCompact.svelte

**現況：** 無對應 `.svelte.ts`。使用 `createAutocomplete` 與 `createMenu` 工廠函數。本身有三個 `$derived`（`visibleTags`、`overflowTags`、`overflowCount`），均為一行 slice，符合新規範。**無 handler 或 `$state` 宣告在 `.svelte` 中**，不需要建立自身的 class。

待 Autocomplete 與 Menu 遷移完成後：

1. 更新 import：
   ```ts
   import { Autocomplete } from "$lib/ui/autocomplete.svelte.js";
   import { Menu } from "$lib/ui/menu.svelte.js";
   ```
2. `const ui = createAutocomplete({...})` → `const ui = new Autocomplete({...})`
3. `const menu = createMenu({...})` → `const menu = new Menu({...})`
4. options 的 getter/setter 格式不變，無需調整

---

## 四、CircularProgress.svelte

**現況：** 純展示元件。只有一個可選的 `label` prop，無任何互動邏輯。

**✅ 無需更動。**

---

## 五、ConfirmModal（`ConfirmModal.svelte` + `confirmModal.svelte.ts`）

**現況：** 使用工廠函數 `createConfirmModal`，89 行。含 `$effect`（監聽 `window` custom event `confirm:request`）、兩個 private helpers（`doConfirm`、`doCancel`）、三個 handlers。`resolveRef` 為非響應式私有引用（`null | ((v: boolean) => void)`）。

### `confirmModal.svelte.ts`

1. `export function createConfirmModal()` → `export class ConfirmModal`，無 options（constructor 為空或省略）
2. `$state` fields：`open = $state(false)`、`message = $state("")`
3. `resolveRef` 改為私有 class field（非響應式）：
   ```ts
   #resolveRef: ((v: boolean) => void) | null = null;
   ```
4. `doConfirm`、`doCancel` → `#doConfirm()`、`#doCancel()` private methods
5. 三個 handlers → arrow properties：
   ```ts
   handleConfirmClick = () => { ... };
   handleCancelClick = () => { ... };
   handleModalClose = () => { ... };
   ```
6. `$effect`（監聽 `confirm:request`）移至 constructor
7. return 物件中的 `open` getter/setter 改為直接存取 class field（移除 return）

### `ConfirmModal.svelte`

8. `import { createConfirmModal }` → `import { ConfirmModal }`
9. `const ui = createConfirmModal()` → `const ui = new ConfirmModal()`
10. `ui.open`、`ui.message`、`ui.handleConfirmClick` 等的呼叫方式不變
