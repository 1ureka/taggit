# Masonry 瀑布流佈局系統

此資料夾包含 Scroll 路由的瀑布流佈局與虛擬化模組。

## 模組一覽

| 檔案                    | 說明                                             |
| ----------------------- | ------------------------------------------------ |
| `masonry-layout.ts`     | 純函式佈局計算（權重式多欄分配）與二分搜尋虛擬化 |
| `virtualizer.svelte.ts` | Svelte 5 響應式虛擬化器（自動追蹤佈局與捲動）    |
| `raf-aggregator.ts`     | RAF 事件聚合器（節流高頻事件）                   |

## 原理

### 權重式佈局（`createWeightBasedLayout`）

將每張圖片的「權重高度」定義為 `height / width`（假設欄寬為單位 1）。
以貪婪演算法逐一將項目放入目前最短的欄位，達成高度平衡的瀑布流分配。

回傳的 `Layout` 結構為多條軌道（tracks），每條軌道內的項目記錄了權重座標 `yStart` / `yEnd`。

### 虛擬化（`getVirtualizedItems`）

根據容器寬度計算權重座標 → 像素的換算係數 `k = containerWidth / columns`。
對每條軌道以**二分搜尋**找到第一個可見項目，再線性向後遍歷至視窗底端，
僅回傳視窗範圍內的項目及其像素座標（`pixelX`、`pixelY`、`pixelW`、`pixelH`）。

### 響應式虛擬化器（`createVirtualizer`）

Svelte 5 工廠函數，內部以 `$effect` 自動追蹤佈局變化並監聽 scroll / resize 事件。
高頻事件透過 `RAFAggregator`（預設 20 FPS）降頻處理，空閒 500ms 後自動停止 RAF 循環。

## 用法

```ts
// scrollMasonry.svelte.ts
import { createWeightBasedLayout } from "./masonry/masonry-layout.js";
import { createVirtualizer } from "./masonry/virtualizer.svelte.js";

const layout = $derived(createWeightBasedLayout(ctx.items, ctx.columns));

const virtualizer = createVirtualizer(
  () => layout,
  () => containerEl,
  () => ctx.pageContentEl,
);

// virtualizer.visibleItems — 當前可見項目（含像素座標）
// virtualizer.totalHeight  — 瀑布流容器總高度（px）
```
