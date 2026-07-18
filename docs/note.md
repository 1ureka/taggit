## 怎樣與 search params 互動

### 裸 `$derived(page.url.searchParams...)` 不夠用的情況

`let field = $derived(page.url.searchParams.get(...))` 只在兩種情況下安全：

- 每次互動都會等前一次 `goto` resolve 才允許下一次（UI 層面 disable 掉）。
- 操作本身跟順序無關，誰先誰後結果都一樣。

只要允許使用者連續互動（debounce 輸入、連續切換篩選）、或存在多個彼此不協調的 `goto` 呼叫，這兩個條件都不成立，會出現：

- **debounce 亂序覆蓋**：使用者打「a」，debounce 觸發、請求真的送出去了；接著使用者又打成「app」，新一輪 150ms 等待期間，很可能「a」那個較早送出、已經過時的結果才回來，`page.url.searchParams` 被過時值蓋過，裸 `$derived` 照樣重算，蓋掉使用者已經打好、還在等待送出的「app」。
- **多欄位 lost update**：多個欄位各自獨立 `goto`，若使用者在前一個 `goto` resolve 之前又觸發另一個欄位的變更，後一次呼叫會基於尚未更新的舊快照建構新的查詢字串、整個覆蓋 URL，前一次的篩選意圖被靜默丟棄；若還有其他獨立的 `goto`（例如整頁重新整理）同時在途，最終只有最後 resolve 的那個決定畫面，其餘全部被覆蓋。

這是 SvelteKit 生態系目前公認還沒解決乾淨的問題（見 [sveltejs/kit#13746](https://github.com/sveltejs/kit/issues/13746)，標記 `needs-decision`，連社群套件 `sveltekit-search-params` 都還沒完全遷到 runes），不是自己少查到什麼優雅寫法。

Svelte 5 的 `$derived` 可以直接被賦值覆寫（不是純唯讀），覆寫值會保留到底層依賴真的變動為止：

```js
let likes = $derived(post.likes);
async function onclick() {
  likes += 1;           // 直接覆寫，樂觀更新
  try { await like(); }
  catch { likes -= 1; } // 失敗才回滾
}
```

但這解決的是「Svelte 自己的重算機制蓋掉手動輸入」——對單一同步操作（像 toggle）夠用。對上面的 debounce 亂序覆蓋沒有幫助，因為當過時的 `goto` 真的讓 `page.url.searchParams` 變動時，對 `$derived` 而言這就是「依賴合法地變了」，它沒有能力分辨「這是我剛打的新字」還是「這是一個該被丟棄的舊回應」——可覆寫 `$derived` 跟「亂序覆蓋」是兩個不同機制在解不同問題，不能互相取代。

### 正解：本地緩衝 + echo 比對，只在真正外部變化時才回灌

需要額外一塊記憶（「我上次自己送出去的值」），只有當 URL 變化不等於這個「回音」時，才代表是外部原因（上一頁/下一頁、別人改連結）造成的，才回灌本地顯示值：

```ts
// synced-search-param.svelte.ts
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
      const url = new URL(page.url);
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
    const url = new URL(page.url);
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
    const qs = next.toSearchParams(new URLSearchParams(page.url.searchParams)).toString();
    goto(`${page.url.pathname}${qs ? `?${qs}` : ""}`, { replaceState: true, noScroll: true, keepFocus: true });
  }

  return { get value() { return local; }, commit };
}
```

`untrack` 在這裡是必要的：`page` 是 rune 追蹤的來源，若不包一層直接拿去初始化 `$state`，會觸發編譯器 `state_referenced_locally` 警告（"This reference only captures the initial value... did you mean to reference it inside a closure instead?"）——這個警告的偵測範圍很廣，不限於 `$state()`/`$derived()` 的初始化式，任何頂層直接讀取 rune 值的地方（包括純賦值、函式參數）都會觸發，細節見下一節。

---

## 怎樣將頁面邏輯拆到外部 - pure module

### 定義

`$state`/`$derived` 直接宣告在 module 頂層（不在任何元件、任何工廠函式裡）。ES module 是單例，這份狀態在瀏覽器端等於「整個分頁 session 共用一份」，在伺服器端等於「整個 server process 共用一份」——不是每個請求、每個元件各一份。

### 危險的根源，跟 `$state` 本身無關

SvelteKit 官方文檔「絕對不要在 `+page.server.ts` 寫 `let user`」的經典範例用的是普通變數，不是 `$state`——重點從來不是響應式系統，是「伺服器程式是長駐 process，module 作用域是所有並發請求共用的單例」這個老問題。危險需要兩個條件同時成立：

- **條件 A（寫入時機）**：寫入動作發生在伺服器執行的請求處理路徑（`hooks.server.ts`、`+page.server.ts`/`+layout.server.ts` 的 `load`/`actions`、`+server.ts`、universal `load` 的 SSR 首次執行），或是元件頂層 script 的無條件執行（每次 render 都會跑一次，含每次 SSR）。
- **條件 B（寫入內容）**：寫入內容依賴這次請求/使用者本身，換個使用者結果會不同。

兩者缺一都沒事。結構上不可能落在條件 A 的路徑：`$effect`、`$effect.pre`、`onMount`、DOM 事件處理器——這幾種官方文檔明講不會在 SSR 執行，只要一個 module 狀態的所有寫入點都落在這幾種裡面，不管流量多大、並發多高都安全，這是機制保證，不是經驗法則。

比較隱蔽、不需要 `.server.ts` 也會踩到的路徑，是元件頂層 script 本身——如果它對一個 import 進來的 module 層級 `$state` 做寫入（不是讀取），且寫入內容來自請求相關的值，一樣會踩到跟 `.server.ts` 同樣本質的洩漏。不過實務上很難意外寫出來：在 `.svelte` 元件裡，請求相關的資料只有 `$props()` 和 `$app/state` 的 `page` 兩個管道，兩者都是 rune 追蹤的來源，只要在頂層（非 closure/`$derived`/`$effect`）直接讀取，Svelte 編譯器的 `state_referenced_locally` 警告就會攔下來（觸發範圍很廣，連單純函式呼叫當參數傳都會抓，不限於宣告式）。警告建議的修法（包進 closure）跟這裡的 SSR 安全問題剛好是同一個動作——想把值持續同步進外部狀態，唯一不會被警告的寫法是包進 `$effect`，而 `$effect` 本身就結構性地不會在 SSR 執行。

### 能用 pure module 的兩個充分必要條件

1. **定義本身不依賴請求相關資料**——不會在頂層（或它的 `$derived` 運算式）讀 `page`/URL/load data 來決定初始值或衍生值。
2. **生命週期跟整個 app session 一樣長，就是你要的語意**——不需要隨頁面掛載/卸載重置。

兩條都成立才能用 pure module，任一不成立就得改用 context module。

範例：一段只在使用者 hover 時才查詢、把結果快取起來的邏輯——快取的讀寫全部發生在 hover 之後的事件回呼裡，快取本身活多久也不影響正確性——兩條件都成立，是合法的 pure module：

```ts
// hover-preview-cache.svelte.ts（示意）
const cache = new SvelteMap<string, Data | "loading">();

export async function requestPreview(key: string) {
  if (cache.has(key)) return;
  cache.set(key, "loading");
  cache.set(key, await fetchPreview(key)); // 只從 hover 事件呼叫
}
```

---

## 怎樣將頁面邏輯拆到外部 - context module

### 定義

一個工廠函式，**在元件初始化當下才被呼叫**（不是 module 載入時），內部的 `$state`/`$derived` 因此跟元件一樣「每個請求/每次掛載都是全新一份」。視需要用 `setContext` 把回傳值掛到元件樹上，任意深度的子孫元件用 `getContext` 就能拿到同一份實例，不用 prop drilling，也不需要 class constructor 注入樣板。這正是 `$app/state` 的 `page` 自己內部在用的機制（SvelteKit 用 context API 把 `page` 掛在每次 SSR 建立的全新元件樹上，讀取時動態解析回當次請求）。

### 為什麼 pure module 不夠時要跳來這裡

當「能用 pure module 的兩個條件」任一不成立就得改用 context module：

- 定義依賴請求相關資料（違反條件 1）——例如某個欄位的初始值/衍生值直接讀自 `page`/URL。
- 生命週期理應隨頁面掛載/卸載重置，不該跟著整個 app session 活著（違反條件 2）——例如某個「是否有操作進行中」的瞬時旗標。

額外要注意的灰色地帶：即使只是把 `$derived`/`$state` 宣告在 module 頂層、依賴的是本身有 context/AsyncLocalStorage 保護的 `page`，也不保證安全——`page` 自己的資料解析有請求隔離，但蓋在它之上的 module 單例 `$derived` **沒有繼承到那份保護**，這個 derived 節點本身是整個 server process 共用的單例，能否在被不同並發請求讀取時正確重算，Svelte 官方目前沒有保證。相關的請求級隔離缺口目前是 Svelte 一個尚未解決的開放 issue（[sveltejs/svelte#13594](https://github.com/sveltejs/svelte/issues/13594)）。結論：**只要 module 頂層的 reactive 宣告依賴 `page`（或任何請求相關資料），一律視為不安全，改用 context module**，不要賭這個未解的灰色地帶。

### 一律用 Class，不用 Closure

官方文檔原文：如果你發現自己在寫一堆 `get`/`set` 把 reactive 值傳來傳去，「consider using classes instead」——`$state`/`$derived` 宣告成 class 欄位時，編譯器會自動生成 get/set（"The compiler transforms ... into get/set methods on the class prototype"），plain closure 回傳物件字面量則必須手寫每一個 accessor，否則就是單純複製當下的值、失去響應性。這個成本差異只會隨欄位數量增加而放大，直接定為預設寫法，不用每次重新比較。方法一律用箭頭函式欄位（而非一般 class method），避免被單獨當函式參照傳給 `onclick` 之類的地方時遺失 `this`。

Class 宣告本身可以放在 module 頂層，不必巢狀包在工廠函式裡——欄位初始化式只有在 `new` 的當下才會真正執行 `$state(...)`，宣告本身是惰性的，安全性只取決於「`new` 在哪裡被呼叫」，不取決於「class 宣告寫在哪裡」：

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

欄位一律優先用 `private`（TypeScript 修飾詞，型別檢查期擋、編譯後是普通公開欄位），不用原生 `#`——專案內部用的 controller，不是要對外發布的 library 邊界，型別檢查期的保護就夠了，`#` 換來的執行期隱私在這裡不值得多花的語法成本。只有特別在意某個欄位「就算隊友手滑繞過型別檢查也不該碰到」時，才為那一個欄位單獨升級成 `#`。

### 元件只做「狀態 in、事件 out」的 wire

絕大部分的 `.svelte` 的 `<script>` 專心做兩件事： 讀狀態、把 UI 事件轉呼叫 `handle*`

若是 controller
- 導入 context 從 controller 讀狀態
- 導入 context 把 UI 事件轉呼叫 controller 的 `handle*` 方法

若是其他狀態
- 從 props 讀狀態，或者是本地狀態
- 事件透過 callback props 往上

> 其他狀態通常較少，且要是發現真的傳遞很深，或許代表他其實更適合 controller

### 用同一套方式包 `load` 回傳的 `data`

`+page.server.ts`/`+page.ts` 的 `load` 回傳的 `data` 本身就是請求相關資料，一樣不能用 pure module，可以用同一套手法包起來，讓 `+page.svelte` 只需要一行：

```svelte
<script>
  const pageData = createPageDataContext(() => data);
</script>
```

工廠函式收的是一個 getter 而不是 `data` 本身，因為 `data` 會隨 `load` 重新執行而變動，要傳的是「即時讀取」而不是「呼叫當下的快照」（直接傳 `data` 本身一樣會踩到 `state_referenced_locally` 那類「只捕捉初始值」的問題）。如果這個工廠函式放在比路由檔案更深一層的地方，例如 `routes/page/logic/pageData.ts`，`PageData` 型別要從上一層拿：

```ts
// routes/page/logic/pageData.ts
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

### `syncedSearchParam`/`syncedQuery` 跟 context module 的關係

這類工具本身只是「工廠函式」這一層，跟 `createController` 是同一種東西，不等於 context module 或 pure module——是 pure module 還是 context module，取決於在哪裡呼叫它：

- 因為它們內部讀 `page.url.searchParams`，**一定不能**在 module 頂層呼叫一次共用（違反 pure module 條件 1，繼承前面提到的請求隔離風險）。
- 但**不一定要**額外包 `setContext`——只有當同一棵元件樹裡有多個元件需要共用同一份實例時才需要；如果只有單一元件在用，直接在那個元件的 `<script>` 頂層呼叫、拿到獨立實例即可，這時重用的是邏輯（工廠函式可以給不同頁面各自呼叫出獨立實例），不是實例本身。

---

## 未來頁面的架構
