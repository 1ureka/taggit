# `/compare` 路由 URL Query Params 遷移計畫

> 將 `/compare` 的篩選狀態從 `compareView.svelte.ts` 內部 `$state` 遷移為 URL query params 驅動，使篩選意圖可書籤化，並讓 SSR 依據篩選條件預載首組圖片。

---

## 一、現況分析

### 1.1 目前架構

```
+page.server.ts          SSR：無篩選，random limit=2
+page.svelte             接收 data，傳給 CompareView
CompareView.svelte        接收 pairA/pairB/total props，建立 createCompareView
  compareView.svelte.ts   內含 filterTags/filterMinRating $state + client API loadPair()
CompareCard.svelte        純展示元件（image + onclick）
```

### 1.2 資料流

1. **SSR**：`queryImages(db, { sort: "random", limit: 2 })` → 回傳 `pairA`、`pairB`、`total`
2. **篩選**：`filterTags` / `filterMinRating` 存於 `createCompareView` 內部 `$state`，變更時觸發 `loadPair()` → client-side `api.get('/api/images?sort=random&limit=2&...')`
3. **Shuffle**：按鈕或空白鍵觸發 `loadPair()`（同條件再抽一次）

### 1.3 問題

1. **SSR 不帶篩選**：無論使用者帶什麼 URL 進來，SSR 都是無條件隨機抽兩張；若使用者有篩選意圖（如書籤），首屏結果不符合預期。
2. **F5 / 返回遺失篩選**：篩選條件存於記憶體，重整後歸零，使用者需重新設定。
3. **不可書籤化**：「只比較 tag:landscape 且 ≥3 星」這類常用篩選無法保存為書籤。

### 1.4 特殊性質

- **隨機結果**：每次載入的圖片對不同，URL 只保存篩選意圖而非具體結果。這是預期行為。
- **Shuffle 操作不產生歷史**：使用者按空白鍵/按鈕是「刷新隨機」，不應產生瀏覽器歷史記錄。
- **無分頁**：固定取 2 張，不需要 `page` 參數。
- **`pairA`、`pairB` 是隨機結果**：不應從 URL 控制，由 SSR `load` 產生。

---

## 二、遷移目標

| 項目 | 遷移前 | 遷移後 |
| --- | --- | --- |
| 篩選狀態來源 | `createCompareView` 內部 `$state` | URL query params |
| 首組圖片來源 | SSR 無條件隨機 | SSR 依 URL params 隨機 |
| Shuffle | client API `loadPair()` | `invalidateAll()` → SSR `load` 重跑 |
| 篩選變更 | `loadPair()` client API | `goto()` → SSR `load` 重跑 |
| 重整/返回 | 篩選遺失 | URL 自動恢復 |

**關鍵設計**：所有資料統一由 SSR `load` 提供。篩選變更走 `goto()`，Shuffle 走 `invalidateAll()`（強制 `load` 重跑，因 `sort: "random"` 每次結果不同）。無 client API 呼叫，無內部圖片結果 `$state`。

---

## 三、URL 參數設計

沿用 `$lib/utils.ts` 的 `parseQueryParams()` / `buildQueryString()`：

```
/compare?tags=landscape,portrait&rating=3
```

| 參數 | 預設值 | 省略條件 |
| --- | --- | --- |
| `tags` | `[]`（空） | 無選擇時省略 |
| `rating` | `undefined` | 未設定時省略（`filterMinRating=0` 等同未設定） |

不包含的參數：`sort`（固定 `random`）、`order`（隨機不分方向）、`limit`（固定 `2`）、`ratingOp`（固定 `gte`）。

---

## 四、逐檔改動計畫

### 4.1 `+page.server.ts` — SSR 依 URL 篩選

**改動**：讀取 URL 的 `tags` 與 `rating`，帶入查詢。`sort` 固定 `random`、`limit` 固定 `2`。

```ts
import type { PageServerLoad } from "./$types.js";
import { redirect } from "@sveltejs/kit";
import { queryImages } from "$lib/server/db-query.js";
import { requireDatabase } from "$lib/server/helpers.js";
import { parseQueryParams } from "$lib/utils.js";

export const load: PageServerLoad = ({ url }) => {
  const loaded = requireDatabase();
  if (!loaded) throw redirect(303, "/settings?alert=error");

  const params = parseQueryParams(url);
  const result = queryImages(loaded.db, {
    tags: params.tags,
    rating: params.rating,
    ratingOp: params.rating !== undefined ? "gte" : undefined,
    sort: "random",
    limit: 2,
  });

  return {
    pairA: result.items[0] ?? null,
    pairB: result.items[1] ?? null,
    total: result.total,
  };
};
```

### 4.2 `+page.svelte` — 不變

頁面殼已符合規範：接收 `data`，傳 props 給 `CompareView`。無需改動。

```svelte
<CompareView pairA={data.pairA} pairB={data.pairB} total={data.total} />
```

### 4.3 `compareView.svelte.ts` — 篩選 URL 驅動 + Shuffle `invalidateAll`

**主要改動**：

1. `filterTags` / `filterMinRating` 初始值從 `page.url` 讀取（`parseQueryParams`）
2. 篩選變更時透過 `goto()` 導航（觸發 SSR `load` 重跑）
3. Shuffle 透過 `invalidateAll()` 強制 `load` 重跑（`sort: "random"` 保證每次結果不同）
4. 以 `afterNavigate({ type: "popstate" })` 監聽瀏覽器返回，從 URL 同步篩選值
5. **移除所有內部圖片結果 `$state`**：`pairA`、`pairB`、`totalCount`、`loading`、`showLoading`、`errorMsg` 全部移除，改由 props 直接驅動模板
6. **移除 `loadPair()`**：不再需要 client API 呼叫
7. **移除 `api`、`addToast` 匯入**

```ts
import { goto, invalidateAll, afterNavigate } from "$app/navigation";
import { navigating } from "$app/state";
import { page } from "$app/state";
import { parseQueryParams, buildQueryString } from "$lib/utils.js";
import { isInEditable } from "$lib/client/dom.js";

export function createCompareView() {
  const init = parseQueryParams(page.url);

  /** 篩選標籤 */
  let filterTags = $state<string[]>(init.tags ?? []);
  /** 最低評等篩選值（0 = 不篩選） */
  let filterMinRating = $state(init.rating ?? 0);

  // ---

  // popstate 同步
  afterNavigate(({ type }) => {
    if (type === "popstate") {
      const vals = parseQueryParams(page.url);
      filterTags = vals.tags ?? [];
      filterMinRating = vals.rating ?? 0;
    }
  });

  /** 構建當前篩選的 query string */
  function currentQueryString(): string {
    return buildQueryString({
      tags: filterTags,
      rating: filterMinRating > 0 ? filterMinRating : undefined,
    });
  }

  // ---

  /** 處理 Filter 變更事件，以 goto() 導航觸發 SSR 重跑 */
  function handleFilterChange() {
    goto(`/compare${currentQueryString()}`, {
      replaceState: true,
      noScroll: true,
      keepFocus: true,
    });
  }

  /** 處理 Shuffle 按鈕點擊事件，invalidateAll 強制 load 重跑 */
  function handleShuffleClick() {
    invalidateAll();
  }

  /** 處理 Card 點擊事件，在 Editor 中開啟圖片 */
  function handleCardClick(id: string) {
    window.open(`/editor/${encodeURIComponent(id)}`, "_blank");
  }

  /** 處理 Window 鍵盤事件，按空白鍵觸發 Shuffle */
  function handleWindowKeydown(e: KeyboardEvent) {
    if (isInEditable(e.target)) return;
    if (e.key === " ") {
      e.preventDefault();
      invalidateAll();
    }
  }

  // ---

  return {
    get filterTags() { return filterTags; },
    set filterTags(v: string[]) { filterTags = v; },
    get filterMinRating() { return filterMinRating; },
    set filterMinRating(v: number) { filterMinRating = v; },

    handleFilterChange,
    handleShuffleClick,
    handleCardClick,
    handleWindowKeydown,
  };
}
```

**操作行為一覽**：

| 操作 | 觸發方式 | 結果來源 | 是否產生歷史 |
| --- | --- | --- | --- |
| 篩選變更 | `goto()` + `replaceState` | SSR `load` 重跑 | 否（replaceState） |
| Shuffle | `invalidateAll()` | SSR `load` 重跑 | 否 |
| 瀏覽器返回 | popstate | `afterNavigate` 同步 | — |

### 4.4 `CompareView.svelte` — 簡化

**改動**：

1. `createCompareView()` 不再接收 options（無內部圖片 `$state`）
2. 篩選 handler 合併為 `handleFilterChange`
3. `pairA`、`pairB`、`total` 直接在模板中使用 props（SSR data 響應式更新，無需 `$effect` 同步）
4. 載入狀態改用 `navigating` store
5. 移除 `syncFromData` 及對應 `$effect`

```svelte
<script lang="ts">
  import type { ImageWithId } from "$lib/types.js";
  import { navigating } from "$app/state";
  import { IconArrowLeft, IconArrowsShuffle } from "@tabler/icons-svelte";
  import AutocompleteCompact from "$lib/components/AutocompleteCompact.svelte";
  import Rating from "$lib/components/Rating.svelte";
  import CompareCard from "./CompareCard.svelte";
  import { createCompareView } from "./compareView.svelte.js";

  type Props = {
    pairA: ImageWithId | null;
    pairB: ImageWithId | null;
    total: number;
  };

  let { pairA, pairB, total }: Props = $props();

  const ui = createCompareView();
</script>

<svelte:window onkeydown={ui.handleWindowKeydown} />

<header class="page-header">
  <!-- ... -->
  <div class="compare-header-filter">
    <AutocompleteCompact bind:tags={ui.filterTags} placeholder="標籤篩選..." onchange={ui.handleFilterChange} />
    <Rating bind:value={ui.filterMinRating} size="1rem" onchange={ui.handleFilterChange} />
    <span class="compare-count">{total} 張</span>
  </div>
</header>

<main class="compare-main">
  {#if navigating}
    <div class="compare-empty">載入中…</div>
  {:else if !pairA || !pairB}
    <div class="compare-empty">篩選條件下的圖片不足兩張</div>
  {:else}
    <CompareCard image={pairA} onclick={() => ui.handleCardClick(pairA.id)} />
    <CompareCard image={pairB} onclick={() => ui.handleCardClick(pairB.id)} />
  {/if}
</main>

<footer class="compare-footer">
  <button class="btn btn-primary" onclick={ui.handleShuffleClick} disabled={!!navigating}>
    <IconArrowsShuffle size={18} />
    換一組 <span class="kbd">Space</span>
  </button>
</footer>
```

### 4.5 `CompareCard.svelte` — 不變

純展示元件，不涉及篩選狀態。

---

## 五、遷移後檔案結構

```
+page.server.ts          SSR：parseQueryParams(url) → queryImages({ ..., sort: "random", limit: 2 })
+page.svelte             不變（接收 data，傳 props 給 CompareView）
CompareView.svelte        簡化（props 直接驅動模板、navigating 顯示載入狀態）
  compareView.svelte.ts   僅含篩選狀態 + goto() / invalidateAll()（無 client API、無內部圖片 $state）
CompareCard.svelte        不變
```

**無新增或刪除檔案。**

---

## 六、移除項目清單

遷移後從 `compareView.svelte.ts` 中移除：

| 移除項目 | 原因 |
| --- | --- |
| `pairA` / `pairB` / `totalCount` `$state` | 改由 props 直接驅動 |
| `loading` / `showLoading` `$state` | 改用 `navigating` store |
| `errorMsg` `$state` | 改為模板中直接判斷 `!pairA \|\| !pairB` |
| `loadPair()` | 改用 `invalidateAll()` |
| `LOADING_DELAY` / `loadingTimer` | 隨 `loading` 一起移除 |
| `api` / `addToast` 匯入 | 不再需要 client API |
| `CompareViewOptions` type | 工廠函數不再接收 options |
| `syncFromData()` | 不再有內部 `$state` 需要同步 |

---

## 七、注意事項

1. **`filterMinRating` 映射**：現有 `filterMinRating = 0` 表示不篩選，對應 URL 中省略 `rating` 參數。`parseQueryParams` 回傳 `undefined` 時映射為 `0`。
2. **`replaceState: true`**：篩選變更使用 `replaceState`，避免每次調整篩選都產生歷史記錄。
3. **`invalidateAll()` 用於 Shuffle**：`sort: "random"` 保證每次 `load` 重跑結果不同。`invalidateAll()` 不改變 URL，不產生歷史記錄，效果等同「同條件再抽一次」。
4. **無 `$effect` 同步需求**：由於 `pairA`/`pairB`/`total` 不再存為內部 `$state`，SSR data 更新後 props → 模板自動重繪，無需橋接邏輯。
5. **JSDoc / 程式碼編排**：依 `frontend.md` §2.6、§2.7 規範。
