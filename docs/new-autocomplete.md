# TagAutocomplete v2 — 重構計畫

> 本文件為新版 `TagAutocomplete` 元件的詳細調查、分析與實作方案。

---

## 1. 現狀調查

### 1.1 現有 TagAutocomplete

**檔案**：`src/lib/components/TagAutocomplete.svelte`

**Props（舊版）**：
| Prop | 型別 | 說明 |
|---|---|---|
| `allTags` | `TagInfo[]` | 所有可選標籤（由外部 SSR 傳入） |
| `excludedTags` | `string[]` | 已選標籤（用來過濾 dropdown） |
| `placeholder` | `string` | 輸入佔位符 |
| `onselect` | `(tag: string) => void` | 選中 / 新增一個標籤 |
| `oncommit` | `() => void` | 空字串按 Enter 時觸發 |
| `onbackspace` | `() => void` | 空字串按 Backspace 時觸發 |

**職責**：純輸入框 + dropdown 自動完成。不負責標籤 chips 的顯示、不管理標籤陣列、不 fetch 資料。

### 1.2 現有 TagChips

**檔案**：`src/lib/components/TagChips.svelte`

**Props**：`tags: string[]`, `onremove?: (tag: string) => void`

**職責**：渲染 `chip` / `chip-removable` 列表。

**使用情況**：僅 `BrowseFilter.svelte` 使用。其餘 5 個使用端全部自行 inline 寫 `{#each}` + `<button class="chip chip-removable">` 來渲染 chips。

### 1.3 所有使用端一覽

| # | 檔案 | 標籤 chips 如何顯示 | 佈局模式 | allTags 來源 | 備註 |
|---|---|---|---|---|---|
| 1 | `routes/tagger/TaggerTagPanel.svelte` | inline `{#each}` + `chip-removable` 按鈕 | **上方擺**（chips 在上方、input 在下方、垂直排列） | `tagCatalogStore.known`（SSR → store） | 正統的「上方擺」，有 `oncommit`, `onbackspace` |
| 2 | `routes/editor/[id]/EditorInfoPanel.svelte` | inline `{#each}` + `chip-removable` 按鈕 | **上方擺**（同 Tagger） | `editStore.allTags`（SSR → store） | 同 Tagger 布局；有 `onbackspace`、無 `oncommit` |
| 3 | `lib/components/FilterBar.svelte` | inline `{#each}` + `chip-removable` 按鈕 | **側面擺**（chips 與 input 同行 flex-wrap） | prop `allTags`（由父層傳入） | 正統的「側面擺」 |
| 4 | `routes/compare/+page.svelte` | inline `{#each}` + `chip-removable` 按鈕 | **側面擺**（header 內 chips + input 水平排列） | `allTags`（SSR → local state） | 佈局同 FilterBar |
| 5 | `routes/browse/BrowseFilter.svelte` | `<TagChips />` 元件 | **誤導用法**：chips 與 input 垂直排列，但沒有用正統的上方擺 wrapper | `filterStore.allTags`（SSR → store） | 應改為「上方擺」；唯一使用 TagChips 的地方 |
| 6 | `routes/scroll/+page.svelte` | 不直接使用 TagAutocomplete；透過 `<FilterBar>` 間接使用 | **側面擺**（透過 FilterBar） | `allTags`（SSR → local state → FilterBar prop） | 間接使用 |
| 7 | `routes/tagger/TaggerModalRename.svelte` | 不顯示 chips（純 picker） | **無 chips 的 picker 模式** | `tagCatalogStore.known` | 只用 `onselect`、選中後清空 input；本質仍可視為「上方擺」（因為不需要 chips） |

### 1.4 allTags 的 SSR 流程

目前每個需要 allTags 的頁面都在 `+page.server.ts` 中呼叫 `getAllTags(db)`，然後在頁面元件的 `onMount` / init 函式中將 SSR data hydrate 到各自的 store：

| 頁面 | `+page.server.ts` | hydrate 位置 |
|---|---|---|
| `/browse` | `return { allTags }` | `actions.ts → initBrowse(allTags)` → `filterStore.allTags = allTags` |
| `/scroll` | `return { allTags }` | `let allTags = $state([...data.allTags])` 直接 local state |
| `/compare` | `return { allTags }` | `let allTags = $state([...data.allTags])` 直接 local state |
| `/tagger` | `return { allTags }` | `actions.ts → initTagger(...)` → `tagCatalogStore.known = [...tags]` |
| `/editor/[id]` | `return { allTags }` | `actions.ts → initEdit(image, allTags)` → `editStore.allTags = allTags` |

**問題**：
1. 5 個 `+page.server.ts` 重複做同一件事
2. 每次頁面導航都重新 SSR 載入 allTags，即使資料沒有變化
3. TagAutocomplete 仰賴外部傳遞 `allTags`，增加了耦合

### 1.5 佈局分析

#### 上方擺（`top`）

```
┌──────────────────────────┐
│ [tag1] [tag2] [tag3]     │   ← chips 區（flex-wrap）
│ [tag4]                   │
├──────────────────────────┤
│ [ 輸入標籤...          ] │   ← input
└──────────────────────────┘
```

使用者：TaggerTagPanel、EditorInfoPanel
特徵：chips 與 input 垂直分離、chips 在上可滾動、input 固定在底部。

#### 側面擺（`inline`）

```
┌──────────────────────────────────────────────────┐
│ [tag1] [tag2] [tag3] [ 篩選標籤...             ] │
└──────────────────────────────────────────────────┘
```

使用者：FilterBar、compare +page
特徵：chips 與 input 同行，`flex-wrap` 換行。更適合水平空間充裕的 header / filter bar。

#### compact

```
┌──────────────────────────────────────────┐
│ [tag1] [tag2] [+2] [ 篩選標籤...      ] │
└──────────────────────────────────────────┘
```

目前無人實作，計畫用於 scroll 等空間有限的情境。
特徵：
- chips 與 input 同行（同 `inline`）
- 超過 N 個標籤（例如 2 個）後，第三個 chip 起顯示為 `+M`
- 點擊 `+M` 彈出 dropdown / popover，列出被收合的標籤
- 在 popover 中可點擊某個標籤來移除它

---

## 2. 設計目標

1. **內聚（Cohesive）**：TagAutocomplete 獨立管理「標籤 chips 顯示 + 輸入自動完成 + 新增/移除標籤 + allTags 取得」
2. **最小 API**：只暴露 `tags`（`$bindable`）、`placeholder`、`onenter`、`variant`
3. **自行 fetch allTags**：首次互動時 client-side fetch；用 TTL（5 秒）快取
4. **三種佈局 variant**：`top` / `inline` / `compact`
5. **棄用 TagChips**：chips 功能合併進 TagAutocomplete

---

## 3. 新版 Props API

```typescript
interface TagAutocompleteProps {
  /** 雙向綁定：目前選中的標籤列表 */
  tags: string[];  // $bindable

  /** 輸入框佔位符，預設 "輸入標籤..." */
  placeholder?: string;

  /** 空輸入時按 Enter 觸發（非新增標籤行為）。用於 tagger 的「提交」等外部動作 */
  onenter?: () => void;

  /** 佈局變體 */
  variant?: "top" | "inline" | "compact";
}
```

### 棄用的 Props

| 舊 Prop | 替代方案 |
|---|---|
| `allTags` | 元件內部 fetch & cache |
| `excludedTags` | 改為 `tags`（$bindable），元件內部反推 excluded |
| `onselect` | 元件內部 `tags = [...tags, newTag]` |
| `oncommit` | 改為 `onenter` |
| `onbackspace` | 元件內部 `tags = tags.slice(0, -1)` |

---

## 4. 內部架構

### 4.1 allTags 快取模組

新增 `src/lib/client/tag-cache.ts`：

```typescript
import type { TagInfo } from "$lib/types.js";
import { api } from "./api.js";

let cached: TagInfo[] = [];
let lastFetchedAt = 0;

const TTL = 5_000; // 5 seconds

export async function getTagCatalog(): Promise<TagInfo[]> {
  const now = Date.now();
  if (cached.length > 0 && now - lastFetchedAt < TTL) {
    return cached;
  }

  const res = await api.get<{ tags: TagInfo[] }>("/api/metadata/tags");
  if (res.ok && res.data) {
    cached = res.data.tags;
    lastFetchedAt = now;
  }

  return cached;
}

/** 外部（如 rename / commit）可手動使快取失效 */
export function invalidateTagCache() {
  lastFetchedAt = 0;
}
```

好處：
- 全域單例，所有 TagAutocomplete 實例共享
- 不依賴 SSR：首次 fetch 在使用者聚焦 input 時觸發
- 5 秒 TTL：關閉再打開 autocomplete 時如果超過 5 秒會重新 fetch
- 可由外部 `invalidateTagCache()` 強制刷新（例如 rename 或 commit 後）

### 4.2 元件內部狀態

```typescript
// 元件頂層
let { tags = $bindable([]), placeholder, onenter, variant = "top" } = $props();

let allTags = $state<TagInfo[]>([]);
let inputValue = $state("");
let showDropdown = $state(false);
let activeIndex = $state(-1);

// compact: overflow popover 狀態
let showOverflow = $state(false);

// 首次互動時 fetch allTags
let hasFetched = $state(false);
async function ensureTags() {
  allTags = await getTagCatalog();
  hasFetched = true;
}

// derived: 過濾邏輯（排除已選標籤 + 搜尋）
let filtered = $derived.by(() => {
  const query = inputValue.trim().toLowerCase();
  const excluded = new Set(tags.map(t => t.toLowerCase()));
  const available = allTags.filter(t => !excluded.has(t.name.toLowerCase()));
  if (!query) return available;
  return available.filter(t => t.name.toLowerCase().includes(query));
});
```

### 4.3 標籤管理（內部）

```typescript
function addTag(name: string) {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return;
  if (tags.includes(normalized)) return;
  tags = [...tags, normalized];
  inputValue = "";
}

function removeTag(name: string) {
  tags = tags.filter(t => t !== name);
}

function popTag() {
  if (tags.length > 0) {
    tags = tags.slice(0, -1);
  }
}
```

### 4.4 鍵盤事件

```typescript
function handleKeydown(e: KeyboardEvent) {
  if (e.key === "ArrowDown") { ... }
  else if (e.key === "ArrowUp") { ... }
  else if (e.key === "Escape") { ... }
  else if (e.key === "Enter") {
    e.preventDefault();
    if (activeIndex >= 0 && activeIndex < filtered.length) {
      addTag(filtered[activeIndex].name);
    } else if (inputValue.trim()) {
      addTag(inputValue.trim());
    } else {
      onenter?.();  // 空字串 Enter → 外部行為
    }
  }
  else if (e.key === "Tab") { ... }
  else if (e.key === "Backspace" && !inputValue) {
    popTag();  // 內部處理
  }
}
```

---

## 5. 三種 Variant 的 Template 設計

### 5.1 `variant="top"`

```svelte
<div class="tag-ac tag-ac--top">
  <div class="tag-ac__chips">
    {#each tags as tag}
      <button class="chip chip-removable" onclick={() => removeTag(tag)}>
        {tag}
        <span class="chip-remove"><IconX size={12} /></span>
      </button>
    {/each}
  </div>
  <div class="tag-ac__input-wrap">
    <input ... />
    <div class="ac-dropdown" use:float={...}>...</div>
  </div>
</div>
```

CSS 要點：
- `.tag-ac--top` → `flex-direction: column`
- `.tag-ac__chips` → `flex-wrap: wrap; gap: 0.25rem; max-height: 12rem; overflow-y: auto`
- `.tag-ac__input-wrap` → `margin-top: 0.5rem`

### 5.2 `variant="inline"`

```svelte
<div class="tag-ac tag-ac--inline">
  {#each tags as tag}
    <button class="chip chip-removable" onclick={() => removeTag(tag)}>
      {tag}
      <span class="chip-remove">×</span>
    </button>
  {/each}
  <div class="tag-ac__input-wrap">
    <input ... />
    <div class="ac-dropdown" use:float={...}>...</div>
  </div>
</div>
```

CSS 要點：
- `.tag-ac--inline` → `display: flex; flex-wrap: wrap; gap: 0.25rem; align-items: center`
- `.tag-ac__input-wrap` → `flex: 1; min-width: 8rem`

### 5.3 `variant="compact"`

```svelte
<div class="tag-ac tag-ac--compact">
  {#each visibleTags as tag}
    <button class="chip chip-removable" onclick={() => removeTag(tag)}>
      {tag}
      <span class="chip-remove">×</span>
    </button>
  {/each}

  {#if overflowCount > 0}
    <button class="chip tag-ac__overflow-chip" onclick={() => showOverflow = !showOverflow}>
      +{overflowCount}
    </button>
    {#if showOverflow}
      <div class="tag-ac__overflow-dropdown" use:float={...}>
        {#each overflowTags as tag}
          <button class="tag-ac__overflow-item" onclick={() => removeTag(tag)}>
            {tag}
            <span class="chip-remove">×</span>
          </button>
        {/each}
      </div>
    {/if}
  {/if}

  <div class="tag-ac__input-wrap">
    <input ... />
    <div class="ac-dropdown" use:float={...}>...</div>
  </div>
</div>
```

```typescript
const COMPACT_VISIBLE = 2; // 顯示 2 個 chips，超出的收合

let visibleTags = $derived(tags.slice(0, COMPACT_VISIBLE));
let overflowTags = $derived(tags.slice(COMPACT_VISIBLE));
let overflowCount = $derived(overflowTags.length);
```

CSS 要點：
- `.tag-ac--compact` → `display: flex; align-items: center; gap: 0.25rem`（同 inline，但不換行 `flex-wrap: nowrap`）
- `.tag-ac__overflow-chip` → accent 色，hover 效果
- `.tag-ac__overflow-dropdown` → 小 popover，列出可移除的溢出標籤

---

## 6. 特殊場景：TaggerModalRename

TaggerModalRename 的用法本質上是一個 **tag picker**（選擇現有標籤），而非 tag editor：
- 只需要 `onselect` 行為（選中後填入欄位）
- 不需要 chips 顯示
- 不需要記錄已選標籤

**方案**：此元件繼續直接使用新版 TagAutocomplete，但以「空 tags + 捕捉 tags 變更」的模式操作：

```svelte
<TagAutocomplete
  bind:tags={renameTempTags}
  variant="top"
  placeholder="選擇要重命名的標籤..."
/>
```

再透過 `$effect` 監聽 `renameTempTags` 的變化：

```typescript
let renameTempTags = $state<string[]>([]);

$effect(() => {
  if (renameTempTags.length > 0) {
    oldName = renameTempTags[renameTempTags.length - 1];
    renameTempTags = []; // 清空，回到 picker 模式
    requestAnimationFrame(() => newInputEl?.focus());
  }
});
```

此模式不需要為 Rename 額外加 prop，也保持 API 乾淨。

---

## 7. 遷移方案

### 7.1 各使用端的遷移對照

| 使用端 | 目前 | 遷移後 | 變更要點 |
|---|---|---|---|
| **TaggerTagPanel** | inline chips + `<TagAutocomplete onselect oncommit onbackspace>` | `<TagAutocomplete bind:tags={editStore.tags} variant="top" onenter={commit}>` | 移除 inline chips、移除 addTag/removeTag/popTag wrapper |
| **EditorInfoPanel** | inline chips + `<TagAutocomplete onselect onbackspace>` | `<TagAutocomplete bind:tags={editStore.currentTags} variant="top">` | 移除 inline chips、移除 addTag/removeTag/removeLastTag wrapper |
| **FilterBar** | inline chips + `<TagAutocomplete onselect onbackspace>` | `<TagAutocomplete bind:tags={selectedTags} variant="inline">` | 移除 inline chips 與 addTag/removeTag/removeLastTag 函式 |
| **compare +page** | inline chips + `<TagAutocomplete onselect onbackspace>` | `<TagAutocomplete bind:tags={filterTags} variant="inline">` | 移除 inline chips 與 helper 函式 |
| **BrowseFilter** | `<TagChips>` + `<TagAutocomplete onselect>` | `<TagAutocomplete bind:tags={filterStore.tags} variant="top" placeholder="添加標籤...">` | 移除 TagChips import；移除 addTag wrapper |
| **scroll +page** | 透過 FilterBar（間接） | 不變（FilterBar 內部遷移） | 無 |
| **TaggerModalRename** | `<TagAutocomplete onselect>` （picker 模式） | `<TagAutocomplete bind:tags={renameTempTags} variant="top">` + $effect | 改為 bind:tags + watch 模式 |

### 7.2 移除 allTags SSR 通道

遷移完成後，各 `+page.server.ts` 中的 `allTags: getAllTags(db)` 可以移除：

| 檔案 | 動作 |
|---|---|
| `src/routes/browse/+page.server.ts` | 移除 `allTags` 回傳 |
| `src/routes/scroll/+page.server.ts` | 移除 `allTags` 回傳 |
| `src/routes/compare/+page.server.ts` | 移除 `allTags` 回傳 |
| `src/routes/tagger/+page.server.ts` | 移除 `allTags` 回傳 |
| `src/routes/editor/[id]/+page.server.ts` | 移除 `allTags` 回傳 |

以及各 store 中的 `allTags` / `tagCatalogStore.known` 欄位與 init 函式中對應的 hydrate 程式碼。

### 7.3 棄用清單

| 項目 | 動作 |
|---|---|
| `TagChips.svelte` | 刪除 |
| `TagAutocomplete.svelte`（舊版） | 以新版就地取代 |
| 各 store 的 `allTags` / `known` 欄位 | 移除 |
| 各 actions 的 `addTag` / `removeTag` / `popTag` wrapper | 移除（若僅服務 TagAutocomplete） |

---

## 8. CSS 結構

新版 CSS 放在 `src/lib/styles/TagAutocomplete.css`（覆蓋現有），結構：

```css
/* ─── Base ─────────────────────────────────────────────────── */
.tag-ac { ... }

/* ─── Variant: top ─────────────────────────────────────────── */
.tag-ac--top {
  display: flex;
  flex-direction: column;
}

.tag-ac--top .tag-ac__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
  max-height: 12rem;
  overflow-y: auto;
  align-content: flex-start;
}

/* ─── Variant: inline ──────────────────────────────────────── */
.tag-ac--inline {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
  align-items: center;
}

.tag-ac--inline .tag-ac__input-wrap {
  flex: 1;
  min-width: 8rem;
}

/* ─── Variant: compact ─────────────────────────────────────── */
.tag-ac--compact {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.25rem;
  align-items: center;
}

.tag-ac--compact .tag-ac__input-wrap {
  flex: 1;
  min-width: 6rem;
}

.tag-ac__overflow-chip {
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
}

.tag-ac__overflow-dropdown {
  /* 由 float action 定位 */
  position: fixed;
  z-index: 9999;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  padding: 0.25rem;
  min-width: 8rem;
}

.tag-ac__overflow-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0.5rem;
  font-size: 0.8125rem;
  border-radius: calc(var(--radius) - 2px);
  cursor: pointer;
  transition: background 0.08s;
}

.tag-ac__overflow-item:hover {
  background: var(--bg-hover);
}

/* ─── Autocomplete Dropdown（沿用） ────────────────────────── */
.ac-dropdown { ... }
```

---

## 9. 實作順序

### Phase 1：建立基礎設施
1. **建立 `src/lib/client/tag-cache.ts`** — allTags 快取模組
2. **改寫 `TagAutocomplete.svelte`** — 新 API、三種 variant、內建 chips、內建 backspace
3. **更新 `src/lib/styles/TagAutocomplete.css`** — 新增 variant CSS

### Phase 2：逐一遷移使用端
4. **TaggerTagPanel** → `variant="top"`, `bind:tags`, `onenter`
5. **EditorInfoPanel** → `variant="top"`, `bind:tags`
6. **FilterBar** → `variant="inline"`, `bind:tags`
7. **compare +page** → `variant="inline"`, `bind:tags`
8. **BrowseFilter** → `variant="top"`, `bind:tags`
9. **TaggerModalRename** → `bind:tags` + $effect watch 模式

### Phase 3：清理
10. **刪除 `TagChips.svelte`**
11. **移除各 `+page.server.ts` 的 `allTags`** 回傳
12. **清理各 store 中的 allTags / known 欄位與 init 函式**
13. **移除各 actions 中不再需要的 addTag/removeTag/popTag wrapper**（僅限那些只服務 TagAutocomplete 的）

### Phase 4：驗證
14. **手動測試** 所有使用端的標籤操作
15. **確認 compact variant** 的 overflow 行為（+N chip + dropdown）

---

## 10. 注意事項

### 10.1 Tag Normalize

目前 tagger / editor 等頁面在 `addTag` 時做 `.trim().toLowerCase()` 正規化。新版元件內部應統一做此正規化，不需外部處理。

### 10.2 FilterBar 仍保留

`FilterBar.svelte` 本身仍是有用的複合元件（標籤 + 評分 + 排序），只是其內部的標籤部分改為單一 `<TagAutocomplete variant="inline">`。

### 10.3 Rename Modal 的 allTags 需要不被 excludedTags 過濾

目前 Rename Modal 傳入 `allTags` 但不傳 `excludedTags`（因為要能選所有標籤）。新版中 `tags` 一開始為空，所以 derived filtered 自然不會排除任何標籤，行為正確。

### 10.4 invalidateTagCache 的調用時機

以下情境應呼叫 `invalidateTagCache()`：
- tagger commit 後（新增了標籤到圖片）
- rename tag 後
- editor save 後

這能確保下次打開 autocomplete 時拿到最新的標籤清單。

### 10.5 focus 管理

TaggerTagPanel 目前有透過 `uiStore.focusInputTick` 來外部觸發 focus input。新版需要暴露一個 `focus()` 方法或接受一個 `focusTick` prop 來維持此功能。

**建議**：使用 `export function focus()` 讓外部可以 `bind:this` 後呼叫 `ref.focus()`：

```svelte
<!-- TagAutocomplete.svelte -->
<script lang="ts">
  let inputEl: HTMLInputElement;

  export function focus() {
    inputEl?.focus();
  }
</script>
```

外部使用：
```svelte
<TagAutocomplete bind:this={tagAcRef} ... />

<!-- 在 $effect 中 -->
tagAcRef?.focus();
```

### 10.6 逗號分隔輸入

現有 TagAutocomplete 支援逗號（`,`, `，`）觸發新增標籤。此行為應保留。

### 10.7 compact variant 的 COMPACT_VISIBLE 閾值

建議預設為 2，可以考慮未來作為 prop 暴露（如 `maxVisible`），但初版不必要。

---

## 11. 最終 API 速覽

```svelte
<!-- 上方擺：tagger / editor / browse -->
<TagAutocomplete bind:tags={editStore.tags} variant="top" onenter={commit} />

<!-- 側面擺：FilterBar / compare header -->
<TagAutocomplete bind:tags={filterTags} variant="inline" placeholder="篩選標籤..." />

<!-- compact：scroll header 等空間有限的場景 -->
<TagAutocomplete bind:tags={selectedTags} variant="compact" placeholder="篩選..." />

<!-- picker（rename）：用空 tags + watch -->
<TagAutocomplete bind:tags={tempTags} variant="top" placeholder="選擇標籤..." />
```
