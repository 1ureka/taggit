# 頁面狀態架構願景

## 怎樣與 search params 互動

### 可覆寫 `$derived(page.url.searchParams...)` 不夠用的情況

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

`untrack` 在這裡是必要的：`page` 是 rune 追蹤的來源，若不包一層直接拿去初始化 `$state`，會觸發編譯器 `state_referenced_locally` 警告（"This reference only captures the initial value... did you mean to reference it inside a closure instead?"）——這個警告的偵測範圍很廣，不限於 `$state()`/`$derived()` 的初始化式，任何頂層直接讀取 rune 值的地方（包括純賦值、函式參數）都會觸發，細節見下一節。

> 這些工具在 `$lib/utils/search-params.svelte.ts`

---

## shallow routing 與 goto

上一節的 echo + 本地緩衝解決的是「多個彼此不協調的 `goto`」；這一節要解的是另一個維度的問題——頁面上只要**有任何一次** `pushState`/`replaceState`（shallow routing），`page.url` 就會跟瀏覽器實際網址永久脫鉤，任何原本以為讀 `page.url.searchParams` 很安全的地方都可能因此讀到過時值。

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

只要把 (2)(3) 的 `page.url` 換成 `location`（`new URL(location.href)`）、把 `invalidateAll()` 換成 `goto(location.href, { invalidateAll: true })`，`pinned=A` 就會被正確保留下去——這正是下面兩節規則要解決的問題。

### replaceState 與 page.url 的關係

`pushState`/`replaceState`（`$app/navigation`）一定會更新瀏覽器 `history`（進而 `location.href`/`location.search`）與 `page.state`，但**設計上不會更新 `page.url`**。不是時序問題、不會自己追上，是 SvelteKit client runtime 固定如此。

`pushState` 是同一套模式。也就是說，只要頁面上發生過一次 shallow routing，`page.url.searchParams` 就會停留在「上一次真的導航」當下的快照，直到下一次真的導航（`goto` 到新 URL、或 popstate 跨過不同的導航 index）才會校正——沒有任何公開 API 能讓你在中途手動把 `page.url` 校正回來，它只由 SvelteKit 內部的 `navigate()` 流程指派。反過來，`location.href`/`location.search` 是瀏覽器原生 History API 的同步保證，`history.replaceState`/`pushState` 呼叫完當下就一定準，不管有沒有 shallow routing 都一樣。

### 為何必須只用 goto + location

一旦知道 `page.url` 可能過時，任何要「建構新 URL、保留其他未管理的查詢參數」或「強制重跑 load」的程式碼，都不能再信任 `page.url`——而且過時的方向永遠是「少了某個 shallow 寫入的值」，不會報錯，是靜默的資料遺失。

獨立的 `invalidateAll()`/`invalidate()` 問題更根本：它們內部重跑 load 用的 url 固定是 SvelteKit 自己追蹤的 `current.url`（就是 `page.url`），完全沒有參數能讓呼叫端指定要用哪個 url。就算你知道 `page.url` 過時，也沒辦法「單獨修正」這兩個函式，它們 structurally 就是綁死在會過時的來源上，無法從外部補救。

`goto()` 不一樣：它的 `url` 是呼叫端自己傳的參數，而且它的 `opts` 已經涵蓋 `invalidateAll`、`invalidate`、`state` 三個選項：

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

`invalidateAll()`、`invalidate()`、shallow routing 想達到的「更新 state」，三種需求全部都能表達成「`goto(url, opts)`，url 由呼叫端自己決定」的形式。因此只立一條規則：

> 專案裡任何需要「建構新 URL」或「強制重跑 load」的地方，一律呼叫 `goto()`，不要直接呼叫 `invalidateAll()`/`invalidate()`；`goto()` 的第一個參數一律從 `location` 取得，不要從 `page.url` 取得。

### 為何原本的業務需求不會受影響（比如 invalidateAll, invalidate...）

- **`invalidateAll()`** → `goto(location.href, { replaceState: true, invalidateAll: true, state: page.state })`。
- **`invalidate(resource)`**（選擇性）→ `goto(location.href, { replaceState: true, invalidate: [resource] })`。
- **重跑 load 時不想連帶清掉 `page.state`** → 上面兩個呼叫都額外帶 `state: page.state`（呼叫當下讀到的目前值）。
- **`pushState`/`replaceState` 本身**（shallow routing 的狀態寫入）完全不受影響，不需要、也不應該改成 `goto`。

因為所有「建構新 URL、可能觸及 shallow 寫入參數」的呼叫點現在都保證讀 `location`，重跑 load 或建構新 URL 時就不會再遺漏 shallow routing 寫入的查詢參數。

### 例外：在 `beforeNavigate` 裡判斷「目前在哪一頁」要用 `page.url`，不是 `location`

上面「只用 `location`」講的是**寫**的情境——建構新 URL、強制重跑 load。有一個**讀**的情境結論剛好相反：在 `beforeNavigate` 守衛裡判斷「這次導航是不是要離開目前這一頁」（例如比對 pathname，把自己同址的 `goto(location.href, { invalidateAll })` 放行、只攔真正的跨頁離開）。這裡要讀的是「我目前所在頁面的 pathname」，必須用 `page.url.pathname`，不能用 `location.pathname`。

原因是 `beforeNavigate` 觸發當下，`location` 不保證還停在「來源頁」：

- **`<a>` 點擊、`goto()`**：SvelteKit 在動 `history` 之前就先跑 `beforeNavigate`，此刻 `location` 仍是來源頁，`location` 與 `page.url` 一致，兩者都對。
- **瀏覽器上一頁／下一頁（`popstate`）**：瀏覽器會**先**把 `location` 換成目標頁、**才**派發 `popstate`，SvelteKit 的 `beforeNavigate` 是在這之後才跑。此刻 `location.pathname` 已經是**目標頁**，拿它跟 `to.url.pathname` 比會相等，把「真的要離開」誤判成「同址、不用攔」，守衛整個失效。`page.url` 則要等導航真的 commit（沒被 `nav.cancel()`）才更新，所以 `beforeNavigate` 當下它仍正確地是**來源頁**。

這跟前一節「`page.url` 會因 shallow routing 過時、所以要用 `location`」不衝突，因為兩者針對的欄位不同：shallow routing（`pushState`/`replaceState`）只動 **search params**，從不動 pathname；而這裡比對的正好是 **pathname**，對 pathname 而言 `page.url` 永遠不會被 shallow routing 弄過時。一句話收斂：

> - 要「建構新 URL / 重跑 load」（**寫**，會觸及 search params）→ 讀 `location`，才不會漏掉 shallow 寫入的查詢參數。
> - 要在 `beforeNavigate` 判斷「目前這一頁是誰」（**讀**，且只看 pathname）→ 讀 `page.url`，因為 `location` 在 `popstate` 當下已跳到目標頁。

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

工廠函式收的是一個 getter 而不是 `data` 本身，因為 `data` 會隨 `load` 重新執行而變動，要傳的是「即時讀取」而不是「呼叫當下的快照」（直接傳 `data` 本身一樣會踩到 `state_referenced_locally` 那類「只捕捉初始值」的問題）。如果這個工廠函式放在比路由檔案更深一層的地方，例如 `routes/page/logic/page-data.svelte.ts`，`PageData` 型別要從上一層拿：

```ts
// routes/page/logic/page-data.svelte.ts
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

### 目前的樣貌

- 元件樹通常只有單層（例如 `compare/cards/*.svelte`）。
- 已經遵循「狀態 in、事件 out」，只是走 React 那種：狀態靠 prop 往下、事件靠 callback prop 往上。
- `+page.svelte` 因為要兼任「組裝 + 往下傳遞一切」的樞紐，容易冗長。
- 真的需要拆邏輯時，做法是子模組自己管投影型別、純函數業務轉換、API 呼叫，獨立成一個 `<domain>.ts`，跟對應的 `*.svelte`（以及一群 `Domain*.svelte`）並排放，`+page` 把兩者一起 import 進來組裝。
- 目前能參考「現行架構」的路由只有 ~~`compare`~~ 跟 `staged`；而 `tags` 有偏差，可以看但不能當現行架構的典型長相。

### 新架構

- 元件樹繼續維持單層，但每個路由多一個 `logic/` 子資料夾——除非這個頁面完全不需要任何 context（pure module 兩個條件都成立的情況）。
- `logic/` 底下依領域拆成一個或多個 controller（一律用 class，見「一律用 Class，不用 Closure」），把狀態跟 `handle*` 方法都收進去。
- 其他子模組回歸純粹的 `*.svelte`，不再跟著一個同名的 `.ts` 檔案配對——邏輯收斂進 `logic/`，子元件依領域分資料夾，取名可以中立（`cards/`、`chips/`），不強制跟 domain 檔名一致。
- 子元件不再靠 prop 拿狀態、callback prop 送事件，改成直接 `getContext` 拿對應 controller，讀它曝光的狀態、呼叫它的 `handle*` 方法——「狀態 in、事件 out」的形狀不變，只是管道換了（見「元件只做『狀態 in、事件 out』的 wire」）。
- 子元件不再需要建構一個值去符合某個 prop 型別，很多投影型別可以整個不用 export，留在 `logic/<domain>.svelte.ts` 內部。
- `+page.svelte` 的工作收斂成：呼叫每個 `create<Domain>Context()` 一次，`load` 回來的 `data` 視需要包成 `createPageDataContext`；不再是組裝樞紐，自己也只是「狀態 in、事件 out」原則的根節點實例。
- 目前能參考「新架構」的路由有 `compare`

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

### 還沒真的驗證過的地方

- 一個頁面會有幾個 controller、controller 之間該不該互相注入，這是第一次會被用在「同一個頁面多個 controller 並存」的情境，實際切下去大概還會冒出新的細節。
<!-- 以新 compare 來看，注入的方式比想像中方便、乾淨(指不須要寫很多樣版)，但也有一定風險(可能會導致循環依賴) -->
- 子元件直接讀 context，換來的代價是沒辦法脫離 provider 單獨掛載——目前驗收方式是 dev server 走查，不是元件層級自動化測試，這個代價可以接受，但是主動接受的取捨，不是沒想到。

### 使用說明

如果你讀到這份文件、被要求依此改某個路由：

- 這份文件描述的是**目標架構**，不是現狀紀錄。路由現有的程式碼多半還是「目前的樣貌」那套（React 式 prop drilling、子模組配一個同名 `.ts`），改動時不要把現有寫法的風格當參考，只能參考它的業務邏輯/行為，寫法一律照本文件。
- 動手前先列一份清單：哪些子元件目前靠 prop 拿狀態/送事件、哪些邏輯散落在跟元件並排的 `.ts` 裡、`+page.svelte` 還兼著哪些組裝工作——全部要轉的都列出來，不要邊做邊發現。
- 全部轉完，不要留下「部分用舊模式、部分用新模式」的過渡狀態。
