# `compare` controller 架構重設計

> 這份文件只談 `compare` 路由的 controller 邊界要怎麼改，讓它達到 `committed` 的乾淨程度。範圍限定在 `src/routes/compare/**`，以及一個會被兩個路由共用的工具函式（`shallowSearchParam`）的廣義化——這處共用工具的異動已經過確認，且對 `committed` 既有呼叫點是純加法、零行為改變（見下方證明）。除此之外**不動 committed 或其他路由**。

尚未實作，先收斂設計；確認沒問題後才動手改程式碼。

---

## 0. 對照的 taste（照抄你的原文，作為後面每一節的判準）

```
controller:
- 刻意簡單化
- 正交且單一職責
- 避免重複權威來源
- 只暴露最少的方法

投影:
- 通常寫在模板的 derived，且可以單純因為 derived 很長而拆組件
- 不必去重、可以複雜、可以很長、可以需要數個 controller 組合
- 但複雜不代表組合方式很多，同一種投影應該只會有一種方式組合
- 若發現既可以從 A 拿，也可以從 B 拿、用 C + D 推導，那不是投影寫錯(不該搞錯重點)，而是 controller 沒寫好
```

---

## 1. 現況盤點：四個問題點，各自對應到哪一條 taste

### 1-1. `refresh` 跟 `revert` 共用同一個 `pending` 鎖 → 違反「正交且單一職責」

`operations.svelte.ts` 目前同時管兩件不相關的事：

```ts
class OperationsController {
  pending = $state(false); // handleRefresh 跟 handleRevert 共用同一個鎖

  handleRefresh = async () => { /* 用 this.pending */ };
  handleRevert = async (id) => { /* 也用 this.pending */ };
}
```

對照 `committed`：`query.refreshing` 跟 `submit.pending` 是完全獨立的兩個 state，分別活在各自的 controller 裡，互不知情、也互不阻擋。`compare` 這裡等於把兩個本來無關的非同步操作，用一把共用鎖綁在一起，`guard`（如果 compare 有的話）以外的地方不需要這種耦合。

**已確認的處理方式**：把 `refresh` 整個併入 query 相關 controller，並讓它的職責跟命名完全比照 `committed` 的 `query.svelte.ts`；`revert` 保留自己獨立的 `pending`。

### 1-2. `pinned.svelte.ts` 手刻了一份「非同步導航」等級的 URL 同步邏輯，但這裡是同步的 `replaceState` → 違反「刻意簡單化」與「避免重複權威來源」

```ts
private echo = untrack(() => parsePinnedIds(page.url.searchParams));
private idsState = $state(this.echo);
// ...
$effect(() => {
  const urlIds = parsePinnedIds(page.url.searchParams);
  if (urlIds.join(",") !== this.echo.join(",")) this.idsState = urlIds;
  this.echo = urlIds;
});
```

這是 `syncedSearchParam`/`syncedQuery` 那一套「本地緩衝 + echo 比對」模式，是為了應付**非同步 `goto`** 可能被連續互動打斷才需要的複雜度。但 `pinned` 用的是 `replaceState`，`$lib/utils/search-params.svelte.ts` 裡 `shallowSearchParam` 的註解已經寫明原因：

> replaceState 是同步的、也不會更新 `page.url`，commit 不會觸發任何非同步、可能跟其他操作交錯的情況，純可覆寫的 `$derived` 就夠

`shallowSearchParam` 已經是這個情境「唯一該有的正確作法」，但它目前只支援單一字串值，逼得 `pinned` 只能整套重造一個（而且重造的是錯的、更複雜的那一套）。這正是「重複權威來源」——「怎麼同步一個淺路由參數」這件事，現在有兩份不同、且複雜度不對等的實作並存。

**已確認的處理方式**：廣義化 `shallowSearchParam`，讓它接受一組 `parse`/`serialize`，`pinned` 改用它，刪掉手刻的 echo/`$effect`。

### 1-3. `CardInfo.svelte` 建構「編輯」連結時繞過了 query 這個權威來源 → 違反「避免重複權威來源」（你糾正過的那條原則的另一個實例）

```ts
const href = $derived.by(() => {
  const params = new URLSearchParams(page.url.searchParams); // 直接讀 URL
  params.delete("pinned");                                    // 手動列出「這個不該帶過去」
  params.set("currentId", record.id);
  return `/committed?${params.toString()}`;
});
```

問題不是「投影寫錯」（投影本來就可以在模板複雜地組合），而是這個投影選錯了來源：

1. `page.url.searchParams` 依 `docs/svelte_kit_routes.md` 的「淺路由與 goto」一節，只要頁面發生過一次淺路由就可能跟 `location` 脫鉤——而 `pinned` 的 `commit` 正是用 `replaceState`（淺路由）。目前唯一沒事是因為 `pinned` 這個 key 剛好又被手動 `delete` 掉，但這是巧合，不是設計。
2. 就算不考慮過期問題，`query` controller 才是「目前篩選條件」唯一的權威來源（`Filters`/`FilterPopover` 都是讀它），這裡卻另外開了一條從 `page.url` 直接讀的路——如果 `query` 內部緩衝跟 `page.url` 曾經有一瞬間不一致，這個連結顯示的條件就會跟畫面上篩選列顯示的不一致。
3. `params.delete("pinned")` 是用「黑名單」排除法在維護「哪些參數屬於 compare、不該帶去 committed」，之後 compare 只要再多一個自己的參數，這裡就要跟著補一行——而正確的作法應該是「白名單」：只有 `ImageQuery` 認得的欄位才會出現在連結上，因為 `query.query.toSearchParams()` 本來就只序列化它自己管的欄位。

**處理方式**：改成從 `query.query.toSearchParams()` 出發（全新的 `URLSearchParams`，不傳 `base`），再疊上 `currentId`。不必刪 `pinned`——它本來就不會出現。

### 1-4. UI 沒有跟上：`compare` 還在用自己土砲的篩選 UI，`committed` 已經換成統一元件

這點不是你原本四條 taste 清單裡的項目，但你在回答問題時明確要求一起做：`compare` 的查詢條件 UI（`Filters.svelte` + `FilterButton.svelte` + `FilterPopover.svelte`）要換成跟 `committed/header/QueryControls.svelte` 一樣，直接组裝 `SearchInput` + `ImageListOptions` + `ImageFilters` 這三個共用元件，而不是手刻排序 `Select` × 2 跟自己的篩選彈出選單。

---

## 2. 新的檔案樹

```
routes/compare/
├── +page.svelte                    # 改：import 改名後的 context
├── +page.server.ts                 # 不動
├── header/
│   ├── Toolbar.svelte              # 不動（本地的雙群組 space-between 版面，compare 特有需求，見 §5）
│   ├── QueryControls.svelte        # 新增，取代 Filters.svelte；內容比照 committed 的同名元件
│   ├── Filters.svelte              # 刪除
│   ├── FilterButton.svelte         # 刪除（功能已內建在共用 ImageFilters 裡）
│   ├── FilterPopover.svelte        # 刪除（同上）
│   └── Actions.svelte              # 改：refresh 改讀 query，revert 相關不變（本來就沒用到）
├── cards/
│   ├── Cards.svelte                 # 不動
│   ├── Card.svelte                  # 不動
│   ├── CardHeader.svelte            # 不動
│   └── CardInfo.svelte              # 改：href 改用 query.toSearchParams()；controller 改用 getRevertContext()
├── list/                            # 全部不動
│   ├── List.svelte
│   ├── ListHeader.svelte
│   ├── ListItem.svelte
│   └── Panel.svelte
└── logic/
    ├── page-data.svelte.ts          # 不動
    ├── query.svelte.ts              # 改名自 filter.svelte.ts，併入 refresh
    ├── pinned.svelte.ts             # 改：URL 同步邏輯改用廣義化後的 shallowSearchParam
    └── revert.svelte.ts             # 改名自 operations.svelte.ts，拿掉 refresh，只剩取消提交

lib/utils/
└── search-params.svelte.ts          # 改：shallowSearchParam 廣義化（純加法，見 §6）
```

---

## 3. `logic/query.svelte.ts`（改名自 `filter.svelte.ts`）

跟 `committed/logic/query.svelte.ts` 的職責描述完全一致：「管理篩選與排序條件，以及同步對應的 URL 查詢參數；並用同一組條件重新整理列表」。

```ts
/**
 * @file query.svelte.ts
 * 管理篩選與排序條件，以及同步對應的 URL 查詢參數；並負責用同一組條件重新整理列表
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { ImageQuery } from "$lib/query-spec";
import { syncedQuery } from "$lib/utils/search-params.svelte";
import { addToast } from "$lib/components/floating/toast-events";

class QueryController {
  private synced = syncedQuery((params) => ImageQuery.fromSearchParams(params));

  /** 目前的圖片查詢條件 */
  get query(): ImageQuery {
    return this.synced.value;
  }

  /** 目前篩選條件對應的標籤切片查詢範圍，供標籤輸入框查詢可用標籤 */
  facetScope = $derived(this.query.where.toSearchParams().toString());

  private commit(next: ImageQuery) {
    this.synced.commit(next);
  }

  handleSearch = (search: string) => {
    this.commit(new ImageQuery(this.query.where.with({ search }), this.query.list));
  };

  handleSortChange = (key: string) => {
    if (key === "committedAt" || key === "rating" || key === "name" || key === "random") {
      this.commit(new ImageQuery(this.query.where, this.query.list.with({ sort: key })));
    }
  };

  handleOrderChange = (key: string) => {
    if (key === "desc" || key === "asc") {
      this.commit(new ImageQuery(this.query.where, this.query.list.with({ order: key })));
    }
  };

  handleRatingChange = (key: string) => {
    const rating = key === "all" ? undefined : Number(key);
    this.commit(new ImageQuery(this.query.where.with({ rating }), this.query.list));
  };

  handleRatingOpChange = (key: string) => {
    if (key === "gte" || key === "lte" || key === "eq") {
      this.commit(new ImageQuery(this.query.where.with({ ratingOp: key }), this.query.list));
    }
  };

  handleTagsChange = (type: "includedTags" | "excludedTags", tags: string[]) => {
    this.commit(new ImageQuery(this.query.where.with({ [type]: tags }), this.query.list));
  };

  // ---

  /** 是否有一次重新整理正在進行中 */
  refreshing = $state(false);

  /** 重新整理，條件不變，用同一組查詢再問伺服器一次 */
  handleRefresh = async () => {
    if (this.refreshing) return;

    this.refreshing = true;
    await new Promise((resolve) => setTimeout(resolve, 200)); // debounce

    try {
      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
      addToast({ message: "列表已更新", variant: "success" });
    } catch (e) {
      addToast({ message: "重新整理失敗" + (e instanceof Error ? `: ${e.message}` : ""), variant: "error" });
    } finally {
      this.refreshing = false;
    }
  };
}

const key = Symbol("query-controller");

export const createQueryContext = () => {
  const controller = new QueryController();
  setContext(key, controller);
  return controller;
};

export const getQueryContext = () => getContext<QueryController>(key);
```

**跟原本 `filter.svelte.ts` 的差異**：
- 拿掉 `advancedCount`。原本只有 `FilterButton.svelte` 用它來畫徽章數字；換成共用 `ImageFilters` 元件後，徽章數字元件自己內部算（見 §5），這個 derived 沒有第二個消費者，屬於死碼，直接刪除比留著更符合「只暴露最少的方法」。
- 新增 `refreshing` + `handleRefresh`，內容跟原 `operations.svelte.ts` 裡的版本逐字相同，只是換了家。

---

## 4. `logic/pinned.svelte.ts`

### 4-1. 共用工具先廣義化（§6 有完整 diff），這裡先看廣義化後 `pinned` 怎麼用

```ts
/**
 * @file pinned.svelte.ts
 * 管理已釘選圖片
 */

import { getContext, setContext } from "svelte";
import { addToast } from "$lib/components/floating/toast-events";
import { shallowSearchParam, type Codec } from "$lib/utils/search-params.svelte";
import { getPageDataContext } from "./page-data.svelte";

/** `pinned` 參數的編碼方式：逗號分隔、去重、去空白 */
const idsCodec: Codec<string[]> = {
  parse: (raw) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const part of (raw ?? "").split(",")) {
      const id = part.trim();
      if (id && !seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
    return out;
  },
  serialize: (ids) => (ids.length > 0 ? ids.join(",") : null),
};

class PinnedController {
  private pageData = getPageDataContext();
  private synced = shallowSearchParam("pinned", idsCodec);

  private idsSet = $derived(new Set(this.synced.value));
  private recordsById = $derived(new Map(this.pageData.value.items.map((r) => [r.id, r])));

  /** 目前釘選、且仍存在於目前結果集內的紀錄 */
  records = $derived(this.synced.value.map((id) => this.recordsById.get(id)).filter((r) => r !== undefined));

  /** 給定的圖片 id 對應的圖片是否被釘選中 */
  isPinned = (id: string) => this.idsSet.has(id);

  constructor() {
    // 篩選/排序改變導致結果集變動時，剔除已不在其中的 pinned id
    $effect(() => {
      const validIds = new Set(this.pageData.value.items.map((r) => r.id));
      const next = this.synced.value.filter((id) => validIds.has(id));
      if (next.length !== this.synced.value.length) this.synced.commit(next);
    });
  }

  /** 切換指定 id 圖片的釘選狀態 */
  handleTogglePin = (id: string) => {
    const ids = this.synced.value;
    this.synced.commit(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);
  };

  /** 取消指定 id 圖片的釘選狀態 */
  handleUnpin = (id: string) => {
    const ids = this.synced.value;
    if (!ids.includes(id)) return;
    this.synced.commit(ids.filter((x) => x !== id));
  };

  /** 重新隨機釘選 N 張圖片 */
  handleShuffle = (count: number) => {
    const pool = this.pageData.value.items;
    if (pool.length === 0) {
      addToast({ message: "沒有可抽選的圖片", variant: "error" });
      return;
    }

    const n = Math.min(count, pool.length);
    const indices = new Set<number>();
    while (indices.size < n) indices.add(Math.floor(Math.random() * pool.length));

    this.synced.commit([...indices].map((i) => pool[i].id));
  };
}

const key = Symbol("pinned-controller");

export const createPinnedContext = () => {
  const controller = new PinnedController();
  setContext(key, controller);
  return controller;
};

export const getPinnedContext = () => getContext<PinnedController>(key);
```

**跟原本的差異**：拿掉 `parsePinnedIds` 的獨立函式定義（改叫 `idsCodec.parse`，語意不變）、拿掉 `echo`/建構子裡「同步外部 URL 變動」那個 `$effect`、拿掉自己手刻的 `commit`（改叫 `this.synced.commit`）。保留「結果集變動時剔除失效 pinned id」這個 `$effect`——這是業務邏輯，不是 URL 同步邏輯，跟共用工具無關，理當留下。

公開介面（`records`/`isPinned`/`handleTogglePin`/`handleUnpin`/`handleShuffle`）完全不變，所以 `CardHeader.svelte`、`ListItem.svelte`、`Actions.svelte` 這些消費端都不用改。

---

## 5. `logic/revert.svelte.ts`（改名自 `operations.svelte.ts`）

```ts
/**
 * @file revert.svelte.ts
 * 管理已釘選圖片的取消提交（退回暫存區）操作
 */

import { getContext, setContext } from "svelte";
import { goto } from "$app/navigation";
import { api } from "$lib/utils/request";
import { addToast } from "$lib/components/floating/toast-events";
import { requestConfirm } from "$lib/components/widgets/confirm-events";
import { getPinnedContext } from "./pinned.svelte";

class RevertController {
  private pinned = getPinnedContext();

  /** 是否有一次取消提交正在進行中 */
  pending = $state(false);

  /** 取消指定 id 圖片的提交 */
  handleRevert = async (id: string) => {
    if (this.pending) return;

    const msg = `確定要取消提交 ${id}？\n此操作會刪除圖片的名稱、評等與標籤，圖片本身則回到暫存區。`;
    if (!(await requestConfirm(msg, { title: "取消提交", action: "取消提交" }))) return;

    this.pending = true;
    try {
      const res = await api.del(`/api/committed/${encodeURIComponent(id)}`);
      if (!res.ok) {
        addToast({ message: "取消提交失敗" + (res.error ? `: ${res.error}` : ""), variant: "error" });
        return;
      }

      this.pinned.handleUnpin(id);
      addToast({ message: `已取消提交：${id}`, variant: "info" });

      await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
    } catch (e) {
      addToast({ message: "取消提交失敗" + (e instanceof Error ? `: ${e.message}` : ""), variant: "error" });
    } finally {
      this.pending = false;
    }
  };
}

const key = Symbol("revert-controller");

export const createRevertContext = () => {
  const controller = new RevertController();
  setContext(key, controller);
  return controller;
};

export const getRevertContext = () => getContext<RevertController>(key);
```

依賴方向維持原樣：`revert → pinned`（單向），沒有循環依賴。

---

## 6. 共用工具：`shallowSearchParam` 廣義化

`src/lib/utils/search-params.svelte.ts` 現況：

```ts
export function shallowSearchParam(key: string) {
  let local = $derived(page.url.searchParams.get(key));
  return {
    get value() { return local; },
    commit(v: string | null) {
      local = v;
      const params = new URLSearchParams(location.search);
      if (v !== null) params.set(key, v);
      else params.delete(key);
      const qs = params.toString();
      replaceState(`${location.pathname}${qs ? `?${qs}` : ""}`, page.state);
    },
  };
}
```

改成：

```ts
/** 單一 search param 的字串 <-> 任意型別轉換方式 */
export type Codec<T> = {
  parse: (raw: string | null) => T;
  serialize: (value: T) => string | null;
};

const identityCodec: Codec<string | null> = {
  parse: (raw) => raw,
  serialize: (value) => value,
};

/**
 * 單一 search param 的同步緩衝，淺路由版本。
 * 預設把值當成字串（或不存在時的 `null`）；需要其他型別（例如陣列）時傳入 `codec`。
 */
export function shallowSearchParam<T = string | null>(
  key: string,
  codec: Codec<T> = identityCodec as Codec<T>,
) {
  // replaceState 是同步的、也不會更新 `page.url`（見 docs/svelte_kit_routes.md），
  // commit 不會觸發任何非同步、可能跟其他操作交錯的情況，純可覆寫的 `$derived` 就夠

  let local = $derived(codec.parse(page.url.searchParams.get(key)));

  return {
    get value() {
      return local;
    },
    /** 覆寫本地顯示值並做一次淺路由，不會重跑 load */
    commit(v: T) {
      local = v;
      const params = new URLSearchParams(location.search);
      const raw = codec.serialize(v);
      if (raw !== null) params.set(key, raw);
      else params.delete(key);
      const qs = params.toString();
      replaceState(`${location.pathname}${qs ? `?${qs}` : ""}`, page.state);
    },
  };
}
```

**對 `committed/logic/pointers.svelte.ts` 零行為影響的證明**：唯一既有呼叫點是 `shallowSearchParam("currentId")`，不傳第二個參數。泛型 `T` 預設 `string | null`、`codec` 預設 `identityCodec`，行為（`parse` 原樣回傳、`serialize` 原樣回傳）跟改動前逐行等價。全專案 grep 過，`shallowSearchParam` 只有這一個呼叫點，沒有其他地方會受影響。

---

## 7. 元件層變動

### 7-1. `header/QueryControls.svelte`（新增，取代 `Filters.svelte`）

跟 `committed/header/QueryControls.svelte` 逐行一致，只換了 controller 來源：

```svelte
<script lang="ts">
  import SearchInput from "$lib/components/widgets/SearchInput.svelte";
  import ImageFilters from "$lib/components/toolbar/ImageFilters.svelte";
  import ImageListOptions from "$lib/components/toolbar/ImageListOptions.svelte";
  import { getQueryContext } from "../logic/query.svelte";

  const query = getQueryContext();
</script>

<div class="container">
  <div style="width: clamp(8rem, 24vw, 16rem)">
    <SearchInput
      label="搜尋名稱"
      labelHidden
      placeholder="搜尋名稱…"
      value={query.query.where.search}
      onsearch={query.handleSearch}
    />
  </div>

  <ImageListOptions
    list={query.query.list}
    onchangesort={query.handleSortChange}
    onchangeorder={query.handleOrderChange}
  />

  <ImageFilters
    where={query.query.where}
    scope={query.facetScope}
    onchangetags={query.handleTagsChange}
    onchangerating={query.handleRatingChange}
    onchangeratingop={query.handleRatingOpChange}
  />
</div>

<style>
  div.container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
```

`FilterButton.svelte`、`FilterPopover.svelte`、原本 `Filters.svelte` 裡手刻的排序 `Select` × 2 全部刪除——功能已經內建在 `ImageListOptions`（排序改成一個「排序」按鈕開彈出選單，欄位跟方向合併在一起選）跟 `ImageFilters`（篩選按鈕本身自帶徽章數字）裡面。

**這是一個可見的 UI 變化**：排序從「兩個並排的下拉選單」變成「一個排序按鈕 + 彈出選單」，視覺上會跟 `committed` 一致。這正是你在回答裡確認過的方向。

### 7-2. `header/Toolbar.svelte`：只改 import

```svelte
<script lang="ts">
  import Actions from "./Actions.svelte";
  import QueryControls from "./QueryControls.svelte";
</script>

<div>
  <QueryControls />
  <Actions />
</div>

<style>
  /* 不變 */
</style>
```

版面（`justify-content: space-between` + `flex-wrap: wrap`）維持不動，理由見 §8——這是 compare 特有的雙群組需求，`committed` 的 Toolbar 只有單一群組 + 一個推到最右的按鈕，兩邊本來就不该長一樣。

### 7-3. `header/Actions.svelte`：refresh 改讀 query

```svelte
<script lang="ts">
  import { IconArrowsShuffle } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import Select from "$lib/components/inputs/Select.svelte";
  import RefreshButton from "$lib/components/toolbar/RefreshButton.svelte";

  import { getQueryContext } from "../logic/query.svelte";
  import { getPinnedContext } from "../logic/pinned.svelte";

  const query = getQueryContext();
  const pinned = getPinnedContext();

  const id = $props.id();
  const shuffleOptions = ["2", "3", "4", "6"];

  let shuffleKey = $state<string | undefined>("2");
</script>

{#snippet shuffleOption(key: string)}
  <span style="display: block; width: 100%; text-align: center;">{`抽 ${key} 張`}</span>
{/snippet}

<div>
  <RefreshButton pending={query.refreshing} onrefresh={query.handleRefresh} />

  <Select
    id="{id}-shuffle-count"
    aria-label="抽選張數"
    options={shuffleOptions}
    option={shuffleOption}
    bind:value={shuffleKey}
  />

  <Button variant="primary" onclick={() => pinned.handleShuffle(Number(shuffleKey ?? "2"))}>
    <IconArrowsShuffle size={16} />
    <span>隨機抽選</span>
  </Button>
</div>

<style>
  /* 不變 */
</style>
```

### 7-4. `cards/CardInfo.svelte`：href 改用 `query`，controller 改用 `revert`

```svelte
<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import { IconEditFilled, IconArrowBackUpDouble } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";
  import TagsWithMask from "$lib/components/widgets/TagsWithMask.svelte";
  import { getQueryContext } from "../logic/query.svelte";
  import { getRevertContext } from "../logic/revert.svelte";

  let { record }: { record: ImageWithId } = $props();

  const query = getQueryContext();
  const revert = getRevertContext();

  const href = $derived.by(() => {
    const params = query.query.toSearchParams();
    params.set("currentId", record.id);
    return `/committed?${params.toString()}`;
  });
</script>

<div class="info">
  <Rating value={record.rating} readonly size="md" />
  <TagsWithMask tags={record.tags} />

  <div>
    <ButtonLink variant="outlined" {href}>
      <IconEditFilled size={16} />
      <span>編輯</span>
    </ButtonLink>
    <Button
      variant="destructive"
      status={revert.pending ? "pending" : undefined}
      onclick={() => revert.handleRevert(record.id)}
    >
      <IconArrowBackUpDouble size={16} />
      <span>取消提交</span>
    </Button>
  </div>
</div>

<style>
  /* 不變 */
</style>
```

不再 import `$app/state` 的 `page`；不再手動 `params.delete("pinned")`——`query.query.toSearchParams()` 從一個全新的 `URLSearchParams` 開始，本來就不會有 `pinned`。

### 7-5. `+page.svelte`：跟著改名

```svelte
<script lang="ts">
  import type { PageData } from "./$types";

  import { createPageDataContext } from "./logic/page-data.svelte";
  import { createQueryContext } from "./logic/query.svelte";
  import { createPinnedContext } from "./logic/pinned.svelte";
  import { createRevertContext } from "./logic/revert.svelte";

  import Toolbar from "./header/Toolbar.svelte";
  import Panel from "./list/Panel.svelte";
  import Cards from "./cards/Cards.svelte";

  let { data }: { data: PageData } = $props();

  createPageDataContext(() => data);
  createQueryContext();
  createPinnedContext();
  createRevertContext();
</script>
```

建立順序不變（`pinned` 依賴 `pageData`；`revert` 依賴 `pinned`；`query` 獨立）。

---

## 8. 為什麼 `header/Toolbar.svelte` 不換成共用的 `$lib/components/toolbar/Toolbar.svelte`

`committed` 的 Toolbar 只有一條線性排列：`QueryControls` → `RefreshButton`（`margin-left: auto` 推到最右）→ `ReviewModal`。`compare` 的 Toolbar 語意上是兩個群組：左邊「查詢條件」、右邊「操作」（重新整理、抽選張數、抽選按鈕），而且原本就設計成窄螢幕時兩群組各自換行（`flex-wrap: wrap`、`gap: 0.5rem 1rem`），共用元件版本沒有這個能力（純線性 + `margin-left: auto` 沒辦法做到「兩群組獨立換行」）。

這不是 controller 邊界問題，是版面需求本來就不同，所以保留 `compare` 自己的 `Toolbar.svelte`。如果你希望連這層也統一（例如接受犧牲窄螢幕換行、或幫共用 Toolbar 加上換行群組的支援），這是另一個獨立的決定，目前設計沒有假設要做這件事。

---

## 9. 投影層：为什麼 `compare` 的 `Card` 不需要比照 `committed` 的 `Card` 組合多個 controller

你更正過的例子是 `Card.svelte`／`ReviewBody.svelte`——這兩個是「模板 derived 組合多個 controller」的範本。`compare` 的 `cards/Card.svelte`／`CardHeader.svelte`／`CardInfo.svelte` 刻意沒有這種組合，原因不是漏做，而是這裡的資料形狀本質不同：

- `committed` 的卡片要呈現「這張圖目前有沒有本地編輯草稿／有沒有被標記退回」——這是三個 controller（`drafts`/`reverts`/`snapshots`）共同決定的一個疊加狀態，非組合不可。
- `compare` 的卡片單純呈現「已提交的原始資料」（`record.rating`/`record.tags` 直接來自 `pageData`），唯一疊加的狀態只有「是否被釘選」（`pinned.isPinned`），跟「取消提交進行中」（`revert.pending`，且這裡是全域鎖不是逐張狀態）。没有本地編輯草稿、也没有退回標記的概念（那些概念在 `compare` 里完全不存在，编辑動作是直接連去 `committed`）。

所以 `compare` 這邊的投影天生就簡單、天生就不需要組合——這是「刻意簡單化」該有的樣子，硬要在這裡塞一個組合多個 controller 的 derived 反而是無中生有的複雜度。這也再次呼應「複雜不代表組合方式很多」：這裡投影不复杂，是因為 controller 划分对了，不是因为漏做。

唯一原本違反「同一種投影只有一種組合方式」的地方就是 §1-3 那個 `href`——已經在 §7-4 修正。

---

## 10. Controller 依賴關係圖（修正後）

```
page-data  (無依賴)
query      (無依賴)
pinned     (依賴 page-data)
revert     (依賴 pinned)
```

跟修正前唯一的差異：`revert` 不再共用 `refresh` 那把鎖，`query` 不再需要靠 `operations` 才能拿到 refresh 能力。沒有循環依賴。

---

## 11. 待確認事項

1. §8 的 Toolbar 版面決定（保留 compare 自己的雙群組 Toolbar，不換共用元件）——如果你想連這層也統一，請告訴我要往哪個方向犧牲。
2. `pinned.svelte.ts` 的 `idsCodec` 我讓它保留原本 `parsePinnedIds` 一模一樣的行為（去重、去空白、逗號分隔）。
3. 檔案改名（`filter.svelte.ts`→`query.svelte.ts`、`operations.svelte.ts`→`revert.svelte.ts`）在 Windows 上我會用「新建+刪舊」而不是 git mv，內容上等同重新命名，不影響 git blame 以外的任何東西——如果你在意保留 rename 的 git 追蹤，之後 commit 時我會確認 git 有正確偵測成 rename。

沒有其他疑問了；確認以上沒問題我就照這份設計動手實作。
