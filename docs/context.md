# Context System — Svelte5

> 使用 Svelte 5 的 `createContext` API 在元件樹中共享響應式狀態，無需逐層傳遞 props。

---

## 核心概念

| API | 說明 |
| --- | --- |
| `createContext<T>()` | 建立一組 `[getter, setter]`，用於在元件樹中存取共享狀態 |
| `setMyContext(value)` | 在父元件中注入 Context 實例（通常在 `+page.svelte` 呼叫）|
| `getMyContext()` | 在子元件中取得最近的 Context 實例 |
| `$state` | Svelte 5 響應式原語，使 class 屬性具備即時響應能力 |

---

## 檔案結構

```
src/routes/test/
├── store.svelte.ts   ← 定義 Context class 與 getter/setter
├── +page.svelte      ← 父元件，負責注入 Context
└── child.svelte      ← 子元件，透過 getter 存取 Context
```

---

## 完整程式碼範例

### 1. `store.svelte.ts` — 定義 Context

使用 `createContext<T>()` 建立型別安全的 getter / setter pair。
Context class 的屬性使用 `$state` rune，確保任何修改都會觸發響應式更新。

```ts
// src/routes/test/store.svelte.ts
import { createContext } from "svelte";

export class MyContext {
  tags = $state<string[]>(["Svelte", "SSR"]);
  minRating = $state(0);
}

export const [getMyContext, setMyContext] = createContext<MyContext>();
```

**重點說明：**
- `$state<string[]>` 讓陣列具備深層響應性，包含 `.push()` 等 mutating 操作
- `createContext` 回傳 tuple `[getter, setter]`，直接解構命名導出

---

### 2. `+page.svelte` — 父元件（注入 Context）

在父元件中呼叫 `setMyContext` 建立並注入 Context 實例，同時可直接操作其響應式屬性。

```svelte
<!-- src/routes/test/+page.svelte -->
<script>
  import { MyContext, setMyContext } from "./store.svelte";
  import Child from "./child.svelte";

  const myContext = setMyContext(new MyContext());
</script>

<h1>父元件 (Page)</h1>
<button onclick={() => myContext.minRating++}>
  增加評分: {myContext.minRating}
</button>

<hr />
<Child />

<ul>
  {#each myContext.tags as tag}
    <li>{tag}</li>
  {/each}
</ul>
```

**重點說明：**
- `setMyContext(new MyContext())` 同時完成**注入**與**持有實例**
- 父元件與子元件操作的是**同一個** `MyContext` 實例，狀態完全同步

---

### 3. `child.svelte` — 子元件（消費 Context）

在任意深度的子元件中呼叫 `getMyContext()` 即可取得父元件注入的同一實例。

```svelte
<!-- src/routes/test/child.svelte -->
<script>
  import { getMyContext } from "./store.svelte";

  const ctx = getMyContext();
</script>

<div style="border: 1px solid #ccc; padding: 10px; margin-top: 10px;">
  <h2>子元件 (Child)</h2>
  <p>目前的評分 (來自父元件): {ctx.minRating}</p>

  <button onclick={() => ctx.tags.push("New Tag")}> 新增標籤 </button>

  <ul>
    {#each ctx.tags as tag}
      <li>{tag}</li>
    {/each}
  </ul>
</div>
```

**重點說明：**
- `getMyContext()` 不需要傳入任何參數，Svelte 自動沿元件樹向上尋找最近的 Context
- 子元件對 `ctx.tags.push(...)` 的修改會同步反映在父元件的 `{#each}` 列表中

---

## 資料流示意

```
+page.svelte
  setMyContext(new MyContext())   ← 建立並注入
  myContext.minRating++           ← 父元件修改
      │
      └── child.svelte
            getMyContext()        ← 取得同一實例
            ctx.tags.push(...)    ← 子元件修改，父元件同步更新
```

---

## 注意事項

- `store.svelte.ts` 副檔名必須為 `.svelte.ts`，才能在檔案頂層使用 `$state` rune
- `setMyContext` 必須在元件的**同步初始化**階段呼叫（`<script>` 頂層），不可在回呼或非同步函式中呼叫
- 若子元件在 Context 注入前呼叫 `getMyContext()`，會拋出執行時錯誤
