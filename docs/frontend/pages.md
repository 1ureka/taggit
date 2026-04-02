# Pages

> 頁面（`+page.svelte`）是路由的唯一 template 檔案，呈現完整的 HTML 結構、所有 scoped 樣式，以及互動 class 的實例化。

---

## 職責

每個路由頁面的 `+page.svelte` 負責三件事：

1. **Class 實例化**：`<script>` 中 import class、解構 `$props()`、建立 instances
2. **完整的 HTML 結構**：整個頁面的 DOM 樹，包含語意標籤、無障礙屬性、事件綁定
3. **Scoped 樣式**：所有頁面級的 CSS

`+page.svelte` 的 `<script>` **不包含** `$state`、`$effect`、事件處理函式或業務判斷。所有互動邏輯封裝在 `*.svelte.ts` class 中。

### 允許的例外

- **簡單的 `$derived`**——僅限直覺的一行式資料轉換（如 `$derived(data.items.map(...))`），不涉及業務邏輯
- **Layout（`+layout.svelte`）**——可以持有少量自己的 `$state`（如導航面板的開關、全屏偵測），因為 layout 是全域 shell 的特殊案例

---

## 何時適用

**是 page 的情境：**

- 與路由綁定的 UI（`src/routes/**/+page.svelte`）
- 只在這個路由出現的 HTML/CSS 結構
- 頁面特有的互動邏輯（拆至同目錄下的 `*.svelte.ts`）

**不是 page 的情境：**

- 跨頁面復用的 UI 片段 → [共用組件](./components.md)
- 不依附特定頁面的獨立互動邏輯（如 zoom-pan、toast）→ `src/lib/ui/`

---

## Pattern 與組織

### 檔案結構

一個典型路由的目錄結構：

```
src/routes/tagger/
  +page.server.ts           ← SSR 資料載入
  +page.svelte              ← 完整 HTML + scoped 樣式 + class 實例化
  taggerPage.svelte.ts      ← 頁面級共享狀態 + SSR 同步
  taggerProgress.svelte.ts  ← 進度計算
  taggerList.svelte.ts      ← 列表選取 + 操作（多個 class 共存一檔）
  taggerPreview.svelte.ts   ← 預覽邏輯
  taggerForm.svelte.ts      ← 表單邏輯
```

命名慣例：

- Class 檔案：`{routeName}{Concern}.svelte.ts`（camelCase）
- Class 名稱：`{RouteName}{Concern}`（PascalCase）
- 一個檔案可 export 多個相關 class（如 `TaggerListSelect` + `TaggerListActions`）

### 常見的頁面 class 角色

| 角色              | 範例                  | 職責                                          |
| ----------------- | --------------------- | --------------------------------------------- |
| **Page**          | `TaggerPage`          | 頁面級共享狀態、SSR 資料同步 reconciliation    |
| **List / Select** | `TaggerListSelect`    | 列表選取邏輯（single / ctrl / shift）          |
| **Actions**       | `TaggerListActions`   | 列表操作（refresh、upload、delete）            |
| **Form**          | `TaggerForm`          | 表單邏輯、鍵盤快捷鍵、表單提交                |
| **Filter**        | `EditorFilter`        | 篩選條件、URL 同步、modal 管理                |
| **Preview**       | `TaggerPreview`       | 預覽圖片的載入與顯示邏輯                      |
| **Progress**      | `TaggerProgress`      | 純 `$derived` 計算（無 `$state`、無 handler） |

不需要每個頁面都有這些角色——根據頁面的複雜度按需拆分。簡單的頁面（如 compare）可能只有一個 class。

### Script 區塊 pattern

`<script>` 區塊只做三種事：import、`$props()`、實例化。

```svelte
<script lang="ts">
  // 1. 共用組件 import
  import Rating from "$lib/components/Rating.svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";

  // 2. 頁面 class import
  import { TaggerPage } from "./taggerPage.svelte.js";
  import { TaggerListSelect, TaggerListActions } from "./taggerList.svelte.js";
  import { TaggerForm } from "./taggerForm.svelte.js";

  // 3. SSR 資料
  let { data } = $props();

  // 4. （可選）簡單的 $derived 轉換
  const fileList = $derived(data.stagedFiles.map(f => ({
    id: f, name: f, imgSrc: `/api/images/${f}?size=sm`,
  })));

  // 5. Class 實例化——以 options 物件互相連接
  const pg = new TaggerPage({
    get stagedFiles() { return data.stagedFiles; },
  });

  const listSelect = new TaggerListSelect({
    get stagedFiles() { return data.stagedFiles; },
    get currentFile() { return pg.currentFile; },
    set currentFile(v) { pg.currentFile = v; },
    get selectedFiles() { return pg.selectedFiles; },
    set selectedFiles(v) { pg.selectedFiles = v; },
  });

  const form = new TaggerForm({
    get selectedFiles() { return pg.selectedFiles; },
    set selectedFiles(v) { pg.selectedFiles = v; },
  });
</script>
```

Class 之間的連接透過 options 物件完成——一個 class 的 `$state` 可以透過 getter/setter 被另一個 class 讀寫，不需要中間層。

→ 詳見 [ui.md](./ui.md)（options pattern、class 結構）

### Template pattern

Template 呈現完整的頁面 DOM 結構。所有事件綁定與狀態讀取來自 class instances：

```svelte
<svelte:window onkeydown={form.handleWindowKeydown} />

<aside>
  <header>
    <h2>列表</h2>
    <span class="badge">{listSelect.badgeLabel}</span>
    <button class="btn-icon" onclick={listActions.handleRefreshClick}>
      <IconRefresh size={14} />
    </button>
  </header>

  <div bind:this={listVirtual.listEl} onscroll={listVirtual.handleListScroll}>
    {#each listVirtual.visibleItems as item}
      <!-- ... -->
    {/each}
  </div>
</aside>

<section class:loading={preview.imageLoading}>
  <img src={preview.previewSrc} alt="" style="transform: {zp.transform}" />
</section>

<aside>
  <Rating bind:value={form.rating} size="1.5rem" />
  <Autocomplete bind:tags={form.tags} onchange={form.handleFieldChange} />
  <button class="btn-primary" class:pending={form.pending} onclick={form.handleFormSubmit}>
    <span>儲存</span>
  </button>
</aside>
```

Template 中不應出現業務判斷或脫離 class instance 的狀態計算。不同的前綴（`listSelect.*`、`form.*`、`preview.*`）讓閱讀者一眼就能分辨每段互動屬於哪個關注點。

### Snippets

頁面內的重複 HTML 片段使用 `{#snippet}` 定義：

```svelte
<!-- 定義 -->
{#snippet card(item: ImageWithId)}
  <figure>
    <img src={getSrc(item)} alt={item.name} />
    <figcaption class="ellipsis">{item.name}</figcaption>
  </figure>
{/snippet}

<!-- 使用 -->
{#each masonry.columns as column}
  {#each column as item}
    {@render card(item)}
  {/each}
{/each}
```

Snippet 也用於將內容注入共用組件（如 Modal）：

```svelte
<Modal bind:open={modal.open} onclose={modal.handleClose}>
  {#if modal.record}
    <article>
      <h2>{modal.record.name}</h2>
      <dl>...</dl>
    </article>
  {/if}
</Modal>
```

→ 詳見 [index.md](./index.md) 的「Snippets」段落，瞭解 snippet vs 組件的判斷依據

### 常用 Svelte 模板語法

| 語法              | 用途             | 範例                                               |
| ----------------- | ---------------- | -------------------------------------------------- |
| `class:xxx`       | 狀態驅動的 class | `class:pending={form.pending}`                     |
| `bind:this`       | DOM 引用傳給 class | `bind:this={zp.containerEl}`                      |
| `bind:value`      | 雙向綁定至共用組件 | `bind:value={form.rating}`                        |
| `{#key}`          | 強制重新渲染     | `{#key data.currentRecord.id}`                     |
| `{@const}`        | 模板內 const     | `{@const style = getBlurhash(item)}`               |
| `<svelte:window>` | 全域事件         | `<svelte:window onkeydown={form.handleWindowKeydown} />` |

### Scoped 樣式

所有頁面樣式集中在一個 `<style>` 區塊中。Svelte 編譯器會靜態分析這些選擇器，在選擇器未匹配任何模板元素時發出警告。

→ 詳見 [css.md](./css.md)（選擇器策略、命名慣例、nesting pattern）

### +page.server.ts

`+page.server.ts` 負責 SSR 資料載入。常見 pattern：

- 從 `url.searchParams` 讀取查詢條件
- 查詢資料庫，回傳 `data` 物件
- 必要時做 fallback（如當前 ID 不存在時選取第一筆）
- 用 `redirect` 處理邊界情境（如空結果集）

回傳的 `data` 在 `+page.svelte` 中以 `$props()` 接收，是 read-only reactive object。`goto()` 或 `invalidateAll()` 會觸發 `load` 重跑，props 自動更新。

→ SSR 資料的消費 pattern 詳見 [ui.md](./ui.md)
