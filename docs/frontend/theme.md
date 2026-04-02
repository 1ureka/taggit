# Theme System

> 本文件記錄當前主題系統的架構、設計決策與慣例。

---

## 1. 目前架構

### 1.1 單一深色主題

專案目前只有一套深色主題，所有色彩透過 CSS custom properties（自訂屬性）在 `:root` 中定義。

### 1.2 檔案結構

| 檔案                             | 職責                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/lib/styles/app.css`         | 引入字體、其他 CSS 檔案 + `:root` 變數 + 全域覆蓋等                                         |
| `src/lib/styles/app-basic.css`   | 全域可複用的 UI 原子 `.chip`, `.text-input`, `.kbd`, `.separator` 等                        |
| `src/lib/styles/app-button.css`  | 全域按鈕樣式 `.btn-primary`, `.btn-ghost`, `.btn-outlined`, `.btn-destructive`, `.btn-icon` |
| `src/lib/styles/app-button.css`  | 修飾符 `.btn-sm`, `.pending`                                                                |
| 各 `.svelte` 檔案 `<style>` 區塊 | 元件級 scoped 樣式（包含 Toast、Rating 等）                                                 |

→ 全域原子 class 的完整列表與用法詳見 [css.md](./css.md)

### 1.3 CSS 變數一覽

```css
:root {
  /* 背景層級 */
  --bg: #0a0a0a;           /* 最底層背景 */
  --bg-card: #111111;       /* 卡片 / 面板 */
  --bg-hover: #1a1a1a;      /* 懸停高亮 */
  --bg-active: #222222;     /* 啟用 / 按下 */

  /* 邊框 */
  --border: #222222;
  --border-hover: #333333;
  --border-style: 2px solid var(--border);  /* 複合 shorthand */

  /* 文字 */
  --text: #fafafa;           /* 主要文字 */
  --text-muted: #a1a1aa;     /* 次要文字 */
  --text-dim: #71717a;       /* 最弱文字、提示 */

  /* 功能色 */
  --accent: #ffffff;         /* 強調 / 主按鈕 */
  --destructive: #ef4444;    /* 危險操作 */
  --color-info: #3b82f6;     /* 資訊提示 */
  --color-warning: #eab308;  /* 警告 */
  --color-success: #22c55e;  /* 成功 */

  /* 其他 */
  --ring: #d4d4d8;           /* focus ring */
  --radius: 6px;             /* 統一圓角 */
  --font: "Comfortaa", "Chiron GoRound TC", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
  --font-size-caption: 0.75rem;  /* 12px，小型標註文字 */
  --z-modal: 20;
  --z-popover: 25;
  --z-toast: 30;
}
```

### 1.4 命名慣例

- `--bg-*`：背景由淺→深（從使用者角度的「層級」概念）
- `--text` / `--text-muted` / `--text-dim`：文字亮度遞減
- `--color-*`：語意功能色
- `--z-*`：z-index 階層（modal < popover < toast）

### 1.5 反轉配色慣例（Inverted Token）

本專案只有深色模式。當 UI 區塊需要「反轉」配色（如淺底深字的浮動 dock）時，直接對調現有 token，不另建 `--light-*` 變數：

| 需求       | 做法                                                     |
| ---------- | -------------------------------------------------------- |
| 淺色底板   | `background: var(--text)`                                |
| 深色文字   | `color: var(--bg)`                                       |
| 次要文字   | `color: color-mix(in oklch, var(--bg) 65%, var(--text))` |
| 半透明暗色 | `hsl(from var(--bg) h s l / <alpha>)`                    |

---

## 2. 現代 CSS 色彩實踐

### 2.1 使用相對色彩語法（Relative Color Syntax）

現代瀏覽器已支援 CSS Relative Color Syntax，可以從一個基礎色動態產生 tint / shade / 透明度變體，不需要預定義大量變數。

```css
/* 從 var(--accent) 產生 30% 透明度版本 */
background: hsl(from var(--accent) h s l / 0.3);

/* 降低飽和度 */
color: hsl(from var(--destructive) h calc(s * 0.5) l);

/* 提亮 */
border-color: hsl(from var(--border) h s calc(l + 15));
```

本專案大量使用此語法：

- 按鈕 hover 狀態（`hsl(from var(--accent) h s calc(l - 25))`）
- 危險按鈕的半透明背景（`hsl(from var(--destructive) h s l / 0.1)`）
- Focus ring 的半透明色（`hsl(from var(--ring) h s l / 0.2)`）
- Alert 組件的型別背景（`hsl(from var(--color-info) h s l / 0.08)`）

### 2.2 使用 `color-mix()` 作為替代方案

若需要兩色混合的情境，可使用 `color-mix()`：

```css
/* 混和白色產生 hover 效果 */
background: color-mix(in srgb, var(--bg-card) 85%, white);

/* 混和黑色產生 pressed 效果 */
background: color-mix(in srgb, var(--accent) 80%, black);
```

### 2.3 強制深色模式

本專案僅支援深色主題，在 `:root` 中明確宣告：

```css
:root {
  color-scheme: dark;
}
```

`color-scheme: dark` 告知瀏覽器使用深色系的原生控制項（scrollbar、form elements 等），確保視覺一致。

### 2.4 元件 Scoped 變數 + 外部覆寫

組件可以暴露 CSS custom properties 供外部覆寫：

```svelte
<style>
  .root {
    color: var(--component-color, var(--text));
  }
</style>
```

外部透過容器或 `style` prop 覆寫：

```svelte
<div style="--component-color: red">
  <Component />
</div>
```

元件內部的私有 CSS 變數使用 `--_` 前綴（底線），與公開的覆寫點區隔。

---

## 3. 元件結構式選擇器

→ 選擇器策略的完整說明已移至 [css.md](./css.md)，以下為摘要。

- **能用語意 HTML 就不加 class**——`main`、`footer`、`dl`、`aside` 等在 scoped 環境下已是精確選擇器
- **class name 描述結構角色**——想像這是一個抽象 UI 元件而非特定業務頁面
- **使用直接子代選擇器 `>`**——避免模糊後代選擇器，最大化 Svelte 靜態分析
- **善用 nesting 表示層級**——偽類、狀態 class、子元素選擇器收在父層內
- **全域原子不重造**——`app-basic.css`、`app-button.css` 已有的直接用
- **不需要 BEM / 命名空間前綴**——Svelte scope 天然隔離

---

## 4. Button System

> 定義於 `src/lib/styles/app-button.css`，所有按鈕變體皆為獨立 class，不需要基礎 `.btn` class。

### 4.1 變體

| Class              | 用途        | 外觀                                         |
| ------------------ | ----------- | -------------------------------------------- |
| `.btn-primary`     | 主要操作    | 白底深字，`var(--accent)` 背景               |
| `.btn-outlined`    | 一般操作    | `var(--bg-card)` 背景 + `var(--border)` 邊框 |
| `.btn-ghost`       | 輔助 / 返回 | 透明背景、無邊框                             |
| `.btn-destructive` | 危險操作    | 紅色文字 + 紅色半透明背景                    |
| `.btn-icon`        | 僅圖示      | 無邊框、等寬 padding                         |

### 4.2 修飾符

| Class      | 說明                                  |
| ---------- | ------------------------------------- |
| `.btn-sm`  | 小尺寸（`padding: 0.25rem 0.625rem`） |
| `.pending` | 載入中：降低透明度 + 旋轉圓圈動畫     |

### 4.3 用法範例

```svelte
<a href="/" class="btn-ghost btn-sm">
  <IconArrowLeft size={16} />
  <span>返回</span>
</a>
<button class="btn-icon">
  <IconRefresh size={14} />
</button>

<!-- pending 狀態：按鈕內建旋轉載入圓圈 -->
<button class="btn-primary" class:pending={loading} onclick={handleSubmit} disabled={loading}>
  <span>提交</span>
</button>
```

### 4.4 注意事項

- 變體 class 本身已包含所有基礎樣式（display、padding、border-radius、transition 等），不需額外加 `.btn`。
- `.pending` 狀態透過 `& > * { visibility: hidden }` 隱藏子元素，因此**按鈕內的文字必須包在 `<span>`（或其他元素）中**。
- `:disabled` 時自動降低透明度並停用互動。

---

## 5. Icon System — Svelte5 + Tabler Icons

> 本專案使用 [`@tabler/icons-svelte`](https://github.com/tabler/tabler-icons) 作為圖示庫。

### 5.1 基本用法

每個圖示為獨立的 Svelte 元件，按需 import 即可，不會打包未使用的圖示。

```svelte
<script lang="ts">
  import { IconHeart, IconArrowLeft, IconPlayerPlay } from '@tabler/icons-svelte';
</script>

<IconHeart />
<IconArrowLeft />
<IconPlayerPlay />
```

### 5.2 Props

| 屬性     | 型別     | 預設值         | 說明                       |
| -------- | -------- | -------------- | -------------------------- |
| `size`   | `number` | `24`           | 圖示尺寸（px）             |
| `color`  | `string` | `currentColor` | 圖示顏色，預設繼承文字顏色 |
| `stroke` | `number` | `2`            | 線條粗細                   |
| `class`  | `string` | —              | 自訂 CSS class             |

```svelte
<IconHeart size={48} stroke={1} color="red" />
```

### 5.3 尋找圖示

前往 [tabler.io/icons](https://tabler.io/icons) 搜尋所需圖示名稱，再轉換為 PascalCase 即為 import 名稱。
