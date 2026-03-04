# 最終架構文件 — plan6

> **撰寫**：2026-03-04
> **前置**：取代 `docs_plan5.md`（Browse 部分），其餘路由仍參照 plan2–plan4
> **目的**：記錄 `/browse` 路由的最終實作架構，與 plan5 原始設計的差異理由

---

## 〇、設計原則（沿用 + 演化）

| # | 原則 | 來源 |
|---|------|------|
| 1 | 體驗等於或優於 old-ref | plan5 原則 1 |
| 2 | Filter 層沿用 Tagger 模式（store + actions） | plan5 原則 2 |
| 3 | Svelte 5 runes only | plan4 規範 K |
| 4 | **Player 完全脫離 Svelte reactivity** — 所有高頻狀態為 `onMount` 閉包內純 JS 變數，非 `$state` | plan5 原則 4 → 更徹底 |
| 5 | **Filter / Player 拆為兩個路由**，以 URL params 傳遞篩選條件 | 新增，取代 plan5 的 PhaseStore 切換 |

### 原則 4–5 的理由

plan5 將 `images`、`offsets`、`widths`、`scrollX` 等高頻數據放在 `$state` store class 中，rAF loop 每幀讀寫。
實測發現 **Svelte 5 的 `$state` deep reactive proxy** 導致：

- 讀取 `playerStore.offsets[i]` 會觸發響應式追蹤，產生不必要的 proxy 開銷
- 陣列在 proxy 層被攔截後行為異常：只有前幾張圖顯示，其餘空白
- seek 回起點時圖片錯位（proxy 快取與實際索引不一致）

**解法**：將 Player 狀態全部降級為 `onMount` 閉包中的普通變數（`let scrollX = 0`），徹底繞過 proxy。
既然 Player 不再依賴 store，PhaseStore 單頁切換就失去意義——不如拆成子路由，由 SSR 直接載入圖片。

---

## 一、檔案結構

```
src/routes/browse/
  +page.server.ts          SSR 預載 allTags（篩選用）
  +page.svelte             頂層頁面殼（只渲染 BrowseFilter）
  stores.svelte.ts         FilterStore（唯一 store）
  actions.ts               篩選業務邏輯 + startPlayer()（goto 導航）
  BrowseFilter.svelte      篩選畫面元件
  BrowseFilter.css         篩選畫面樣式
  player/
    +page.server.ts        SSR 載入圖片（queryImages + URL params，上限 200）
    +page.svelte           完整播放器（onMount 閉包 + rAF + 虛擬化 + dock）
    BrowsePlayer.css       播放畫面 + dock + 回饋動畫樣式
```

共 **9 個檔案**，分佈於 2 個目錄。

### 與 plan5 的差異

| plan5 | 實際 | 原因 |
|-------|------|------|
| 10 檔、無子目錄 | 9 檔、`player/` 子路由 | Player 獨立路由更乾淨 |
| 4 個 Store class | 1 個 FilterStore | Player 狀態全在閉包 |
| `helpers.ts` 獨立檔案 | 已刪除，邏輯 inline | 只有 Player 使用，放閉包內更自然 |
| `BrowsePlayer.svelte` 元件 | `player/+page.svelte` 即 Player | 子路由的頁面就是元件本身 |
| Client-side `fetchAllImages()` 多頁 fetch | SSR `+page.server.ts` 一次查詢 | 減少 client 複雜度，首幀可見更快 |

---

## 二、路由流程

```
使用者訪問 /browse
  → +page.server.ts: getAllTags(db) → { allTags }
  → +page.svelte:    initBrowse(allTags) → 渲染 BrowseFilter

使用者設定篩選 → 即時計數（debounce 200ms → GET /api/images?limit=1）

使用者點「開始瀏覽」
  → actions.startPlayer(): 組裝 URL params → goto('/browse/player?tags=...&rating=...&sort=...')

SvelteKit 導航到 /browse/player
  → player/+page.server.ts: parseQueryParams(url) → queryImages(db, opts) → { images, total }
    若 total === 0 → redirect 302 /browse
  → player/+page.svelte: onMount 啟動 rAF 播放迴圈

使用者按 Escape / 點「篩選」按鈕
  → goto('/browse')（回到篩選頁）
```

---

## 三、Filter 層

### 3.1 Store (`stores.svelte.ts`)

```ts
class FilterStore {
  allTags    = $state<TagInfo[]>([]);
  tags       = $state<string[]>([]);
  minRating  = $state(0);
  sort       = $state<'committedAt' | 'rating' | 'originalName' | 'random'>('committedAt');
  matchCount = $state(0);
  counting   = $state(false);
}
export const filterStore = new FilterStore();
```

純資料，不含方法。與 Tagger 的 stores 模式一致。

### 3.2 Actions (`actions.ts`)

| 函式 | 說明 |
|------|------|
| `initBrowse(allTags)` | 重設所有欄位、觸發初始計數 |
| `addTag(tag)` | 新增標籤 → 重新計數 |
| `removeTag(tag)` | 移除標籤 → 重新計數 |
| `setMinRating(n)` | 設定/切換最低評等 → 重新計數 |
| `setSort(s)` | 設定排序方式（不觸發計數） |
| `updateCount()` | debounce 200ms → `GET /api/images?limit=1&page=1&...` → 寫入 matchCount |
| `startPlayer()` | 組裝 URL params → `goto('/browse/player?...')` |

Actions 是 filterStore 的**唯一寫入口**。

### 3.3 BrowseFilter 元件

- **TagAutocomplete** + **TagChips**：標籤篩選（共用元件）
- **Rating**：最低評等（`bind:value`，`$effect` 監聽變化觸發 `updateCount`）
- **Select**：排序方式（共用元件，四選項：提交時間/評等/檔名/隨機）
- 計數文字：`共 N 張符合` / `查詢中...`
- 開始瀏覽按鈕（disabled when matchCount === 0 || counting）
- 返回首頁連結

---

## 四、Player 層

### 4.1 SSR (`player/+page.server.ts`)

```ts
const MAX_IMAGES = 200;

export const load = ({ url }) => {
  const opts = parseQueryParams(url);
  opts.limit = MAX_IMAGES;
  opts.ratingOp = 'gte';
  const result = queryImages(db, opts);
  if (result.total === 0) redirect(302, '/browse');
  return { images: result.items, total: result.total };
};
```

- `parseQueryParams(url)` 解析 `tags`, `rating`, `sort`, `order` 等 URL 參數
- 強制 `limit=200`、`ratingOp='gte'`
- 結果為零時 redirect 回篩選頁
- SSR 一次載入，client 不再二次 fetch

### 4.2 頁面元件 (`player/+page.svelte`)

#### Svelte 響應式部分（僅 3 個 `$state`，低頻 UI）

| 變數 | 用途 |
|------|------|
| `dockVisible` | Dock 可見性（CSS class 切換） |
| `playing` | Play/Pause 圖標切換 |
| `speedDisplay` | 速度數值文字 |

#### DOM refs（`bind:this`，供 `onMount` 內命令式 event binding）

`carouselEl`, `dockEl`, `sliderEl`, `textEl`, `speedSliderEl`, `playBtnEl`, `backBtnEl`, `feedbackEl`

#### `onMount` 閉包（純 JS，無 `$state`）

所有高頻狀態都是普通 `let` 變數：

```
scrollX, stripWidth, offsets[], widths[],
isPlaying, speed, lastTime, seeking,
rafId, lastUpdateX, idleTimer, resizeTimer
renderedMap (Map), pool (Map)
```

##### 核心函式

| 函式 | 職責 |
|------|------|
| `buildLayout()` | 依 `window.innerHeight` 計算每張圖的偏移 & 寬度，清空 DOM |
| `updateVisibleImages()` | viewport ± 2000px buffer → 計算 copy-based 需求 → 池化複用 img 元素 |
| `applyTransform()` | `carouselEl.style.transform = translateX(-scrollX)` |
| `updateProgress()` | 直接 DOM 寫入 slider.value + text.textContent（不走 Svelte） |
| `tick(ts)` | rAF 回呼：推進 scrollX → wrap → applyTransform → 條件更新可見圖 → 更新進度 |
| `togglePlay()` | 切換 isPlaying + 同步 Svelte `playing` + 顯示回饋動畫 |
| `showFeedback(icon)` | YouTube 風格中心圓圈彈出動畫（play/pause SVG） |

##### 事件處理

| 事件 | 行為 |
|------|------|
| carousel click（250ms 延遲） | 單擊 → togglePlay |
| carousel dblclick | 雙擊 → `window.open('/editor?id=...')` |
| mousemove | 顯示 dock → 重設 2500ms idle timer |
| keydown Space | togglePlay |
| keydown Escape | `goto('/browse')` |
| resize | debounce 150ms → 保留百分比 → rebuildLayout |
| slider input | seek 模式（暫停自動推進） |
| slider change | 結束 seek |
| speed slider input | 更新 speed + speedDisplay |

##### 清理

`onMount` return 函式移除所有 event listener、cancelAnimationFrame、清空 renderedMap + pool。

---

## 五、虛擬化策略

與 plan5 §六 相同，但實作全在閉包中：

1. **佈局預計算**：`buildLayout()` 一次算好 `offsets[]`、`widths[]`、`stripWidth`
2. **Copy-based 無限循環**：`copy = floor(scrollX / stripWidth)` 決定當前副本，viewport ± 2000px 涵蓋鄰近副本
3. **DOM 池化**：`renderedMap` 追蹤已渲染 slot，`pool` 暫存同一 `imgIdx` 的 DOM 節點供複用（避免 re-decode）
4. **條件更新**：僅在 `scrollX` 與 `lastUpdateX` 差距 ≥ 300px 或 wrap 時觸發 `updateVisibleImages()`
5. **最大圖片數**：SSR 限制 200 張，通常 viewport 寬度內只有 5–10 個 img 在 DOM 中

---

## 六、視覺回饋

### 6.1 Play / Pause 回饋（YouTube 風格）

每次 togglePlay 時，畫面中央顯示一個圓形半透明遮罩 + play/pause SVG 圖標：

```css
.browse-feedback {
  position: fixed; top: 50%; left: 50%; translate: -50% -50%;
  width: 88px; height: 88px; border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  pointer-events: none; opacity: 0; scale: 0.6; z-index: 250;
}
.browse-feedback.is-animating {
  animation: feedback-pop 0.55s ease-out forwards;
}
@keyframes feedback-pop {
  0%   { opacity: 0.9; scale: 0.6; }
  30%  { opacity: 0.9; scale: 1; }
  100% { opacity: 0;   scale: 1.35; }
}
```

動畫由 `showFeedback()` 命令式觸發：移除 class → reflow → 加回 class。

### 6.2 Dock 過渡

```css
.browse-dock { transition: opacity 0.3s ease, transform 0.3s ease; }
.browse-dock.is-hidden { opacity: 0; transform: translateY(100%); pointer-events: none; }
```

2500ms 無滑鼠移動 → 自動隱藏。

---

## 七、CSS 架構

| 檔案 | 位置 | 內容 |
|------|------|------|
| `BrowseFilter.css` | `src/routes/browse/` | 篩選卡片佈局（flex center, max-width 480px） |
| `BrowsePlayer.css` | `src/routes/browse/player/` | 播放器全螢幕、carousel img、dock 列、range input 自訂外觀、回饋動畫 |

兩個 CSS 各由其對應的 `.svelte` 檔以 `@import` 引入（Svelte scoped style）。

**注意**：`.browse-carousel img` 使用一般後代選擇器（非 `:global`），因為 `<img>` 由 JS `createElement` 產生後 `appendChild` 到 `.browse-carousel`，而 Svelte scoped CSS 只要父元素帶有 scoped attribute，子代選擇器就能正確命中。

---

## 八、與其他路由的模式對照

| 面向 | Tagger | Browse-Filter | Browse-Player |
|------|--------|---------------|---------------|
| Store | 6 class（$state） | 1 class（$state） | 0（純閉包變數） |
| Actions | 獨立 actions.ts | 獨立 actions.ts | 全在 onMount 內 |
| Helpers | 獨立 helpers.ts | — | 全在 onMount 內 |
| 子元件 | 6 個 | 1 個（BrowseFilter） | 0（頁面即元件） |
| 路由 | 單頁 /tagger | /browse | /browse/player |
| SSR | allTags + stagedFiles | allTags | images（queryImages） |
| 高頻迴圈 | 無 | 無 | rAF（60fps） |

Browse-Player 的「無 store、無 actions 檔」設計是**有意為之**——高頻 rAF 迴圈中存取 Svelte proxy 的成本不可接受，閉包變數是唯一正確的選擇。

---

## 九、API 端點使用

| 時機 | 端點 | 來源 |
|------|------|------|
| Filter 即時計數 | `GET /api/images?limit=1&page=1&tags=...&rating=...&ratingOp=gte` | actions.ts `updateCount()` |
| Player SSR 載入 | （server-side 直接呼叫 `queryImages(db, opts)`） | player/+page.server.ts |
| 雙擊開啟 Editor | `window.open('/editor?id=...')` | player/+page.svelte |

Player 自身不做任何 API 請求——圖片資料由 SSR 提供，圖片內容透過 `/img/committed/[id][ext]` 代理載入。

---

## 十、已完成的完整路由清單

| 路由 | 狀態 | 計畫文件 |
|------|------|----------|
| `/` 首頁 | ✅ 完成 | plan2 Phase 3.1 |
| `/setup` | ✅ 完成 | plan2 Phase 3.2 |
| `/tagger` | ✅ 完成 | plan2 Phase 3.3 |
| `/editor` | ✅ 完成 | plan2 Phase 3.4 |
| `/scroll` | ✅ 完成 | plan2 Phase 3.5 |
| `/compare` | ✅ 完成 | plan2 Phase 3.6 |
| `/browse` | ✅ 完成 | plan5 → **plan6**（本文件） |
| `/browse/player` | ✅ 完成 | plan5 → **plan6**（本文件） |

**所有 7 個頁面路由（含 browse/player 子路由）均已實作完成。**
