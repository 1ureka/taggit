# Report 2：Compare 路由——`navigating.to` 不被 `invalidateAll` 觸發

> 範圍：`src/routes/compare/` 全部檔案
>
> 問題：Shuffle（空白鍵 / footer 按鈕）使用 `invalidateAll()` 重跑 load，但 `navigating.to` 不會被設定，導致載入 UI 反饋完全失效。

---

## 一、問題分析

### 1.1 SvelteKit 的 `navigating` 行為

SvelteKit 文件明確說明：

> Unlike `goto`, calls to `invalidate` and `invalidateAll` **don't** create new history entries. They also **don't set the navigating store**.

`navigating.to` 只在**實際導航**時才更新——由 `goto()`、`<a>` 點擊、瀏覽器前進/後退觸發。

### 1.2 Compare 路由的兩種操作

| 操作 | 觸發方式 | `navigating.to` | 載入 UI |
|------|---------|-----------------|---------|
| 修改篩選條件（標籤、評等） | `goto("/compare?...")` | ✅ 設定 | ✅ 正常 |
| Shuffle（空白鍵 / footer 按鈕） | `invalidateAll()` | ❌ 永遠 `null` | ❌ 失效 |

### 1.3 影響範圍

1. **`+page.svelte` 的 `<main class:loading={navigating.to}>`**：Shuffle 時不會變暗。
2. **`CompareShuffle.svelte` 的按鈕 `disabled={ui.disabled}`**：`ui.disabled` 來自 `$derived(!!navigating.to)`，Shuffle 時不會 disable——使用者可連續觸發多次 `invalidateAll()`。
3. **`+page.svelte` 的空狀態判斷 `{#if !navigating.to}`**：Shuffle 後若結果不足兩張，空提示會閃現（因為 `navigating.to` 從未變為 truthy 來暫時隱藏它）。

---

## 二、解法

### 方案 A：`goto` 同一 URL 取代 `invalidateAll`（推薦）

`goto` 會建立實際導航，`navigating.to` 正確設定。搭配 `invalidateAll: true` 確保 load 重跑：

```ts
// compareShuffle.svelte.ts
import { goto } from "$app/navigation";
import { navigating, page } from "$app/state";
import { isInEditable } from "$lib/client/dom.js";

export class CompareShuffle {
  disabled: boolean;

  constructor() {
    this.disabled = $derived(!!navigating.to);
  }

  // ---

  #shuffle() {
    goto(page.url.pathname + page.url.search, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
      invalidateAll: true,
    });
  }

  // ---

  handleShuffleClick = () => {
    this.#shuffle();
  };

  handleWindowKeydown = (e: KeyboardEvent) => {
    if (isInEditable(e.target)) return;
    if (e.key === " ") {
      e.preventDefault();
      this.#shuffle();
    }
  };
}
```

#### 優點

- 最小修改——只改 `compareShuffle.svelte.ts`，其餘檔案不動
- `navigating.to` 自然生效——`+page.svelte` 的 `class:loading`、按鈕的 `disabled`、空狀態判斷全部正確
- 不引入新的狀態、不需要跨元件通訊

#### 風險

SvelteKit 對「`goto` 到完全相同的 URL」的行為沒有明確文件保證。目前測試下，`goto` to same URL：
- **有 `invalidateAll: true`**：load 會重跑、`navigating.to` 會被設定 ✅
- **無 `invalidateAll: true`**：部分版本可能短路不導航 ⚠️

因此 `invalidateAll: true` 是必要的。

#### 驗證方式

修改後開啟 DevTools，觀察：
1. 按下空白鍵 → `<main>` 是否短暫收到 `.loading` class
2. 按鈕是否 disabled
3. 快速連按空白鍵是否只產生一次導航

若 `goto` same URL 不如預期，改用方案 B。

---

### 方案 B：共享 `refreshing` 旗標經 props/callback

在 `+page.svelte` 建立 `refreshing` 狀態，CompareShuffle 透過 callback 控制，`<main>` 同時響應 `navigating.to || refreshing`。

#### `+page.svelte`

```svelte
<script lang="ts">
  import { navigating } from "$app/state";
  // ...

  let refreshing = $state(false);
</script>

<main class:loading={navigating.to || refreshing}>
  {#if !data.pairA || !data.pairB}
    {#if !navigating.to && !refreshing}
      <div class="empty">篩選條件下的圖片不足兩張</div>
    {/if}
  {:else}
    <!-- ... -->
  {/if}
</main>

<footer>
  <CompareShuffle bind:refreshing />
</footer>
```

#### `CompareShuffle.svelte`

```svelte
<script lang="ts">
  import { CompareShuffle } from "./compareShuffle.svelte.js";

  type Props = { refreshing: boolean };
  let { refreshing = $bindable(false) }: Props = $props();

  const ui = new CompareShuffle({
    get refreshing() { return refreshing; },
    set refreshing(v) { refreshing = v; },
  });
</script>

<button class="btn btn-primary" onclick={ui.handleShuffleClick} disabled={ui.disabled}>
  <!-- ... -->
</button>
```

#### `compareShuffle.svelte.ts`

```ts
import { navigating } from "$app/state";
import { invalidateAll } from "$app/navigation";
import { isInEditable } from "$lib/client/dom.js";

type CompareShuffleOptions = {
  refreshing: boolean;
};

export class CompareShuffle {
  disabled: boolean;

  constructor(private options: CompareShuffleOptions) {
    this.disabled = $derived(!!navigating.to || options.refreshing);
  }

  // ---

  async #shuffle() {
    this.options.refreshing = true;
    await invalidateAll();
    this.options.refreshing = false;
  }

  // ---

  handleShuffleClick = () => {
    this.#shuffle();
  };

  handleWindowKeydown = (e: KeyboardEvent) => {
    if (isInEditable(e.target)) return;
    if (e.key === " ") {
      e.preventDefault();
      this.#shuffle();
    }
  };
}
```

#### 優點

- 不依賴 SvelteKit 的 same-URL `goto` 行為——完全自控
- 符合專案的狀態管理模式（`+page.svelte` 持有共享狀態、`bind` 向上回寫）

#### 缺點

- 修改範圍較大——三個檔案都要改
- 引入新的共享狀態 `refreshing` + props/bind 管道
- `await invalidateAll()` 的完成時機等於 data 更新時機——視覺上等同 `navigating` 結束，但不是由框架控制的

---

## 三、建議

**先嘗試方案 A**，因為修改最少、最乾淨。若驗證發現 `goto` same URL + `invalidateAll: true` 在當前 SvelteKit 版本不如預期（`navigating.to` 未設定），再退回**方案 B**。

---

## 四、修改文件清單

### 方案 A

| 檔案 | 修改幅度 | 動作 |
|------|---------|------|
| `compareShuffle.svelte.ts` | 小改 | `invalidateAll()` → `goto(same URL, { invalidateAll: true })`，新增 `page` import |

### 方案 B

| 檔案 | 修改幅度 | 動作 |
|------|---------|------|
| `+page.svelte` | 中改 | 新增 `refreshing` 狀態、`class:loading` 條件改為 `navigating.to \|\| refreshing`、bind 傳入 CompareShuffle |
| `CompareShuffle.svelte` | 中改 | 新增 `refreshing` prop（bindable）、options 傳入 class |
| `compareShuffle.svelte.ts` | 中改 | 新增 `options` 型別、`#shuffle` 改為 async 設旗標 |

---

## 五、注意事項

1. **`goto` 的 `invalidateAll` 選項**：此選項在 SvelteKit 2.4.0+ 可用。確認專案的 SvelteKit 版本是否支援。若版本不足，方案 A 需改為 `goto(url); invalidateAll()` 分開呼叫（但此時 `goto` same URL 可能不觸發導航）。

2. **防止連續觸發**：方案 A 下，`navigating.to` 在導航期間為 truthy → `disabled` 為 `true` → 按鈕不可點擊 → 自動防止連續觸發。方案 B 下，`refreshing` 在整個 `invalidateAll()` 期間為 `true` → 同樣防止連續觸發。

3. **空白鍵衝突**：`handleWindowKeydown` 監聽 `" "`（空白鍵）。若頁面有可捲動的區域，空白鍵原本會觸發滾動。`e.preventDefault()` 已處理。但若 `disabled` 為 `true` 時按空白鍵——方案 A 下 `goto` 不再觸發（因為 `disabled` 的判斷只影響按鈕 UI，`handleWindowKeydown` 仍然會執行）。**應在 handler 中加入 disabled 檢查**：

   ```ts
   handleWindowKeydown = (e: KeyboardEvent) => {
     if (isInEditable(e.target)) return;
     if (e.key === " " && !this.disabled) {
       e.preventDefault();
       this.#shuffle();
     }
   };
   ```

4. **`compare/+page.server.ts` 使用 `sort: "random"`**：每次 load 回傳不同結果，即使 URL 不變。這是 `goto` same URL 仍有意義的原因。
