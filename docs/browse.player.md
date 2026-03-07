# 重構計畫 — `/browse/player`（播放器）

> 參考規範：[components.md](./components.md)、[context.md](./context.md)

---

## 一、現況分析

### 檔案結構

```
src/routes/browse/player/
├── +page.server.ts   ← SSR：parseQueryParams → queryImages（上限 200）
├── +page.svelte      ← 播放器全部邏輯（~300 行 onMount 閉包 + 模板）
└── page.css          ← 播放器樣式
```

共 **3 個檔案**。

### 合規程度

| 規範 | 狀態 | 說明 |
|------|------|------|
| `+page.svelte` 只做組裝 | ❌ 不合規 | 包含完整播放器邏輯（~300 行 onMount 閉包） |
| 子元件拆分 | ❌ 不合規 | 無子元件，所有 UI 直接在頁面中 |
| 無頭 UI 工廠函數 | ❌ 不合規 | 無 `.svelte.ts` |
| 樣式組織 | ⚠️ | 使用獨立 `.css` 檔案，與規範「不推薦」衝突 |

### 特殊設計決策

根據 plan6.md，Player **刻意繞過 Svelte 響應式系統**：
- 所有高頻狀態（scrollX, offsets, widths 等）為 `onMount` 閉包中的普通 `let` 變數
- 僅 3 個 Svelte `$state`（dockVisible, playing, speedDisplay）用於低頻 UI 切換
- 直接 DOM 操作進行虛擬化（createElement、appendChild、style.left）
- rAF loop 中不觸發任何 Svelte re-render

此設計是**效能驅動**的正確決策，不應為了符合規範而強行改回 Svelte 響應式。

---

## 二、重構方向

### 2.1 核心原則

保留 `onMount` 閉包的命令式架構，但將其從 `+page.svelte` 中抽出。

### 2.2 拆分策略

由於 Player 的核心邏輯是命令式 DOM 操作 + rAF loop，不適合用標準的 `createXxx` 無頭 UI 模式。替代方案：

1. **抽成子元件** `BrowsePlayer.svelte`，搬入全部 onMount 邏輯與模板。
2. **輔助模組** `browsePlayer.ts`（非 `.svelte.ts`），抽出可獨立測試的純函式（buildLayout、updateVisibleImages 的核心計算部分）。
3. **`page.css` 遷入元件 `<style>`**，消除獨立 CSS。

---

## 三、目標檔案結構

```
src/routes/browse/player/
├── +page.server.ts         ← 不變
├── +page.svelte            ← 僅接收 data，渲染 <BrowsePlayer>
├── BrowsePlayer.svelte     ← 新增：播放器全部 UI（模板 + onMount + style）
└── browsePlayer.ts         ← 新增：純函式（buildLayout 計算、URL 建構等）
```

---

## 四、各檔案職責

### 4.1 `+page.svelte`

```svelte
<script lang="ts">
  import type { PageData } from "./$types.js";
  import BrowsePlayer from "./BrowsePlayer.svelte";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Browse Player — Image Manager</title>
</svelte:head>

<BrowsePlayer images={data.images} total={data.total} />
```

### 4.2 `BrowsePlayer.svelte`

接收 `images` 與 `total` props，搬入原 `+page.svelte` 的：
- 全部 `onMount` 閉包
- DOM refs (`bind:this`)
- 3 個 `$state`（dockVisible, playing, speedDisplay）
- 全部 HTML 模板
- `page.css` 的樣式遷入 `<style>` 區塊

### 4.3 `browsePlayer.ts`

抽出可純函式化的邏輯：

```ts
import type { ImageWithId } from "$lib/types.js";

/** 建構 committed 圖片 URL */
export function committedUrl(img: ImageWithId): string {
  return `/img/committed/${img.id}${img.ext}`;
}

/** 計算每張圖的偏移量與寬度 */
export function computeLayout(images: ImageWithId[], viewportHeight: number) {
  const offsets: number[] = [];
  const widths: number[] = [];
  let x = 0;

  for (const img of images) {
    const ratio = img.width > 0 && img.height > 0 ? img.width / img.height : 1;
    const w = Math.round(viewportHeight * ratio);
    offsets.push(x);
    widths.push(w);
    x += w;
  }

  return { offsets, widths, stripWidth: x };
}

/** 由 scrollX 計算當前圖片索引 */
export function getCurrentIndex(
  scrollX: number,
  stripWidth: number,
  offsets: number[],
  widths: number[],
  count: number,
): number {
  const pos = ((scrollX % stripWidth) + stripWidth) % stripWidth;
  for (let i = 0; i < count; i++) {
    if (offsets[i] + widths[i] > pos) return i;
  }
  return count - 1;
}
```

---

## 五、關於 page.css 遷移

目前 `page.css` 是獨立 CSS 檔案，透過 `@import "./page.css"` 引入。

**遷移方案**：將其內容搬入 `BrowsePlayer.svelte` 的 `<style>` 區塊。由於 Player 是全屏元件且使用 `position: fixed`，scoped 樣式不會有作用域問題。

部分 CSS（如 `.browse-carousel img`）需改為子元素選擇器或以 `:global()` 包裝（因為 img 是命令式 createElement 產生的，不帶 Svelte scoped class）。

---

## 六、注意事項

- **不要將 onMount 閉包改為 Svelte 響應式**，這是 plan6 驗證過的效能決策。
- `+page.server.ts` 不需修改。
- 刪除 `page.css` 後確認無其他 import 引用。
