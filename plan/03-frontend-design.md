# 標籤路由前端設計

## 路由與檔案

新增路由：`/tags`

建議檔案：

```txt
src/routes/tags/
  +page.server.ts        # SSR 讀 URL，呼叫 queryTags(... sampleLimit: 5)
  +page.svelte           # 唯一 template，包含上方工具列與下方 grid
  tagsFilter.svelte.ts   # URL 狀態、搜尋 debounce、篩選/排序 handlers
```

依照 `docs/frontend/pages.md`，不要為這個頁面拆頁面專屬子組件。卡片 markup 用 `{#snippet tagCard(tag)}` 放在 `+page.svelte` 內即可。

根 layout 也需要更新：

- `navItems` 加入 `/tags`，圖示可先用既有 `IconTagFilled`。
- `currentStatus` 增加 `/tags`，例如 `正在 瀏覽標籤`。
- `currentActiveItem` 增加 `/tags`，讓導航 palette 能正確標示目前頁面。

## 資料流

`+page.server.ts` 回傳：

```ts
{
  tags: TagWithSamples[];
  total: number;
  page: number;
  pages: number;
}
```

`+page.svelte` 只接收 SSR data、實例化 `TagsFilter`、定義 snippet 與樣式。互動邏輯集中在 `tagsFilter.svelte.ts`：

- 直接從 `$app/state` 的 `page.url` 讀取 query params。
- 使用 `parseTagQueryParams()` 建立 `$derived` 欄位。
- 搜尋輸入採 debounce，其他 select/input change 立即 `goto()`。
- `goto()` 使用 `{ replaceState: true, noScroll: true, keepFocus: true }`，沿用現有 `FilterFields` 的體驗。
- reset 透過 `buildTagQueryString({}, new URLSearchParams(page.url.searchParams))` 清除 tag query keys。

`TagsFilter` 建議欄位：

```ts
search: string;
minCount: number | undefined;
maxCount: number | undefined;
sort: TagSortField;
order: "asc" | "desc";
```

如果數字輸入需要暫存空字串，可在 class 內多放 `minCountText` / `maxCountText`，送 URL 前再轉成 number，避免 template 出現解析邏輯。

## 頁面結構

第一視窗就是可用工具，不做 landing/hero。

```svelte
<main class="slide-up">
  <section class="toolbar" aria-label="標籤搜尋與篩選">
    <header>
      <h2>標籤</h2>
      <p>共 {data.total} 個</p>
    </header>

    <form role="search" onsubmit={filter.handleFormSubmit}>
      <!-- search / minCount / maxCount / sort / order / reset -->
    </form>
  </section>

  <section class="grid-viewport" class:pending={navigating.to} aria-label="標籤列表">
    {#if data.total === 0 && !navigating.to}
      <p>找不到符合條件的標籤</p>
    {/if}

    <ul class="grid">
      {#each data.tags as tag (tag.name)}
        <li>{@render tagCard(tag)}</li>
      {/each}
    </ul>
  </section>
</main>
```

`toolbar` 是全寬區塊，不做浮動卡片。`grid-viewport` 負責滾動，保留全域 header 下方的工作區感。

## 上方搜尋、篩選、排序

控制項建議：

- 搜尋：`.text-input`，placeholder `搜尋標籤...`。
- 使用次數下限/上限：`.text-input` number，或常用門檻的 `Select`。第一版用 number 彈性最高。
- 排序：`Select`，選項 `使用次數`、`名稱`、`最近使用`、`隨機`。
- 方向：`Select`，選項 `降冪`、`升冪`；`sort=random` 時可以 disabled 或保持但不生效。
- 重置：`.btn-icon` 或 `.btn-outlined btn-sm`，使用既有 `IconX` 或新增合適的本地 Tabler icon。

桌面版可用一列 responsive grid：

```css
.toolbar > form {
  display: grid;
  grid-template-columns: minmax(14rem, 2fr) repeat(4, minmax(8rem, 1fr)) auto;
  gap: 0.5rem;
  align-items: end;
}
```

窄螢幕改為自動換行或單欄：

```css
@media (max-width: 760px) {
  .toolbar > form {
    grid-template-columns: 1fr 1fr;
  }

  .field-search,
  .actions {
    grid-column: 1 / -1;
  }
}

@media (max-width: 460px) {
  .toolbar > form {
    grid-template-columns: 1fr;
  }
}
```

所有 label 使用頁面 scoped style，小字級沿用 `var(--font-size-body2)` 與 `var(--text-muted)`，維持與 `FilterFields.svelte` 一致。

## Grid 設計

標籤頁重點是 grid 自身的響應式，而不是圖片固定寬度。建議不用 masonry，直接使用 CSS grid：

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
  gap: 0.75rem;
  padding: 1rem;
  align-content: start;
}

@media (max-width: 600px) {
  .grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 13.5rem), 1fr));
    gap: 0.5rem;
    padding: 0.5rem;
  }
}
```

這個設計讓卡片在寬桌面上自然增加欄數，在手機上保留完整卡片寬度，不會把內容擠到破碎。

## 卡片內容與互動

卡片是 repeated item，使用 card 是合理的。建議整張卡片是一個連結，點擊後進入圖片瀏覽頁並套用該標籤：

```svelte
{#snippet tagCard(tag: TagWithSamples)}
  <a class="card" href={`/${buildQueryString({ includedTags: [tag.name] })}`} aria-label={`瀏覽標籤 ${tag.name} 的 ${tag.count} 張圖片`}>
    <article>
      <header>
        <h3 class="ellipsis">{tag.name}</h3>
        <span class="badge">{tag.count}</span>
      </header>

      <div class="samples" aria-hidden="true">
        {#each tag.samples as sample (sample.id)}
          <img
            src={imgSrc(sample.id, "sm")}
            style={blurhashStyle({ fit: "cover", blurhash: sample.blurhash, width: sample.width, height: sample.height })}
            alt=""
            decoding="async"
          />
        {/each}
      </div>
    </article>
  </a>
{/snippet}
```

`alt=""` 是刻意的：五張樣本圖是標籤卡片的裝飾性預覽，主要資訊已由 tag name、count 與連結 aria-label 提供，避免螢幕閱讀器重複朗讀多張圖片名稱。

## 圖片消散效果

參考 `Tags.svelte` 的 `mask-image`，樣本列固定不換行，超出右側時淡出。圖片本身不需要知道容器剩多少寬度。

```css
.samples {
  display: flex;
  gap: 0.375rem;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  mask-image: linear-gradient(to right, black calc(100% - 4rem), transparent);
}

.samples > img {
  flex: 0 0 clamp(3.25rem, 24%, 5rem);
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: calc(var(--radius) * 0.75);
  background: var(--bg);
}
```

卡片變窄時，右側圖片會自然進入 mask 的透明區域；圖片寬度只是視覺節奏，不參與「是否放得下」的判斷。

## 視覺風格

延續現有深色、低飽和、工具導向外觀：

- 背景：頁面 `var(--bg)`，toolbar 與卡片 `var(--bg-card)`。
- 邊框：`var(--border-style)`，hover 時改 `var(--border-hover)`。
- 圓角：卡片 `var(--radius)` 或最多 `calc(var(--radius) * 1.25)`，不要做大圓角或浮誇陰影。
- 字級：卡片標題用 `var(--font-size-title2)` 或 `body1`，不要使用 hero 級字體。
- hover：只做 border、background、輕微 `scale` 或圖片亮度變化，避免廉價的高彩度效果。
- 不使用裝飾性漸層球、hero 區、巢狀 card。

卡片 CSS 草圖：

```css
.card {
  display: block;
  height: 100%;
  min-width: 0;
  color: inherit;
}

.card > article {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-width: 0;
  padding: 0.75rem;
  background: var(--bg-card);
  border: var(--border-style);
  border-radius: var(--radius);
  transition: border-color 0.15s, background 0.15s, scale 0.15s;
}

.card:hover > article,
.card:focus-visible > article {
  border-color: var(--border-hover);
  background: var(--bg-hover);
}

.card:active > article {
  scale: 0.99;
}

.card > article > header {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}
```

## Empty、loading 與錯誤狀態

- 空結果：在 grid viewport 中置中顯示一行 `找不到符合條件的標籤`，不要做大型插畫或卡片。
- 導航中：`grid-viewport` 加 `.defer-dim` 或 scoped `class:pending={navigating.to}`，沿用 CSS-only loading debounce。
- 收藏庫未設定：`+page.server.ts` 與其他頁面一樣 redirect 到 `/settings?alert=error`。

## 實作後驗證

完成實作後建議跑：

```bash
npm run check
npm run build
```

前端應再用瀏覽器檢查至少三個寬度：

- 桌面寬螢幕：grid 欄數自然增加，toolbar 不過寬。
- 平板寬度：toolbar 換行後仍可掃描，卡片樣本列淡出正常。
- 手機寬度：單欄或雙欄卡片不擠壓文字，樣本圖片右側自然消散，沒有水平 overflow。
