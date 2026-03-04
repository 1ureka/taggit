# Browse 頁面實作計畫 — plan5

> **撰寫**：2026-03-04
> **前置**：必須先讀完 `docs_plan4.md`（§七）與 `old-ref/public/browse/` 三檔
> **目標**：定義 `/browse` 的檔案切分、stores、actions、虛擬化策略、時間軸對齊方式

---

## 〇、設計原則

1. **體驗等於或優於 old-ref**——滾動、循環、速度、進度條、dock 隱藏行為一模一樣。
2. **架構對齊 Tagger 模式**——`stores.svelte.ts`（純資料）+ `actions.ts`（唯一寫入口）+ `helpers.ts`（純計算）。
3. **Svelte 5 runes only**——`$state`, `$derived`, `$effect`, `$props`, `$bindable`；禁止 Svelte 4 語法。
4. **播放迴圈脫離 Svelte reactivity**——rAF loop 直接讀 store fields，手動操作 DOM transform + 虛擬化，不經 `$effect`。
5. **Filter 階段可以用 Svelte reactivity** 正常驅動 UI。

---

## 一、檔案結構

```
src/routes/browse/
  +page.server.ts          SSR 預載 allTags
  +page.svelte             頂層頁面殼（切換 Filter / Player）
  stores.svelte.ts         所有 reactive state（class 寫法）
  actions.ts               業務邏輯 (唯一 store mutator)
  helpers.ts               純函式（buildLayout, shuffleArray 等）
  BrowseFilter.svelte      篩選畫面元件
  BrowsePlayer.svelte      播放畫面元件（含 carousel + dock）
  BrowsePlayer.css         播放畫面 + dock 樣式
  BrowseFilter.css         篩選畫面樣式
```

共 **10 個檔案**；無更深子目錄。

---

## 二、SSR 層 (`+page.server.ts`)

```ts
export const load: PageServerLoad = () => {
  const db = getDB();
  return { allTags: getAllTags(db) };
};
```

- 僅預載 `allTags`（篩選用），不載入圖片資料。
- 圖片資料由 client-side actions 在「開始瀏覽」時透過多頁 fetch 取得。

---

## 三、Stores (`stores.svelte.ts`)

遵循 Tagger 模式：每個 store 是 class instance + `$state` 欄位，**不含任何方法或邏輯**。

### 3.1 FilterStore

```ts
class FilterStore {
  allTags    = $state<TagInfo[]>([]);   // SSR 預載，hydrate 後由 actions 初始化
  tags       = $state<string[]>([]);    // 使用者選取的 tags
  minRating  = $state(0);              // 0 = 不篩選
  sort       = $state<'committedAt' | 'rating' | 'originalName' | 'random'>('committedAt');
  matchCount = $state(0);              // 即時符合數量
  counting   = $state(false);          // debounce 中
}
export const filterStore = new FilterStore();
```

### 3.2 PlayerStore

```ts
class PlayerStore {
  /** 載入完成的全部圖片（最多由 MAX_IMAGES 截斷） */
  images     = $state<ImageWithId[]>([]);
  /** 是否正在播放 */
  playing    = $state(false);
  /** 每 16.667ms 前進 px（= speed slider 值） */
  speed      = $state(1.5);
  /** 目前水平捲動偏移 px（rAF 迴圈直接讀寫，不走 $effect） */
  scrollX    = $state(0);
  /** 整條圖片帶的總寬度 px */
  stripWidth = $state(0);
  /** 每張圖的累計 x 偏移（pre-computed） */
  offsets    = $state<number[]>([]);
  /** 每張圖的像素寬度（pre-computed） */
  widths     = $state<number[]>([]);
  /** 目前「正在看」的圖片 index（從 scrollX 反算，用於進度文字） */
  currentIdx = $state(0);
  /** 使用者正在拖曳 progress slider */
  seeking    = $state(false);
  /** rAF ID（用於 cleanup） */
  rafId      = $state<number | null>(null);
  /** 上一幀 timestamp */
  lastTime   = $state(0);
  /** 圖片載入中（fetchAllImages 期間） */
  loading    = $state(false);
}
export const playerStore = new PlayerStore();
```

### 3.3 PhaseStore

```ts
class PhaseStore {
  /** 'filter' | 'player' — 控制頁面切換 */
  current = $state<'filter' | 'player'>('filter');
}
export const phaseStore = new PhaseStore();
```

### 3.4 DockStore

```ts
class DockStore {
  visible   = $state(true);
  idleTimer = $state<ReturnType<typeof setTimeout> | null>(null);
}
export const dockStore = new DockStore();
```

> **為何分 4 個 store？**
> - FilterStore 與 PlayerStore 職責完全不同且生命週期不同（filter 始終存在；player 進入播放才有意義）。
> - PhaseStore 獨立避免循環依賴。
> - DockStore 僅控制 UI 可見性，與播放邏輯正交。

---

## 四、Actions (`actions.ts`)

**唯一允許寫入 stores 的模組。** 元件透過 import 呼叫，不透過 props/events 傳遞 action reference。

### 4.1 Init

```ts
export function initBrowse(allTags: TagInfo[]) { ... }
```
- 重設所有 store 為初始值。
- `filterStore.allTags = allTags`。

### 4.2 Filter 操作

```ts
export function addTag(tag: string) { ... }
export function removeTag(tag: string) { ... }
export function setMinRating(n: number) { ... }
export function setSort(s: FilterStore['sort']) { ... }
export const updateCount: DebouncedFn     // debounce 200ms → GET /api/images?limit=1&page=1&... → filterStore.matchCount
```

- `addTag` / `removeTag` / `setMinRating` / `setSort` 修改 filterStore 後自動呼叫 `updateCount()`。
- `updateCount` 內部組裝 query params，只取 `total`（`limit=1`），寫入 `filterStore.matchCount`。

### 4.3 Player 生命週期

```ts
export async function startPlayer() { ... }
export function stopPlayer() { ... }          // 返回篩選畫面
```

**`startPlayer` 流程：**
1. 設 `playerStore.loading = true`。
2. 呼叫 `fetchAllImages()`（見 §4.5），存入 `playerStore.images`。
3. 若 `sort === 'random'` → in-place shuffle。
4. 呼叫 `buildLayout()`（helpers）→ 寫入 `offsets`, `widths`, `stripWidth`。
5. `scrollX = 0`, `playing = true`, `lastTime = 0`, `seeking = false`。
6. `phaseStore.current = 'player'`。
7. 啟動 rAF loop（見 §六）。
8. `playerStore.loading = false`。

**`stopPlayer` 流程：**
1. `cancelAnimationFrame(playerStore.rafId)`。
2. 清空 player state（images、offsets、widths、stripWidth、renderedMap 等）。
3. `phaseStore.current = 'filter'`。
4. 重新 `updateCount()`。

### 4.4 播放控制

```ts
export function togglePlay() { ... }
export function setSpeed(v: number) { ... }
export function seekTo(pct: number) { ... }     // 0–1，由 progress slider 呼叫
export function seekEnd() { ... }               // slider mouseup
```

- `togglePlay` 翻轉 `playerStore.playing`；resume 時重設 `lastTime = 0` 避免 delta 跳躍。
- `seekTo` 設 `seeking = true`，`scrollX = pct * stripWidth`，手動呼叫 `applyTransform()` + `updateVisibleImages()`。
- `seekEnd` 設 `seeking = false`，`lastTime = 0`。

### 4.5 資料載入

```ts
async function fetchAllImages(): Promise<ImageWithId[]> { ... }
```

- 最多載入 **MAX_IMAGES = 200** 張（可調整，old-ref 也是 200）。
- 多頁 fetch `GET /api/images?page=N&limit=200&tags=...&rating=...&ratingOp=gte&sort=...&order=...`。
- `sort=random` 時不傳 sort/order（後端隨機），取回後 client shuffle。
- 迴圈直到 `page >= totalPages` 或 `累計 >= MAX_IMAGES`。

### 4.6 Dock 控制

```ts
export function showDock() { ... }
export function resetIdleTimer() { ... }
```

- `showDock` → `dockStore.visible = true`。
- `resetIdleTimer` → 清舊 timer、設新 `setTimeout(2500ms, () => dockStore.visible = false)`。
- 播放畫面的 `mousemove` 呼叫 `showDock() + resetIdleTimer()`。

### 4.7 鍵盤

```ts
export function handleKeydown(e: KeyboardEvent) { ... }
```

- `Space`（僅 player phase）→ `togglePlay()`
- `Escape`（僅 player phase）→ `stopPlayer()`
- 不攔截 INPUT / TEXTAREA。

### 4.8 Resize

```ts
export function handleResize() { ... }
```

- 只在 player phase 時處理。
- 記住 `pct = scrollX / stripWidth` → 重新 `buildLayout()` → `scrollX = pct * newStripWidth` → `applyTransform()` + `updateVisibleImages()`。
- debounce 150ms。

---

## 五、Helpers (`helpers.ts`)

純函式，不依賴任何 store。

### 5.1 buildLayout

```ts
export function buildLayout(
  images: ImageWithId[],
  viewportHeight: number
): { offsets: number[]; widths: number[]; stripWidth: number }
```

- 對每張圖，以 `width / height`（ImageRecord 欄位）算 aspect ratio。
- 圖片顯示高度 = `viewportHeight`（100vh），寬度 = `Math.round(vh * ratio)`。
- 若 `width === 0 || height === 0` → fallback ratio = 1。
- 累計 x 偏移。
- 回傳結果直接寫入 playerStore（由 action 負責）。

### 5.2 calcCurrentIndex

```ts
export function calcCurrentIndex(
  scrollX: number,
  stripWidth: number,
  offsets: number[],
  widths: number[]
): number
```

- 取 `pos = scrollX % stripWidth`。
- 二分搜尋或線性掃描找到第一張 `offset + width > pos` 的圖片。
- 用於進度文字顯示 `"idx+1 / total"`。

### 5.3 shuffleArray

```ts
export function shuffleArray<T>(arr: T[]): T[]
```

Fisher–Yates。in-place 並回傳原 array。

### 5.4 committedUrl

```ts
export function committedUrl(img: ImageWithId): string {
  return `/img/committed/${img.id}${img.ext}`;
}
```

---

## 六、虛擬化與 rAF 迴圈（核心）

### 6.1 設計目標

- 只保留 **viewport ± BUFFER_PX** 範圍內的 `<img>` DOM 節點（BUFFER_PX = 2000px）。
- 使用 **DOM 池化**：圖片滾出範圍時不 `remove()`，而是存入 pool，下次同 imgIdx 可直接復用（避免重新 decode）。
- 支援 **無限循環**：strip 到尾後無縫銜接第一張（copy-based 虛擬化）。

### 6.2 架構：全部在 BrowsePlayer.svelte 的 `onMount` 中

```
onMount → {
  carouselEl: HTMLDivElement           // carousel container DOM ref
  renderedMap: Map<string, RenderedEntry>  // "copy_imgIdx" → { el, left }
  lastUpdateX: number
  pool: Map<number, HTMLImageElement>      // imgIdx → reusable <img>

  startRafLoop()
  return cleanup
}
```

> **為什麼不把 renderedMap 放 store？**
> 因為它是高頻 mutation 物件（每幀可能讀寫），放入 `$state` 會產生不必要的 proxy 開銷。
> 作為 `onMount` 閉包內的局部變數效能最佳。

### 6.3 rAF 迴圈 (`tick`)

```
tick(timestamp):
  1. dt = timestamp - playerStore.lastTime（首幀 dt = 0）
  2. 若 playing && !seeking:
       scrollX += speed * (dt / 16.667)
       若 scrollX >= stripWidth → scrollX -= stripWidth（無縫循環）
  3. applyTransform(carouselEl, scrollX)
  4. 若 scrollX 變化 > UPDATE_THRESHOLD (300px) 或 wrapped:
       updateVisibleImages(...)
  5. 更新 playerStore.currentIdx = calcCurrentIndex(...)
  6. playerStore.lastTime = timestamp
  7. playerStore.rafId = requestAnimationFrame(tick)
```

### 6.4 updateVisibleImages 虛擬化演算法

**與 old-ref 相同的 copy-based 策略：**

```
function updateVisibleImages():
  vw = window.innerWidth
  leftEdge  = scrollX - BUFFER_PX
  rightEdge = scrollX + vw + BUFFER_PX

  // 計算需要幾份 strip 的副本來覆蓋 viewport
  startCopy = floor(leftEdge / stripWidth)
  endCopy   = floor(rightEdge / stripWidth)

  needed = new Map<string, { imgIdx, left }>()
  for copy in [startCopy..endCopy]:
    for i in [0..images.length):
      imgLeft  = offsets[i] + copy * stripWidth
      imgRight = imgLeft + widths[i]
      if imgRight > leftEdge && imgLeft < rightEdge:
        needed.set(`${copy}_${i}`, { imgIdx: i, left: imgLeft })

  // 回收不需要的 → pool
  for [key, entry] of renderedMap:
    if !needed.has(key):
      imgIdx = parse(key)
      pool.set(imgIdx, entry.el)        // 保留 DOM，避免 re-decode
      renderedMap.delete(key)

  // 填充需要的
  for [key, info] of needed:
    existing = renderedMap.get(key)
    if existing:
      if existing.left !== info.left:
        existing.el.style.left = info.left + 'px'
        existing.left = info.left
      continue

    el = pool.get(info.imgIdx)           // 嘗試從 pool 復用
    if el:
      pool.delete(info.imgIdx)
    else:
      el = createElement('img')          // 新建
      el.src = committedUrl(images[info.imgIdx])
      el.draggable = false
      el.dataset.idx = String(info.imgIdx)
      el.style.width = widths[info.imgIdx] + 'px'
      carouselEl.appendChild(el)

    el.style.left = info.left + 'px'
    renderedMap.set(key, { el, left: info.left })

  // 丟棄多餘 pool 元素（避免記憶體無限增長）
  for [, el] of pool:
    el.remove()
  pool.clear()
```

### 6.5 applyTransform

```ts
carouselEl.style.transform = `translateX(${-scrollX}px)`;
```

使用 `will-change: transform` 確保 GPU 合成。

### 6.6 常數

| 常數 | 值 | 說明 |
|------|----|------|
| `MAX_IMAGES` | 200 | 最多載入圖片數 |
| `BUFFER_PX` | 2000 | 虛擬化緩衝區 |
| `UPDATE_THRESHOLD` | 300 | 超過此 px 變化才重算 visible set |
| `IDLE_TIMEOUT` | 2500 | dock 自動隱藏 ms |
| `DEBOUNCE_COUNT` | 200 | 即時計數 debounce ms |
| `DEBOUNCE_RESIZE` | 150 | resize debounce ms |

---

## 七、時間軸（進度條）響應式對齊

進度條是 Browse 最核心的交互之一。必須確保 **rAF 推進的 scrollX** 與 **slider 位置** 和 **「第 N / 共 M 張」文字** 三者始終對齊。

### 7.1 資料流向

```
                  ┌──────────────────────────────────┐
                  │        rAF tick()                 │
                  │  scrollX += speed * dt            │
                  │  scrollX %= stripWidth            │
                  └────────────┬─────────────────────┘
                               │
            ┌──────────────────▼───────────────────────┐
            │ playerStore.scrollX (authoritative)       │
            │ playerStore.currentIdx (derived in tick)  │
            └──────┬───────────────────┬───────────────┘
                   │                   │
         ┌─────────▼──────┐   ┌────────▼──────────────┐
         │  Progress bar   │   │  "N / M" text          │
         │  bind:value     │   │  $derived from          │
         │  = scrollX /    │   │  playerStore.currentIdx │
         │    stripWidth   │   │                         │
         │  * 1000         │   │                         │
         └────────┬────────┘   └─────────────────────────┘
                  │ (user drag)
         ┌────────▼────────┐
         │ seekTo(pct)     │
         │ seeking = true  │
         │ scrollX = pct * │
         │   stripWidth    │
         │ → manual DOM    │
         │   update        │
         └─────────────────┘
```

### 7.2 Slider → scrollX（seek 模式）

- `<input type="range" min=0 max=1000>` 的 `oninput` → `seekTo(value / 1000)`。
- `seekTo` 設 `seeking = true`，直接寫 `playerStore.scrollX`，然後 **手動** 呼叫 `applyTransform` + `updateVisibleImages`。
- 此時 rAF tick 仍在跑，但因 `seeking === true` 不會推進 scrollX（見 §6.3 步驟 2）。
- `onchange`（mouseup / touchend）→ `seekEnd()` 設 `seeking = false` + `lastTime = 0`。

### 7.3 scrollX → Slider（正常播放）

- **不使用 `$effect`** 監聽 scrollX。
- 在 rAF tick 內（步驟 5 之後），直接用 DOM API 設定 slider value：
  ```ts
  if (!playerStore.seeking) {
    sliderEl.value = String(Math.round((scrollX / stripWidth) * 1000));
  }
  ```
- 同一幀也更新文字：
  ```ts
  textEl.textContent = `${playerStore.currentIdx + 1} / ${playerStore.images.length}`;
  ```
- **為什麼不用 `$derived` + `bind:value`？**
  因為 `scrollX` 每幀更新 60 次/秒，若經過 Svelte reactivity 管線，會觸發大量 micro-task + DOM diff，完全無意義且有效能代價。直接 DOM 寫入是最佳路徑。

### 7.4 currentIdx 計算

- 在 rAF tick 內呼叫 `calcCurrentIndex(scrollX, stripWidth, offsets, widths)`。
- 回傳值寫入 `playerStore.currentIdx`。
- 公式：`pos = scrollX % stripWidth`，線性掃描或 binary search 找到 `offsets[i] + widths[i] > pos` 的第一個 `i`。
- 由於 images 數量上限 200，線性掃描已足夠（< 0.01ms）。

### 7.5 Resize 對齊

- Resize 時 strip 總寬度改變，但使用者感知位置（百分比）應不變。
- 流程：`pct = scrollX / oldStripWidth` → `buildLayout(newVH)` → `scrollX = pct * newStripWidth`。
- 這保證 slider 位置、currentIdx、可見圖片三者全部一致。

---

## 八、元件設計

### 8.1 +page.svelte（頂層殼）

```svelte
<svelte:head><title>Browse — Image Manager</title></svelte:head>
<svelte:window onkeydown={handleKeydown} />

{#if phaseStore.current === 'filter'}
  <BrowseFilter />
{:else}
  <BrowsePlayer />
{/if}
```

- 基於 `phaseStore.current` 做條件渲染。
- player 被 destroy 時 `onDestroy` 可做 cleanup（cancelAnimationFrame 等）。
- SSR data 透過 `untrack(() => initBrowse(data.allTags))` 傳入。

### 8.2 BrowseFilter.svelte

職責：篩選表單 + 即時計數 + 「開始瀏覽」按鈕 + 返回首頁連結。

**元素結構（對齊 old-ref）：**
```
.browse-filter          // 全版置中 flex
  .browse-filter-box    // 卡片容器 (max-width: 480px)
    h2 "水平瀏覽"
    .browse-filter-field  // 標籤篩選
      label "標籤篩選"
      TagChips / TagAutocomplete (複用共用元件)
    .browse-filter-field  // 最低評等
      label "最低評等"
      Rating (複用共用元件, click toggle 0-5)
    .browse-filter-field  // 排序
      label "排序"
      select (committedAt / rating / originalName / random)
    .browse-filter-count   // "共 N 張符合"
    button.btn.btn-primary // "開始瀏覽" (disabled when matchCount === 0)
    a.btn.btn-ghost        // "← 返回首頁" href="/"
```

**資料流：**
- 讀取 `filterStore.*` 顯示值。
- 使用者操作 → 呼叫 actions（`addTag`, `removeTag`, `setMinRating`, `setSort`）。
- `filterStore.matchCount` 變化 → `$derived` 控制按鈕 disabled。
- 「開始瀏覽」→ `startPlayer()`。

**注意：**
- **不使用** 共用 `FilterBar` 元件——old-ref 的 browse filter 是一個垂直居中的卡片表單，佈局與 scroll/editor 使用的水平 FilterBar 完全不同。Browse 需要自己的 filter UI。
- 可以複用 `TagAutocomplete` 和 `Rating` 單體元件。
- 排序選項：提交時間、評等、檔名、隨機（與 old-ref 一致）。
- **不需要 order（升冪/降冪）和 ratingOp（≥/≤/=）**——old-ref 沒有這些選項。排序 order 由 action 自動決定（`originalName` = asc，其餘 = desc）；ratingOp 固定為 `gte`。

### 8.3 BrowsePlayer.svelte

職責：全螢幕播放器 + carousel + dock。

**元素結構：**
```
.browse-player         // position:fixed; inset:0; background:#000
  .browse-carousel     // position:fixed; inset:0; will-change:transform
    (virtualised <img> elements — managed by onMount imperative code)
  .browse-dock         // position:fixed; bottom:0; 半透明列
    button#pauseBtn    // 播放/暫停 icon
    .browse-dock-progress
      input[range]     // progress slider (0-1000)
      span             // "N / M"
    .browse-dock-speed
      label "速度"
      input[range]     // speed slider (0.2-6, step 0.1)
      span             // 速度值
    button#backBtn     // "篩選" (返回 filter)
```

**生命週期：**
```
onMount():
  取得 DOM refs (carouselEl, sliderEl, textEl, speedTextEl)
  初始化 renderedMap, pool (閉包變數)
  呼叫 startRafLoop()
  綁定 click/dblclick 事件（carousel）
  綁定 mousemove（dock auto-hide）
  return () => { cancelAnimationFrame(); clearTimeout(); cleanup }
```

**Click / DblClick 處理（與 old-ref 一致）：**
- 單擊 carousel img → `togglePlay()`（含 250ms 延遲區分雙擊）。
- 雙擊 carousel img → `window.open('/editor?id=' + img.id, '_blank')`。
- 用 `setTimeout` + `clearTimeout` 區分單/雙擊（250ms 門檻）。

**Dock 自動隱藏：**
- 播放開始時 `resetIdleTimer()`。
- `mousemove` 上呼叫 `showDock()` + `resetIdleTimer()`。
- `dockStore.visible` 控制 CSS class `is-hidden`（opacity + transform 過渡）。
- CSS transition: `opacity 0.3s ease, transform 0.3s ease`。

---

## 九、樣式

### 9.1 BrowseFilter.css

- 與 old-ref `style.css` 的 filter 區段一致。
- 全版 flex 居中、卡片 `max-width: 480px`、暗色主題變數。
- Rating 和 TagAutocomplete 使用已有全域樣式。

### 9.2 BrowsePlayer.css

- `.browse-player`: `position: fixed; inset: 0; background: #000; overflow: hidden;`
- `.browse-carousel`: `position: fixed; inset: 0; height: 100vh; will-change: transform;`
- `.browse-carousel img`: `position: absolute; top: 0; height: 100vh; object-fit: contain; user-select: none;`
- `.browse-dock`: `position: fixed; bottom: 0; left: 0; right: 0;` + 半透明背景 + backdrop-filter blur。
- `.browse-dock.is-hidden`: `opacity: 0; transform: translateY(100%); pointer-events: none;`
- Range slider 自訂外觀（webkit + moz）。
- 完全沿用 old-ref 的 CSS 值。

---

## 十、完整 Action API 一覽

| Action | 讀 | 寫 | 觸發時機 |
|--------|-----|-----|----------|
| `initBrowse(allTags)` | — | filter, player, phase, dock | 頁面 mount |
| `addTag(tag)` | filterStore | filterStore | 使用者輸入 |
| `removeTag(tag)` | filterStore | filterStore | 點擊 chip × |
| `setMinRating(n)` | filterStore | filterStore | 點擊星星 |
| `setSort(s)` | filterStore | filterStore | 選擇排序 |
| `updateCount()` | filterStore | filterStore.matchCount | 自動 debounce |
| `startPlayer()` | filterStore | playerStore, phaseStore | 按鈕點擊 |
| `stopPlayer()` | playerStore | playerStore, phaseStore | 按鈕/Escape |
| `togglePlay()` | playerStore | playerStore | 按鈕/Space/Click |
| `setSpeed(v)` | — | playerStore | slider input |
| `seekTo(pct)` | playerStore | playerStore | slider input |
| `seekEnd()` | — | playerStore | slider change |
| `showDock()` | — | dockStore | mousemove |
| `resetIdleTimer()` | dockStore | dockStore | mousemove |
| `handleKeydown(e)` | phaseStore | — | svelte:window |
| `handleResize()` | playerStore | playerStore | window resize |

---

## 十一、效能保障

### 11.1 虛擬化

- 僅渲染 viewport ± 2000px 內的 `<img>`。
- 200 張圖、每張寬 ~700px → strip ~140,000px → 一般只有 ~5–10 個 img 在 DOM 中。
- DOM pool 避免 decode 開銷：同一張圖的 `<img>` 移出再移入時不需重新解碼。

### 11.2 rAF 效能

- tick 函式每幀工作量：
  - 1 次加法 + 1 次 modulo（scrollX 推進）
  - 1 次 `style.transform` 設定（GPU 合成，零 layout）
  - 條件性 `updateVisibleImages`（每 300px 一次，非每幀）
  - 1 次 sliderEl.value + 1 次 textEl.textContent
- 零 GC 壓力（不建立新物件）。

### 11.3 圖片預載

- `<img>` 在 BUFFER_PX 範圍內提前創建 → 瀏覽器自動開始下載。
- 2000px buffer ≈ 提前 2–3 張圖。
- 可考慮在 `startPlayer` 後批次 `new Image().src = ...` 預載全部，但 200 張並行可能衝擊網路。建議保持 buffer 即可。

### 11.4 記憶體

- 最多 200 張 ImageWithId 物件（輕量）。
- DOM 池上限 ≈ 同一時刻 viewport 寬度 / 最小圖寬 + buffer 額外 ≈ 15–20 個 `<img>`。
- 池回收時 `pool.clear()` 刪除多餘元素。

---

## 十二、與 Tagger 模式的對比

| 面向 | Tagger | Browse |
|------|--------|--------|
| store 檔案 | `stores.svelte.ts`（6 class） | `stores.svelte.ts`（4 class） |
| actions 檔案 | `actions.ts`（唯一 mutator） | `actions.ts`（唯一 mutator） |
| helpers 檔案 | `helpers.ts`（純函式） | `helpers.ts`（純函式） |
| SSR 預載 | stagedFiles + allTags | allTags only |
| 初始化 | `initTagger(files, tags)` | `initBrowse(allTags)` |
| 複雜度核心 | 多選 + 批次 commit | rAF + 虛擬化 + 無限循環 |
| DOM 操作 | 全部 Svelte reactivity | 播放器脫離 reactivity（onMount 手動） |
| 清理 | — | `onDestroy` cancel rAF + clear pools |

---

## 十三、實作順序建議

1. **stores.svelte.ts** — 定義 4 個 store class。
2. **helpers.ts** — `buildLayout`, `calcCurrentIndex`, `shuffleArray`, `committedUrl`。
3. **actions.ts** — 所有 action functions（先寫 filter 相關，再寫 player 相關）。
4. **+page.server.ts** — SSR 預載 allTags。
5. **BrowseFilter.svelte + BrowseFilter.css** — 篩選畫面（可獨立測試）。
6. **BrowsePlayer.svelte + BrowsePlayer.css** — 播放畫面（先 static render → 再加 rAF → 再加虛擬化 → 再加 dock）。
7. **+page.svelte** — 殼 + 初始化 + 鍵盤 + resize。
8. **測試與收尾** — 對照 plan4 §十 驗證清單逐項驗收。

---

## 十四、驗證清單（摘自 plan4 §十，展開細節）

| # | 項目 | 驗證方式 |
|---|------|----------|
| 1 | Filter 即時計數正確 | 切換 tag / rating / sort，觀察數字變化 |
| 2 | 0 張時按鈕停用 | 設定不可能的 filter，確認按鈕 disabled |
| 3 | 1000+ 張流暢 | 修改 MAX_IMAGES 為 1000，開 DevTools Performance 記錄，確認 FPS ≥ 55 |
| 4 | 無限循環無跳躍 | 整條 strip 播完一輪後觀察過渡，不能有閃爍或跳躍 |
| 5 | 速度控制 | speed slider 最左 (0.2) 到最右 (6.0)，即時生效 |
| 6 | 進度控制 | 拖曳 progress slider，畫面跟隨跳轉；放手後恢復播放 |
| 7 | Dock 自動隱藏 | 靜止 2.5s 後淡出，移動滑鼠淡入 |
| 8 | 單擊暫停 | 點擊圖片，播放暫停；再點，恢復 |
| 9 | 雙擊開 Editor | 雙擊圖片，新分頁開啟 `/editor?id=...` |
| 10 | Escape 返回篩選 | 播放中按 Escape，回到篩選畫面 |
| 11 | Space 暫停/播放 | 播放中按 Space，切換暫停/播放 |
| 12 | Resize 佈局正確 | 播放中拉動視窗，strip 重算且位置百分比不變 |
