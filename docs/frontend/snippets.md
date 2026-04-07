# Snippets

> Svelte 5 的 `{#snippet}` 是 **template 層面的變數**——就像 JS 中會把複雜運算透過變數使其可讀，snippet 把重複或複雜的 HTML 抽成一個具名片段。

---

## 核心特性

- **不是組件**：沒有自己的 scope、props 介面或生命週期，只是 markup 的集中定義
- **單檔案內共用**：在同一個 `.svelte` 檔案中定義並使用，不跨檔案
- **支援參數**：可以帶型別化的參數，像 function call 一樣使用
- **支援預設值**：參數可以有預設值（如 `asAction = false`）
- **可以當參數傳遞**：Snippet 本身可以作為另一個 snippet 的參數，實現「機制由外層提供、內容由呼叫者決定」的組合

---

## 用途分類

### 1. 迴圈內的重複片段

最基本的用法——從 `{#each}` 中抽出 item template，降低嵌套層級。

```svelte
<!-- (home)/+page.svelte -->
{#snippet card({ item }: { item: (typeof masonry.masonryItems)[number] })}
  <button type="button" onclick={() => modal.handleTriggerClick(item.id)}>
    <figure>
      <img src={imgSrc(item.id, "md")} alt={item.name} />
      <figcaption>
        <h3 class="ellipsis">{item.name}</h3>
        <Rating value={item.rating} size="1rem" readonly />
        <Tags tags={item.tags} nowrap />
      </figcaption>
    </figure>
  </button>
{/snippet}

<ul class="masonry">
  {#each masonry.masonryItems as item (item.id)}
    <li class="masonry-item" style={item.style}>
      {@render card({ item })}
    </li>
  {/each}
</ul>
```

> 注意到 snippet 由於是在同檔案中，可以直接呼叫 `modal.handleTriggerClick`，不需要透過 props 傳入 handler。

### 2. 頁面章節組織

當一個頁面有多個邏輯獨立的區塊時，用無參數 snippet 拆分章節，讓頂層結構一目了然。

```svelte
<!-- settings/+page.svelte -->
{#snippet collectionSettings()} ... {/snippet}
{#snippet tagsSettings()} ... {/snippet}
{#snippet imagesSettings()} ... {/snippet}
{#snippet maintenanceSettings()} ... {/snippet}

<main>
  {@render collectionSettings()}
  {#if data.collectionRoot}
    {@render tagsSettings()}
    {@render imagesSettings()}
    {@render maintenanceSettings()}
  {/if}
</main>
```

好處：章節之間的條件渲染（如 `{#if data.collectionRoot}`）清晰呈現在頂層，不會淹沒在數百行 HTML 中。

### 3. 帶預設參數的 snippet

Snippet 參數可以有預設值，讓同一段 markup 在不同語境下改變行為。

```svelte
<!-- player/+page.svelte -->
{#snippet playIcon(size: number, asAction = false)}
  {@const showPlay = asAction ? !player.playing : player.playing}
  {#if showPlay}
    <IconPlayerPlay {size} />
  {:else}
    <IconPlayerPause {size} />
  {/if}
{/snippet}

<!-- 作為狀態指示（大圖示，顯示當前狀態） -->
{@render playIcon(64)}

<!-- 作為操作按鈕（小圖示，顯示點擊後的效果） -->
{@render playIcon(18, true)}
```

`asAction` 預設為 `false`，讓呼叫端只在需要反轉語意時才傳入第二個參數。

### 4. 元件化 snippet——接收 Snippet 作為參數

Snippet 可以接受 Svelte 的 `Snippet` 型別作為參數，實現類似 slot 的組合模式，但不需要建立獨立的 `.svelte` 組件檔案。

```svelte
<!-- settings/+page.svelte -->
<script lang="ts">
  import type { Snippet } from "svelte";
</script>

{#snippet toolCard(props: {
  Icon: typeof IconPhoto;
  title: string;
  description: string;
  content?: Snippet;          <!-- 可選的 Snippet 參數 -->
  actions: Array<{ label: string; onclick: () => void; pending?: boolean; hide?: boolean }>;
  result?: string;
})}
  <article class="tool-card">
    <header>
      <props.Icon size={18} />
      <h3>{props.title}</h3>
    </header>

    <p>{props.description}</p>

    {#if props.content}
      <div>
        {@render props.content()}     <!-- 渲染傳入的 snippet -->
      </div>
    {/if}

    <footer>
      {#each props.actions as { label, onclick, pending, hide }}
        {#if !hide}
          <button class="btn-outlined btn-sm" class:pending disabled={pending} {onclick}>
            <span>{label}</span>
          </button>
        {/if}
      {/each}
    </footer>

    {#if props.result}
      <output>{props.result}</output>
    {/if}
  </article>
{/snippet}
```

呼叫端可以定義一個 snippet 並傳入：

```svelte
{#snippet cacheStats()}
  <div class="cache-stats">
    <span>{images.cacheEntries} 張圖片</span>
    <span class="sep">·</span>
    <span>{images.cacheMB} MiB</span>
  </div>
{/snippet}

{@render toolCard({
  Icon: IconPhoto,
  title: "圖片快取",
  description: "系統會將處理過的縮圖與 WebP 轉換結果暫存於記憶體中。",
  content: cacheStats,          <!-- 把 snippet 當作參數傳入 -->
  actions: [{ label: "清空快取", onclick: images.handleClearBtnClick }],
})}
```

### 5. 注入共用組件

Snippet 也可以作為共用組件的 children——把複雜的內容定義在 snippet 中，再注入到組件裡：

```svelte
<!-- (home)/+page.svelte -->
{#snippet modelContent(record: NonNullable<typeof modal.record>)}
  <article class="modal-content">
    <header>...</header>
    <div class="image-wrapper">
      <img src={imgSrc(record.id, "xl")} alt={record.name} />
    </div>
    <footer>
      <Rating value={record.rating} size="1.5rem" readonly />
    </footer>
  </article>
{/snippet}

<Modal fullscreen open={modal.record !== null} onclose={modal.handleClose}>
  {@render modelContent(modal.record!)}
</Modal>
```

將 modal 的 markup 抽出成 snippet，讓 `<Modal>` 的呼叫處保持簡潔；同時 snippet 的參數型別（`NonNullable<...>`）提供了額外的型別安全。

---

## Snippet vs 組件的判斷

| 情境                             | 選擇     |
| -------------------------------- | -------- |
| 同一頁面內重複出現的 HTML 片段   | Snippet  |
| 純粹降低 indent / 提取可讀性     | Snippet  |
| 頁面章節組織（拆分長頁面）       | Snippet  |
| 同頁面內多次出現的參數化 UI 區塊 | Snippet  |
| 跨頁面復用的 UI 單元             | 共用組件 |
| 需要自己的 scoped 樣式           | 共用組件 |

經驗法則：**如果一段 UI 只在一個 `.svelte` 檔案中使用，它就是 snippet，不需要獨立成組件。**
