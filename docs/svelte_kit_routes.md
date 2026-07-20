# 頁面狀態與架構

## URL Search Params

### 回顧

Svelte 5 的 `$derived` 可以直接被賦值覆寫，覆寫值會保留到底層依賴真的變動為止：

```js
let likes = $derived(post.likes);
async function onclick() {
  likes += 1;           // 直接覆寫，樂觀更新
  try { await like(); }
  catch { likes -= 1; } // 失敗才回滾
}
```

### 可覆寫不夠用的情況

`let field = $derived(page.url.searchParams.get(...))` 只在兩種情況下安全：

- 每次互動都會等前一次導航結束才允許下一次，通常意味著 UI 會一直被禁用。
- 操作本身跟順序無關，誰先誰後結果都一樣。

只要允許使用者連續互動，比如 debounce 輸入、連續切換篩選、或存在多個彼此不協調的 `goto` 呼叫，會出現：

- 使用者打「a」等待 150 毫秒後請求送出，接著使用者又打成「app」新一輪 150ms 等待期間，很可能「a」那個較早送出、已經過時的結果才回來，被 `$derived` 照樣覆蓋，蓋掉使用者已經打好、還在等待送出的「app」。
- 多個欄位各自獨立 `goto`，若使用者在前一個導航結束之前又觸發另一個欄位的變更，後一次呼叫會基於尚未更新的舊快照建構新的查詢字串、整個覆蓋 URL，前一次的篩選意圖被靜默丟棄。

這是 SvelteKit 目前還沒解法共識的問題，見 [sveltejs/kit#13746](https://github.com/sveltejs/kit/issues/13746)，標記 `needs-decision`。

### 本地緩衝與上次記憶比對

需要額外一塊記憶儲存上次自己送出去的值，只有當 URL 變化不等於這個值時，才代表是比如上一頁/下一頁、別人改連結造成的：

```ts
import { page } from '$app/state';
import { goto } from '$app/navigation';
import { untrack } from 'svelte';

export function syncedSearchParam(key: string, fallback = '') {
  let echo = untrack(() => page.url.searchParams.get(key) ?? fallback);
  let local = $state(echo);

  $effect(() => {
    const urlValue = page.url.searchParams.get(key) ?? fallback;
    if (urlValue !== echo) local = urlValue;
    echo = urlValue;
  });

  return {
    get value() { return local; },
    set value(v: string) { local = v; },
    commit(v: string) {
      local = v;
      echo = v;
      const url = new URL(location.href); // 不是 page.url，理由見「shallow routing 與 goto」
      url.searchParams.set(key, v);
      goto(url, { keepFocus: true, replaceState: true, noScroll: true });
    }
  };
}
```

多欄位若各自呼叫、各自獨立 `goto`，仍會互相覆蓋，需要收斂成同一組欄位共用一個 commit 點：

```ts
export function syncedSearchParams<T extends Record<string, string>>(defaults: T) {
  const keys = Object.keys(defaults) as (keyof T)[];
  const snapshot = () => {
    const out = {} as T;
    for (const k of keys) out[k] = (page.url.searchParams.get(k as string) ?? defaults[k]) as T[typeof k];
    return out;
  };

  let echo = untrack(snapshot);
  const local = $state(snapshot());

  $effect(() => {
    const urlValue = snapshot();
    for (const k of keys) if (urlValue[k] !== echo[k]) local[k] = urlValue[k];
    echo = urlValue;
  });

  function commit() {
    echo = { ...local };
    const url = new URL(location.href); // 不是 page.url，理由見「shallow routing 與 goto」
    for (const k of keys) url.searchParams.set(k as string, local[k]);
    goto(url, { keepFocus: true, replaceState: true, noScroll: true });
  }

  return { local, commit };
}
```

或是根據專案特化:

```ts
export function syncedQuery<T extends { toSearchParams(base?: URLSearchParams): URLSearchParams }>(
  parse: (params: URLSearchParams) => T
) {
  const read = () => parse(page.url.searchParams);
  const key = (v: T) => v.toSearchParams().toString();

  let echo = untrack(read);
  let local = $state(untrack(read));

  $effect(() => {
    const next = read();
    if (key(next) !== key(echo)) local = next;
    echo = next;
  });

  function commit(next: T) {
    local = next;
    echo = next;
    // base 讀 location.search、pathname 讀 location.pathname，不是 page.url，理由見「shallow routing 與 goto」
    const qs = next.toSearchParams(new URLSearchParams(location.search)).toString();
    goto(`${location.pathname}${qs ? `?${qs}` : ""}`, { replaceState: true, noScroll: true, keepFocus: true });
  }

  return { get value() { return local; }, commit };
}
```

> 這些工具都已在 `$lib/utils/search-params.svelte.ts`，本專案可直接使用

---

## 淺路由與 `goto`

處理查詢參數的另一個常見情境是淺路由，在 SvelteKit，頁面上只要有任何一次 `pushState`/`replaceState`，`page.url` 就會跟瀏覽器實際網址永久脫鉤，任何讀 `page.url.searchParams` 的地方都會因此讀到過時值。

### 癥結點

`pushState`/`replaceState` 來自 `$app/navigation` 一定會更新瀏覽器 `history` 與 `page.state`，但不會更新 `page.url`。

只要頁面上發生過一次淺路由，`page.url.searchParams` 就會停留在上一次真的導航當下的快照，沒有任何公開 API 能讓你在中途手動把 `page.url` 校正回來，它只由 SvelteKit 內部的 `navigate()` 流程指派。反過來，`location` 是瀏覽器原生 History API 的同步保證，不管有沒有淺路由都一樣。

### 實際的錯誤案例

```ts
import { page } from '$app/state';
import { goto, replaceState, invalidateAll } from '$app/navigation';

// 頁面掛載當下：/compare?sort=rating

// 1) 使用者釘選一張圖片：shallow routing，不想為了「釘選」重跑 load
function pin(id: string) {
  const url = new URL(page.url);
  url.searchParams.set('pinned', id);
  replaceState(url, { pinned: [id] });
  // 瀏覽器網址列此刻確實是 /compare?sort=rating&pinned=A（location 準）
  // 但 page.url 仍停在 /compare?sort=rating —— replaceState 不會更新它，往後也不會自己追上
}

// 2) 使用者切換排序：真的導航，goto 建構新 URL 時要保留其他參數
function changeSort(sort: string) {
  const url = new URL(page.url); // 錯就錯在這裡：從 page.url 建構，讀不到剛剛 shallow 寫入的 pinned
  url.searchParams.set('sort', sort);
  goto(url, { replaceState: true });
  // 結果：/compare?sort=name —— pinned=A 憑空消失，不會報錯、不會有任何警告
}

// 3) 使用者按「重新整理」，圖方便直接呼叫 invalidateAll()
async function refresh() {
  await invalidateAll();
  // invalidateAll() 內部固定用 current.url（=page.url）重跑 load，同樣讀不到 pinned
  // 就算 (2) 沒發生過，單獨呼叫這個也會在下一次重跑時把 pinned 弄丟——它沒有參數能讓你指定要用哪個 url
}
```


### 執行導航必須小心

一旦知道 `page.url` 可能過時，任何要重跑頁面 load 的程式碼，無論是上一章的參數查詢或是重新整理等，都不能再信任 `page.url`。

獨立的 `invalidateAll()`/`invalidate()` 問題更根本，它們內部重跑用的固定是 SvelteKit 自己追蹤的 `current.url`（就是 `page.url`），完全沒有參數能讓呼叫端指定要用哪個 url。

`goto()` 雖然仍危險，但它的 `url` 是呼叫端自己傳的參數，而且它的 `opts` 已經涵蓋 `invalidateAll`、`invalidate`、`state` 三個選項：

```ts
function goto(
  url: string | URL,
  opts?: {
    replaceState?: boolean;
    noScroll?: boolean;
    keepFocus?: boolean;
    invalidateAll?: boolean;
    invalidate?: (string | URL | ((url: URL) => boolean))[];
    state?: App.PageState;
  }
): Promise<void>;
```

因此專案裡任何需要在同個路由重跑 load 的地方，無論是為了查詢還是單純為了實現重新整理，一律呼叫 `goto()` 且禁止 `invalidateAll()`、`invalidate()`。另外 `goto()` 的第一個參數一律從 `location` 取得，不要從 `page.url` 取得

- `invalidateAll()` → `goto(location.href, { replaceState: true, invalidateAll: true, state: page.state })`。
- `invalidate(resource)` → `goto(location.href, { replaceState: true, invalidate: [resource] })`。
- `pushState`/`replaceState` → 完全不受影響，不需要、也不應該改成 `goto`。

這會讓絕大部分當前頁面導航自身的呼叫點現在都保證讀 `location`，重跑 load 回來後就不會再遺漏淺路由寫入的查詢參數。

### 不是所有地方都該換 `location`

上面只用 `location` 講的是對自身執行導航且通常與查詢參數有關的情境。其他地方則並不適用，比如在 `beforeNavigate` 裡判斷這次導航是不是要離開目前這一頁。這裡要讀的是目前所在頁面的 pathname，必須用 `page.url.pathname`，不能用 `location.pathname`。

原因是 `beforeNavigate` 觸發當下，`location` 不保證還停在「來源頁」：

- `<a>`、`goto()`：SvelteKit 在動 `history` 之前就先跑 `beforeNavigate`，此刻 `location` 仍是來源頁，`location` 與 `page.url` 一致，兩者都對。
- 瀏覽器上下頁 `popstate`：瀏覽器會先把 `location` 換成目標頁、才派發 `popstate` 而 `beforeNavigate` 是在這之後才跑。此刻 `location.pathname` 已經是**目標頁**，拿它跟 `to.url.pathname` 比會相等，守衛整個失效。

---

## 怎樣將頁面邏輯拆到外部

### 透過上下文

用 `setContext` 把回傳值掛到元件樹上，任意深度的子元件用 `getContext` 就能拿到同一份實例，同時請一律用 Class，不用 Closure、欄位一律優先用 `private`，不特別用原生 `#`。

```ts
import { page } from '$app/state';
import { getContext, setContext } from 'svelte';

class Controller {
  private pending = $state(false);

  private sync() {
    // 私有：多個 handler 共用的內部步驟（例如寫回 URL、重新驗證…），元件永遠看不到、也不需要知道
  }

  handleSubmit = (input: Input) => {
    // 公開、handle 開頭：對應一個使用者互動，元件只需要呼叫這一個
    this.pending = true;
    // ...
    this.sync();
  };
}

const key = Symbol('controller-key');

export const createController = () => {
  const controller = new Controller();
  setContext(key, controller);
  return controller;
};

export const getController = () => getContext<Controller>(key);
```

### 狀態 in、事件 out

絕大部分的 `.svelte` 的 `<script>` 專心做兩件事： 讀狀態、把 UI 事件轉呼叫 `handle*`

若是 controller
- 導入 context 從 controller 讀狀態
- 導入 context 把 UI 事件轉呼叫 controller 的 `handle*` 方法

若是其他狀態
- 從 props 讀狀態，或者是本地狀態
- 事件透過 callback props 往上

> 其他狀態通常較少，且要是發現真的傳遞很深，或許代表他其實更適合 controller

### SSR 的資料

`+page.server.ts` 的 `load` 回傳的 `data` 本身就是請求相關資料，可以用同一套手法包起來，讓 `+page.svelte` 只需要一行：

```svelte
<script>
  const pageData = createPageDataContext(() => data);
</script>
```

工廠函式收的是一個 getter 而不是 `data` 本身，因為 `data` 會隨 `load` 重新執行而變動，要傳的是即時讀取而不是呼叫當下的快照。如果這個工廠函式放在比路由檔案更深一層的地方，例如 `routes/page/logic/page-data.svelte.ts`，`PageData` 型別要從上一層拿：

```ts
import type { PageData } from "../$types";
import { getContext, setContext } from 'svelte';

const key = Symbol('page-data');

export const createPageDataContext = (getData: () => PageData) => {
  const context = { get value() { return getData(); } };
  setContext(key, context);
  return context;
};

export const getPageDataContext = () => getContext<{ readonly value: PageData }>(key);
```

---

## 頁面的架構

### 過去的樣貌

- 元件樹通常只有單層（例如 `compare/cards/*.svelte`）。
- 已經遵循「狀態 in、事件 out」，只是走 React 那種：狀態靠 prop 往下、事件靠 callback prop 往上。
- `+page.svelte` 因為要兼任「組裝 + 往下傳遞一切」的樞紐，容易冗長。
- 真的需要拆邏輯時，做法是子模組自己管投影型別、純函數業務轉換、API 呼叫，獨立成一個 `<domain>.ts`。

### 現在的樣貌

- 元件樹繼續維持單層，但每個路由多一個 `logic/` 子資料夾，除非這個頁面完全不需要任何上下文。
- `logic/` 底下依領域拆成一個或多個 controller，把狀態跟 `handle*` 方法都收進去。
- 其他子模組回歸純粹的 `*.svelte`，邏輯收斂進 `logic/`，子元件依領域分資料夾，取名不強制跟邏輯檔名一致。
- 繼續遵循「狀態 in、事件 out」，但改成 `getContext` 拿對應 controller 投影它的狀態，事件接上它的 `handle*` 方法
- 一個子組件也可能是拿 A 上下文的狀態投影，但是事件是傳給 B 上下文
- 子元件不再需要建構一個值去符合某個 prop 型別，很多投影型別可以整個不用導出甚至不用定義，留在 `logic/` 內部。
- `+page.svelte` 的工作收斂成按照依賴順序呼叫每個 `create<Domain>Context()`
- 推薦參考的已符合當前架構設計的路由有 `compare`, `staged`

### 示意檔案樹

```
routes/example/            舊
├── +page.svelte           # 組裝 + 狀態 + handler，容易冗長
└── widgets/
    ├── widget.ts           # 投影型別 + 業務轉換 + API，跟元件並排
    ├── Widget.svelte
    └── WidgetItem.svelte

routes/example/            新
├── +page.svelte           # 只呼叫 create*Context()，不是組裝樞紐
├── logic/
│   └── widget.svelte.ts    # controller：狀態 + handle*，型別多半不 export
└── widgets/
    ├── Widget.svelte       # 純元件，getContext 拿 controller
    └── WidgetItem.svelte
```

### 注意事項

- 一個頁面通常會有多個 controller，注入的方式可以參考已是新架構的頁面，但也要注意避免循環依賴
