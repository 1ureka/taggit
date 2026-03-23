# Proposal: 1 Page ⇒ N Class 架構

> 本提案定義頁面級的全新組織方式：每個路由只保留 `+page.svelte` 作為唯一的 `.svelte` 檔案，所有頁面特有的邏輯拆分至 `*.svelte.ts` class 檔案。共用元件不受影響，仍遵循現有規範。

---

## 一、背景與動機

### 1.1 現行架構的觀察

現行規範（frontend.md §1.1）定義了明確的檔案角色：

| 檔案                  | 職責                               |
| --------------------- | ---------------------------------- |
| `+page.svelte`        | 接收 data、共享狀態、組裝子元件    |
| `Component.svelte`    | 子元件結構與樣式、class 實例化     |
| `component.svelte.ts` | 無頭 UI class                      |

這套結構對共用元件而言是健全的——`Rating.svelte`、`Autocomplete.svelte` 等元件有明確的復用場景。然而對於**頁面特有的子元件**，拆分帶來的開銷逐漸顯現。

### 1.2 以 tagger 頁面為例

目前 `src/routes/tagger/` 的檔案結構：

```
+page.server.ts
+page.svelte
TaggerProgress.svelte    + taggerProgress.svelte.ts
TaggerList.svelte        + taggerList.svelte.ts（3 個 class）
TaggerListItem.svelte    （純展示）
TaggerPreview.svelte     + taggerPreview.svelte.ts
TaggerForm.svelte        + taggerForm.svelte.ts
```

共 7 個 `.svelte` + 4 個 `.svelte.ts`，其中：

- **HTML 結構散落在 6 個檔案**——要理解完整的 DOM 語意樹，必須在檔案間反覆跳轉
- **中間組件只是橋接容器**——如 `TaggerProgress.svelte`，`<script>` 僅做 class 實例化，HTML 僅 3 個元素
- **Prop 嫁接鏈**——`selectedFiles`、`currentFile` 從 `+page.svelte` → 子元件 `.svelte` → class options，每層都需要 `$bindable` + getter/setter
- **視覺自由受限**——若設計需要調整元素在 DOM 中的位置，得移動整個組件引用並重新串接 props

### 1.3 核心洞察

問題的根源在於：**我們同時拆分了「結構」與「邏輯」，但兩者的最佳切割線並不一致**。邏輯的切割線是「職責」（選取、表單、虛擬化...），結構的切割線是「完整的頁面 DOM 樹」。將兩者綁在同一個組件邊界上，勢必犧牲其一。

§2.5「一個元件對應多個 class」已在 TaggerList 上驗證了邏輯拆分不需要與組件拆分 1:1 對應。本提案將這個思路推廣到整個頁面。

---

## 二、提案內容

### 2.1 核心規則

對於每個路由頁面：

> **一個路由只有一個 `+page.svelte`，沒有任何頁面特有的 `*.svelte` 子元件。所有頁面特有的互動邏輯拆分至 `*.svelte.ts` class 檔案。**

頁面的檔案結構變為：

```
+page.server.ts           ← SSR 資料載入
+page.svelte              ← 完整的 HTML 結構 + 所有 scoped 樣式 + class 實例化
featureA.svelte.ts         ← 邏輯 class A
featureB.svelte.ts         ← 邏輯 class B
featureC.svelte.ts         ← 邏輯 class C（一個檔案可含多個 class）
```

### 2.2 `+page.svelte` 的職責

`+page.svelte` 承擔三件事：

1. **Class 實例化**——`<script>` 中 import class、解構 props、建立 instances
2. **完整的 HTML 結構**——整個頁面的 DOM 樹，包含語意標籤、無障礙屬性、事件綁定
3. **Scoped 樣式**——所有頁面級的 CSS，由 Svelte 編譯器靜態分析

`+page.svelte` 的 `<script>` **不得包含** `$effect`、事件處理函式或業務判斷。頁面級的狀態同步必須封裝為一個 class，即使內部只有一個 constructor + `$effect`。

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import { TaggerProgress } from "./taggerProgress.svelte.js";
  import { TaggerListSelect, TaggerListActions, TaggerListVirtual } from "./taggerList.svelte.js";
  import { TaggerPreview } from "./taggerPreview.svelte.js";
  import { TaggerForm } from "./taggerForm.svelte.js";
  import { TaggerPage } from "./taggerPage.svelte.js";
  import Rating from "$lib/components/Rating.svelte";
  import Autocomplete from "$lib/components/Autocomplete.svelte";
  // ...共用元件照常 import

  let { data } = $props();

  // 頁面級狀態同步（原本 +page.svelte 的 $effect 也收進 class）
  const pg = new TaggerPage({
    get stagedFiles() { return data.stagedFiles; },
  });

  const progress = new TaggerProgress({
    get stagedFiles() { return data.stagedFiles; },
    get progress() { return pg.progress; },
  });

  const listSelect = new TaggerListSelect({
    get stagedFiles() { return data.stagedFiles; },
    get currentFile() { return pg.currentFile; },
    set currentFile(v) { pg.currentFile = v; },
    get selectedFiles() { return pg.selectedFiles; },
    set selectedFiles(v) { pg.selectedFiles = v; },
  });

  const listActions = new TaggerListActions();

  const listVirtual = new TaggerListVirtual({
    get stagedFiles() { return data.stagedFiles; },
    get currentFile() { return pg.currentFile; },
  });

  const preview = new TaggerPreview({ /* ... */ });
  const form = new TaggerForm({ /* ... */ });
</script>

<svelte:head>
  <title>Tagger — Image Manager</title>
</svelte:head>

<!-- 完整的頁面結構一覽無遺 -->
<div class="page">
  <header class="page-header">
    <a href="/" class="btn-ghost btn-sm">...</a>
    <div class="tagger-progress">
      <div class="progress-bar">
        <div class="progress-bar-fill" style="width:{progress.progressPct}%"></div>
      </div>
      <span class="progress-text">{progress.progressLabel}</span>
    </div>
  </header>

  <main>
    <aside class="sidebar">
      <header>
        <div class="title">
          <h1>待審查列表</h1>
          <span class="badge">{listSelect.badgeLabel}</span>
        </div>
        <button class="btn-icon" onclick={listActions.handleRefreshClick}>...</button>
      </header>

      <div class="list" bind:this={listVirtual.listEl} onscroll={listVirtual.handleListScroll}>
        <!-- 虛擬列表渲染 -->
      </div>

      <footer>
        <label class="btn-outlined">
          <input type="file" accept="image/*" multiple onchange={listActions.handleUploadChange} />
        </label>
      </footer>
    </aside>

    <section class="preview">
      <!-- 預覽區域 -->
    </section>

    <aside class="panel">
      <!-- 表單：Rating（共用元件）、Autocomplete（共用元件）、操作按鈕 -->
      <Rating bind:value={form.rating} size="1.5rem" />
      <Autocomplete bind:tags={form.tags} variant="top" placeholder="輸入標籤..." />
      <!-- ... -->
    </aside>
  </main>
</div>

<style>
  /* 所有頁面樣式集中於此，Svelte 靜態分析未使用的選擇器 */
</style>
```

### 2.3 禁止 `+page.svelte` 撰寫 `$effect`

過去 `+page.svelte` 承擔了頁面級的狀態同步責任（如 `currentFile` 和 `selectedFiles` 對 `data.stagedFiles` 的 reconciliation），這些 `$effect` 現在必須封裝在專屬的 class 中：

```ts
// taggerPage.svelte.ts

type TaggerPageOptions = {
  stagedFiles: string[];
};

/**
 * 頁面級的共享狀態與 SSR 資料同步
 */
export class TaggerPage {
  currentFile = $state<string | null>(null);
  selectedFiles = $state<Set<string>>(new Set());
  progress = $state(0);

  constructor(private options: TaggerPageOptions) {
    // 初始化
    const first = options.stagedFiles[0] ?? null;
    this.currentFile = first;
    this.selectedFiles = first ? new Set([first]) : new Set();

    // SSR 資料變動時的 reconciliation
    $effect(() => {
      const list = options.stagedFiles;

      if (this.currentFile === null && list.length > 0) {
        this.currentFile = list[0];
        this.selectedFiles = new Set([list[0]]);
        return;
      }

      if (this.currentFile !== null && list.length > 0) {
        if (!list.includes(this.currentFile)) {
          this.currentFile = list[0];
        }
        const next = new Set([...this.selectedFiles].filter((f) => list.includes(f)));
        if (next.size === 0) {
          this.selectedFiles = new Set([this.currentFile]);
        } else if (next.size !== this.selectedFiles.size) {
          this.selectedFiles = next;
        }
        return;
      }

      if (this.currentFile !== null && list.length <= 0) {
        this.currentFile = null;
        this.selectedFiles = new Set();
        return;
      }
    });
  }
}
```

這使得 `+page.svelte` 的 `<script>` 只剩三種語句：`import`、`$props()`、`new`。頁面成為純粹的宣告式模板。

### 2.4 共用元件不受影響

共用元件的定義與判斷標準不變：

- `src/lib/components/` 中的 `.svelte` 元件（如 `Rating`、`Autocomplete`、`Modal`）
- `src/lib/ui/` 中的 `.svelte.ts` 無頭 UI（如 `zoom-pan.svelte.ts`）

這些元件有明確的跨頁面復用場景，仍遵循現有的雙檔案結構（§2.1–2.5）。在 `+page.svelte` 中以 import 使用它們，與使用原生 HTML 元素無異。

**判定原則**：如果一段 UI 只在這個頁面出現，它就不是共用元件，它的 HTML 歸 `+page.svelte`、邏輯歸 `*.svelte.ts`。

### 2.5 Svelte Snippet 取代頁面內重複片段

對於頁面內的重複 HTML 片段（如 tagger 的快捷鍵列表），使用 Svelte 的 `{#snippet}` 在同一個 `+page.svelte` 內定義並復用，而非拆成子元件：

```svelte
{#snippet key(label: string, keys: string[])}
  <div>
    <div>
      {#each keys as k}
        <span class="kbd">{k}</span>
      {/each}
    </div>
    {label}
  </div>
{/snippet}

{@render key("切換圖片", ["←", "→"])}
{@render key("評等", ["1", "-", "5"])}
```

---

## 三、優勢分析

### 3.1 完整的 HTML 結構可見性

**之前**：打開 `+page.svelte` 只看到 `<TaggerList />`、`<TaggerPreview />`、`<TaggerForm />`——語意標籤、DOM 層級、`id` / `aria-*` 屬性全部隱藏在子元件內部。

**之後**：打開 `+page.svelte` 就能看到完整的 `<header>`、`<main>`、`<aside>`、`<section>`、`<footer>` 結構、所有的 `role` / `aria-label` / `id` 屬性、以及它們的巢狀關係。任何一位開發者——無論是否熟悉專案——一眼就能掌握頁面的語意架構。

### 3.2 無障礙（Accessibility）維護性

無障礙開發最大的挑戰是：**需要全局視角**。ARIA landmarks、focus 管理、鍵盤導航路徑都需要理解整個頁面的 DOM 結構。

在組件化架構中，`role="navigation"` 可能在 A 組件、`aria-controls` 的目標 `id` 在 B 組件、鍵盤事件處理在 C 組件——跨 3 個檔案才能審計一個無障礙功能。

在本提案中，所有語意標記集中在 `+page.svelte`，一個檔案內即可完成完整的無障礙審計。

### 3.3 消除 Prop 嫁接

現行架構中，共享狀態的流動路徑為：

```
+page.svelte ($state)
  → Component.svelte ($bindable + getter/setter)
    → class options
```

每一層都需要撰寫 `$bindable` 宣告、getter/setter 橋接程式碼。這不是邏輯，只是搬運——但它佔了子元件 `.svelte` 檔案的大部分 `<script>` 內容。

在本提案中，`+page.svelte` 直接實例化所有 class，共享狀態的流動路徑縮短為：

```
+page.svelte (class instances)
  → class A options (getter/setter 直接引用另一個 class instance)
  → class B options (同上)
```

中間橋接層完全消失。

### 3.4 視覺自由：結構與邏輯解耦

在組件化架構中，HTML 結構被綁在邏輯單元上——哪些 HTML 屬於「列表」元件、哪些屬於「表單」元件。如果設計稿將「列表標題」和「操作按鈕」放在同一個視覺區塊，但它們分屬不同邏輯單元，就面臨兩難：
- 放在一起 → 邏輯職責混亂
- 分開放 → 視覺結構與 HTML 結構不一致，樣式難寫

本提案消除了這個衝突。HTML 結構完全遵從設計稿的視覺佈局，邏輯拆分獨立進行，兩者互不干涉。開發者可以自由排列 HTML 元素，絲毫不必考慮「這個元素歸哪個組件管」。

### 3.5 樣式的集中與靜態分析

所有頁面樣式集中在一個 `<style>` 區塊中。Svelte 編譯器會靜態分析這些選擇器：

- **未使用的選擇器**——編譯器主動警告
- **Scoped 隔離**——同名 class 不會與其他頁面衝突
- **結構式選擇器**（theme.md §3）——`.card`、`.field-*`、`.actions` 等命名在單一檔案中清晰無歧義

無需在 6 個檔案中追蹤「這個樣式是誰的」、「header 是哪個 scope 的 header」。

### 3.6 Effect 的安身之處

過去 `+page.svelte` 被允許寫 `$effect`，這讓頁面級的響應式同步邏輯沒有明確的歸屬——它既不是「共享狀態宣告」也不是「無頭 UI class」，而是夾在中間的膠水。

本提案將所有 `$effect` 收進 class，使得每一段狀態同步邏輯都有明確的所屬 class、明確的職責範圍。即使一個 class 只有一個 constructor + 一個 `$effect`，它也為這段邏輯提供了清晰的邊界和可搜尋的名稱。

### 3.7 契合 90% 網站的複雜度

除非是 Figma、Facebook 等級的超大型應用，絕大部分網站的單一頁面結構並不需要深層元件樹。一個頁面的 HTML 通常在 200–400 行之間——這個規模完全在一個檔案中可讀、可維護。加上 scoped 樣式，一個 `+page.svelte` 可能在 700–1000 行，但其中大半是 CSS——而 CSS 的維護有 Svelte 編譯器輔助，與等量的 JavaScript 業務邏輯截然不同。

---

## 四、適用範圍

### 4.1 適用

- 專案中所有 `src/routes/` 下的路由頁面
- 頁面特有的、不跨頁復用的 UI 片段

### 4.2 不適用

- **共用元件**（`src/lib/components/`、`src/lib/ui/`）——仍遵循 frontend.md 現有規範
- **跨頁面復用的子元件**——判定標準：如果移除這個頁面，這段 UI 仍有其他使用者，那它就是共用元件

### 4.3 子路由

若一個路由有子路由（如 `editor/[id]/`），各子路由的 `+page.svelte` 各自獨立遵循本提案。`+layout.svelte` 扮演的是跨子路由的共享佈局角色，不受此提案影響。

---

## 五、架構對照

以 tagger 頁面為例，遷移前後的檔案結構對比：

### 遷移前

```
+page.server.ts
+page.svelte                 ← 組裝子元件 + 共享狀態 + $effect
TaggerProgress.svelte        ← 3 行 HTML + class 實例化
taggerProgress.svelte.ts
TaggerList.svelte            ← HTML + class 實例化 + 樣式
taggerList.svelte.ts         ← 3 個 class
TaggerListItem.svelte        ← 純展示
TaggerPreview.svelte         ← HTML + class 實例化 + 樣式
taggerPreview.svelte.ts
TaggerForm.svelte            ← HTML + class 實例化 + 樣式
taggerForm.svelte.ts
```

**11 個檔案**（7 `.svelte` + 4 `.svelte.ts`）

### 遷移後

```
+page.server.ts
+page.svelte                 ← 完整 HTML + 所有 scoped 樣式 + class 實例化
taggerPage.svelte.ts         ← 頁面級共享狀態 + SSR 同步
taggerProgress.svelte.ts     ← 進度計算邏輯
taggerList.svelte.ts         ← 列表選取 / 操作 / 虛擬化（3 個 class）
taggerPreview.svelte.ts      ← 預覽邏輯
taggerForm.svelte.ts         ← 表單邏輯
```

**7 個檔案**（1 `.svelte` + 6 `.svelte.ts`），減少 4 個檔案，消除所有中間 `.svelte` 橋接層。

---

## 六、與現有規範的關係

本提案修改 frontend.md 以下章節的適用範圍：

| 章節                    | 變更                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------- |
| §1.1 檔案職責           | `+page.svelte` 不再「不得包含事件處理」——它直接綁定 class handler；移除「即便頁面極其簡單仍須抽出子元件」的要求 |
| §1.4 `$state` 宣告位置  | `+page.svelte` 不再宣告 `$state`——所有狀態由 class 持有                                  |
| §2.1–2.3 雙檔案結構     | 對共用元件不變；頁面特有的子元件不再適用                                                   |
| §2.5 多 class           | 從「一個元件多個 class」推廣為「一個頁面多個 class 檔案」                                   |
| §3 共享狀態             | Props/bind 模式改為「class 之間透過 options getter/setter 引用同一個 class instance 的狀態」  |
| §4.2 可寫入 SSR 狀態    | `+page.svelte` 不再寫 `$effect`——SSR 同步由專屬 class 負責                                |

不變的章節：§2.4 共用元件、§3.5 機制與策略分離、§5 URL 狀態、§6 Debounce、theme.md 全部。

---

## 七、設計哲學

### 「清晰大於聰明」（Clarity over Cleverness）

Go 語言社群的核心價值觀。一個檔案看到完整結構，勝過精巧的組件抽象。

### 「結構服務於人，邏輯服務於機器」

HTML 結構是寫給人看的——語意、無障礙、視覺對應。邏輯是寫給機器跑的——狀態管理、事件處理、API 呼叫。兩者的切割線本就不同，不該被綁在同一個組件邊界上。

### 「拆分的維度決定了代價」

傳統做法沿組件邊界同時拆分結構和邏輯，得到的是：結構碎片化 + prop 嫁接 + 視覺約束。本提案只沿邏輯邊界拆分，結構保持完整，得到的是：完整可見的 DOM 樹 + 零橋接 + 視覺自由。
