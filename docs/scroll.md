# 用 $derived 覆寫解決 SvelteKit 滾動同步指示器的所有邊際情況

在文件型網站中，側邊欄的「當前位置指示器」需要同時回應兩種輸入——**點擊導航**與**頁面滾動**。這看似簡單的需求，背後隱藏著大量邊際情況。本文展示如何結合 Svelte 5 的 `$derived` 覆寫機制與 SvelteKit 的 `replaceState`，以極少的程式碼優雅地解決所有問題。

---

## 問題：你需要處理多少種情況？

假設側邊欄有一個帶動畫的 indicator，需要根據目前可見的 section 更新位置。列出所有需要考慮的情況：

| 情況 | 期望行為 |
|---|---|
| 使用者點擊側邊欄連結 | indicator **立即**移動到目標位置 |
| 使用者滾動頁面 | indicator **跟隨**當前可見的 section |
| 快速滾動經過多個 section | indicator 不應每個都跑一次動畫（閃爍） |
| 點擊導航後，瀏覽器滾動到目標 | 滾動偵測不應覆蓋點擊的結果 |
| 頁面載入時帶有 hash | indicator 應顯示在正確位置 |
| SSR 環境 | 不能依賴瀏覽器 API |
| 動畫進行中收到新的更新 | 動畫不應被反覆打斷 |

傳統做法通常需要：一個 `$state` 追蹤當前 hash、一個 scroll 事件監聽器（或 IntersectionObserver）、一個 flag 區分「是點擊觸發的滾動還是使用者滾動」、一個 debounce/throttle 防止閃爍、以及各種 cleanup 邏輯。

**本文的方案不需要任何事件監聽器（除了 IntersectionObserver），不需要區分滾動來源，不需要 flag，且所有情況自然而然地被正確處理。**

---

## 核心觀念：$derived 覆寫

Svelte 5.25 起，`$derived` 宣告的值可以被暫時覆寫。當依賴的響應式值變化時，覆寫會被自動清除，回到衍生計算的結果：

```
依賴變動 → derived 重新計算（覆寫清除）→ 正常使用 → 手動覆寫 → 暫時脫離 derived → 依賴再次變動 → …
```

這個機制讓我們可以建立一個**有預設來源、但允許暫時偏離**的值——正好對應「hash 來自 URL，但可以被滾動偵測暫時覆蓋」的需求。

> 近一步了解可參考我的之前一篇文章 「Derived Reassignment Patterns」，本案例是進階應用。

---

## 第一步：建立 indicator 的資料來源

在 layout 中，indicator 的位置由 `currentHash` 決定：

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { page } from "$app/state";

  let currentHash = $derived(page.url.hash);
</script>

{#each items as item}
  <li>
    {#if item.href === page.url.pathname + currentHash}
      <span class="indicator"></span>
    {/if}
    <a href={item.href}>{item.label}</a>
  </li>
{/each}
```

此時 `currentHash` 完全由 URL hash 決定。點擊 `<a href="/ui/inputs#button">` 時，SvelteKit 更新 `page.url.hash` → `currentHash` 立即反映 → indicator 立即移動。**點擊導航的即時性天然成立。**

---

## 第二步：用 replaceState 傳遞滾動偵測結果

在內容頁中，使用 `IntersectionObserver` 偵測當前可見的 section，並透過 `replaceState` 將結果寫入 `page.state`：

首先，在 `app.d.ts` 中擴充 `PageState` 型別：

```ts
// src/app.d.ts
declare global {
  namespace App {
    interface PageState {
      activeHash?: string;
    }
  }
}

export {};
```

然後在內容頁中建立 observer：

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import { replaceState } from "$app/navigation";
  import { page } from "$app/state";

  let observer: IntersectionObserver | null = null;

  try {
    let timer: ReturnType<typeof setTimeout> | undefined;

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            clearTimeout(timer);
            timer = setTimeout(() => {
              replaceState(page.url, { activeHash: `#${entry.target.id}` });
            }, 150);
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
  } catch {
    observer = null;
  }

  const observe: Attachment = (node) => {
    observer?.observe(node);
    return () => observer?.unobserve(node);
  };
</script>

{#each sections as section}
  <article id={section.id} {@attach observe}>
    ...
  </article>
{/each}
```

幾個設計決策的說明：

- **`replaceState` 而非 `goto`**：`replaceState` 是同步的、不觸發導航、不推新的 history entry。我們只是把滾動狀態「寄放」在 `page.state` 中。
- **`try/catch` 包裹建構式**：`IntersectionObserver` 在 SSR 環境下不存在。用 `try/catch` 確保伺服器端不報錯，且 `observer` 為 `null` 時 attachment 自然變成 no-op。
- **`{@attach}` 取代 `use:action`**：Svelte 5.29+ 的現代語法，生命週期與 action 相同，但與 runes 模式一致。
- **Debounce（150ms）**：稍後解釋為什麼這很重要。

---

## 第三步：用 $effect 覆寫 derived

回到 layout，加入一個 `$effect` 讀取滾動偵測的結果：

```svelte
<!-- +layout.svelte -->
<script lang="ts">
  import { page } from "$app/state";

  let currentHash = $derived(page.url.hash);

  $effect(() => {
    if (page.state.activeHash) {
      currentHash = page.state.activeHash;
    }
  });
</script>
```

這三行是整個方案的核心。讓我們逐一檢視每種情況下的行為：

### 情況 1：使用者點擊側邊欄連結

```
點擊 <a href="/page#section-2">
  → 瀏覽器導航，page.url.hash 變為 "#section-2"
  → $derived 重新計算，覆寫被清除
  → currentHash = "#section-2"（來自 derived）
  → indicator 立即移動 ✓
```

**關鍵**：`$derived` 的依賴（`page.url.hash`）變化時，任何之前的覆寫都會被清除。這意味著點擊導航永遠直接反映 URL，不受滾動狀態干擾。

### 情況 2：使用者緩慢滾動

```
滾動到 section-3 進入視口
  → IntersectionObserver 觸發
  → 150ms 後 replaceState 寫入 { activeHash: "#section-3" }
  → $effect 偵測到 page.state.activeHash
  → currentHash 被覆寫為 "#section-3"
  → indicator 移動到 section-3 ✓
```

### 情況 3：使用者快速滾動

```
快速經過 section-2, section-3, section-4
  → 每次 IntersectionObserver 觸發都 clearTimeout
  → 只有最後一個（section-4）的 setTimeout 存活
  → 150ms 後 replaceState 寫入 { activeHash: "#section-4" }
  → indicator 只移動一次 ✓
```

Debounce 確保快速滾動時 indicator 不會逐個閃過每個 section。動畫只在滾動穩定後觸發一次，保持視覺流暢。

### 情況 4：點擊導航後觸發滾動偵測

```
點擊導航到 #section-2
  → page.url.hash = "#section-2"
  → $derived 重新計算 → currentHash = "#section-2" ✓

瀏覽器滾動到 section-2
  → IntersectionObserver 偵測到 section-2
  → replaceState({ activeHash: "#section-2" })
  → $effect 將 currentHash 覆寫為 "#section-2"
  → 值相同，indicator 不動 ✓
```

**不需要任何 flag 來區分「點擊觸發的滾動」和「使用者手動滾動」。** 因為 `$derived` 的清除機制天然確保點擊結果優先，而後續的滾動偵測寫入相同的值，等於 no-op。

### 情況 5：頁面載入帶有 hash

```
直接訪問 /page#section-3
  → SSR 渲染，page.url.hash = "#section-3"
  → currentHash = "#section-3"（來自 derived）
  → indicator 正確顯示 ✓
```

### 情況 6：SSR 環境

```
伺服器端渲染
  → IntersectionObserver 不存在 → try/catch → observer = null
  → attachment 的 observe 函式為 no-op
  → currentHash 完全由 $derived(page.url.hash) 決定
  → 不會報錯 ✓
```

---

## 加入 crossfade 動畫

indicator 通常搭配 transition 動畫。Svelte 的 `crossfade` 非常適合這個場景：

```svelte
<script lang="ts">
  import { crossfade, fly } from "svelte/transition";

  const [send, receive] = crossfade({
    duration: (len) => Math.min(600, Math.sqrt(len) * 25),
    fallback(node) {
      return fly(node, { x: 0, y: 8, opacity: 0, duration: 200 });
    },
  });
</script>

{#each items as item}
  <li>
    {#if item.href === page.url.pathname + currentHash}
      <span
        class="indicator"
        in:receive={{ key: "indicator" }}
        out:send={{ key: "indicator" }}
      ></span>
    {/if}
    <a href={item.href}>{item.label}</a>
  </li>
{/each}
```

`crossfade` 的 `duration` 接收一個 `len` 參數——代表舊位置與新位置之間的距離。`Math.sqrt(len) * 25` 讓距離越遠動畫越長，但上限 600ms。

**Debounce 在這裡起到關鍵作用**：如果沒有 debounce，快速滾動時每經過一個 section 都會觸發 crossfade。每次新的觸發會打斷正在進行的動畫，導致 indicator 在中間位置反覆跳動，`duration(len)` 的距離計算也會因為每次都是短距離而失去意義。150ms 的 debounce 確保只有滾動停止後才觸發一次完整的 crossfade。

---

## 完整架構概覽

```
┌─────────────────────────────────────────────────────┐
│  +layout.svelte                                     │
│                                                     │
│  let currentHash = $derived(page.url.hash)          │
│       ▲                          ▲                  │
│       │ 覆寫                      │ 依賴變化時清除覆寫  │
│       │                          │                  │
│  $effect(() => {                 │                  │
│    if (page.state.activeHash)    │                  │
│      currentHash = ...    ◄──────┘                  │
│  })                                                 │
│       ▲                                             │
│       │ page.state                                  │
├───────┼─────────────────────────────────────────────┤
│  +page.svelte                                       │
│       │                                             │
│  IntersectionObserver                               │
│    → debounce 150ms                                 │
│    → replaceState({ activeHash })                   │
│                                                     │
│  <article {@attach observe}>                        │
└─────────────────────────────────────────────────────┘
```

資料流是單向的：Observer → `page.state` → `$effect` → 覆寫 `currentHash`。點擊導航時，`page.url.hash` 變化直接清除覆寫，不需要任何額外協調。

---

## 為什麼這個方案有效

回顧開頭列出的所有情況：

| 情況 | 解決方式 |
|---|---|
| 點擊立即響應 | `$derived(page.url.hash)` 直接計算 |
| 滾動跟隨 | IntersectionObserver + `replaceState` + `$effect` 覆寫 |
| 快速滾動不閃爍 | Debounce |
| 點擊後滾動偵測不衝突 | `$derived` 覆寫清除機制，值相同時為 no-op |
| 頁面載入帶 hash | `$derived` 初始計算 |
| SSR 安全 | `try/catch` + null guard |
| 動畫不被打斷 | Debounce 確保穩定後才觸發一次 |

沒有 flag、沒有事件監聽器（`scroll`、`click`）、沒有手動的優先級判斷。`$derived` 的覆寫清除機制天然建立了正確的優先級：**URL 變化（點擊）永遠優先於滾動偵測**，而這個優先級不是用 `if/else` 寫出來的，是宣告式地從資料流結構中浮現的。
