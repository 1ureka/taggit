# `use-zoom-pan.svelte.ts` 規範化分析

## 現狀問題

| 問題 | 現狀 | 規範要求 |
|------|------|----------|
| 結構 | `export function useZoomPan()` 工廠函數 | `export class ZoomPan` |
| Handler 命名 | `onWheel`, `onMousedown`, `onWindowMousemove`, `onWindowMouseup` | `handle` + 目標元素 + 事件（`handleContainerWheel`, …） |
| `$state` 位置 | `let` 宣告在函數體內 | class field |
| `$derived` | 在 return 物件的 getter 內計算 | class field 宣告，constructor 內賦值 |
| 私有拖曳追蹤變數 | `let dragStartX` 等普通 `let` | `#dragStartX` 等 private class field |
| `reset()` 暴露方式 | return 物件的普通 function 屬性 | public method（class method，無需 arrow，因非 handler） |
| 檔案位置 | `src/lib/client/`（客戶端工具集） | `src/lib/ui/`（共用無頭 UI） |
| 檔案名稱 | `use-zoom-pan.svelte.ts`（React hook 命名慣例） | `zoom-pan.svelte.ts`（對應 class 名稱） |

---

## 目標設計

### `src/lib/ui/zoom-pan.svelte.ts`

```ts
/**
 * ZoomPan 的配置選項
 */
type ZoomPanOptions = {
  /** 最小縮放比例，預設 0.2 */
  minScale?: number;
  /** 最大縮放比例，預設 10 */
  maxScale?: number;
};

/**
 * 圖片縮放平移的無頭 UI
 */
export class ZoomPan {
  /** 目前縮放比例 */
  scale = $state(1);
  /** X 軸位移 */
  panX = $state(0);
  /** Y 軸位移 */
  panY = $state(0);
  /** 是否正在拖曳 */
  isDragging = $state(false);
  /** 目前的 CSS transform 字串 */
  transform: string;

  #minScale: number;
  #maxScale: number;
  #dragStartX = 0;
  #dragStartY = 0;
  #dragStartPanX = 0;
  #dragStartPanY = 0;

  constructor(options?: ZoomPanOptions) {
    this.#minScale = options?.minScale ?? 0.2;
    this.#maxScale = options?.maxScale ?? 10;
    this.transform = $derived(
      `translate(${this.panX}px,${this.panY}px) scale(${this.scale})`
    );
  }

  // ---

  /** 重置縮放與位移至初始狀態 */
  reset() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
  }

  // ---

  /** 處理容器滾輪事件，執行縮放 */
  handleContainerWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    this.scale = Math.max(
      this.#minScale,
      Math.min(this.#maxScale, this.scale + delta * this.scale)
    );
  };

  /** 處理容器滑鼠按下事件，開始拖曳 */
  handleContainerMousedown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    this.isDragging = true;
    this.#dragStartX = e.clientX;
    this.#dragStartY = e.clientY;
    this.#dragStartPanX = this.panX;
    this.#dragStartPanY = this.panY;
  };

  /** 處理容器重置事件，重置縮放與位移 */
  handleContainerReset = () => {
    this.reset();
  };

  // ---

  /** 處理 Window 滑鼠移動事件，更新拖曳位置 */
  handleWindowMousemove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    this.panX = this.#dragStartPanX + (e.clientX - this.#dragStartX);
    this.panY = this.#dragStartPanY + (e.clientY - this.#dragStartY);
  };

  /** 處理 Window 滑鼠放開事件，結束拖曳 */
  handleWindowMouseup = () => {
    this.isDragging = false;
  };
}
```

### 重點說明

**`handleContainerReset` 而非 `handleContainerDblclick`**

ZoomPan 是純粹的縮放平移機制，不應對「何種互動觸發重置」有意見——那是呼叫方的策略。`handleContainerDblclick` 把策略（雙擊 = 重置）硬編進機制層，違反了機制與策略分離原則（規範 §3.5）。

改為 `handleContainerReset`：ZoomPan 只宣告「這是一個重置動作的 handler」，呼叫方自行決定要綁到 `ondblclick` 或其他事件——ZoomPan 不在乎。名稱雖然不對應特定 DOM 事件，但語意明確，說得通。

**`#minScale`、`#maxScale` 不用 options getter**

它們是建構時一次性設定的常數，不是響應式 prop，不需要 getter 形式。

**`$derived` 宣告位置**

`transform: string` 型別宣告在 field 區、賦值在 constructor 內（符合規範 §2.2）。

---

## 組合使用模式

`ZoomPan` 與其他業務邏輯 class 在 `.svelte` 的 `<script>` 中**各自獨立實例化**，不互相包含——就像 `AutocompleteCompact.svelte` 同時 `new Autocomplete()` 和 `new Menu()` 一樣。ZoomPan 相關的 handlers 和狀態直接從 `zp.*` 讀取，業務邏輯從 `ui.*` 讀取：

```svelte
<!-- TaggerPreview.svelte（改寫後示意） -->
<script lang="ts">
  import { ZoomPan } from "$lib/ui/zoom-pan.svelte.js";
  import { TaggerPreview } from "./taggerPreview.svelte.js";

  // ... props ...

  const zp = new ZoomPan();
  const ui = new TaggerPreview({
    get currentFile() { return currentFile; },
    get imageLoading() { return imageLoading; },
    set imageLoading(v) { imageLoading = v; },
    onChangeImage: () => zp.reset(),  // ← bridge：圖片切換時重置縮放
  });
</script>

<svelte:window onmousemove={zp.handleWindowMousemove} onmouseup={zp.handleWindowMouseup} />

<div
  class:dragging={zp.isDragging}
  onwheel={zp.handleContainerWheel}
  onmousedown={zp.handleContainerMousedown}
  ondblclick={zp.handleContainerReset}
>
  <img style="transform:{zp.transform}" onload={ui.handleImageLoad} ... />
</div>
```

### 「圖片切換時重置」——`onChangeImage`

圖片切換時要不要重置縮放，是呼叫方的策略，不屬於 ZoomPan。

以 `TaggerPreview` 為例：options 加一個 `onChangeImage` callback，在偵測到 `currentFile` 變更時呼叫它。`.svelte` 傳入 `() => zp.reset()`——業務邏輯（觸發時機）在 `TaggerPreview` 裡，縮放重置的執行在 `.svelte` 的 bridge 裡，ZoomPan 完全不感知圖片。

---

## 受影響的檔案

| 檔案 | 變更類型 |
|------|----------|
| `src/lib/client/use-zoom-pan.svelte.ts` | **刪除**，遷移至下方新檔 |
| `src/lib/ui/zoom-pan.svelte.ts` | **新建**（`export class ZoomPan`） |
