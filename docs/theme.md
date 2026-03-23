# Theme System — Image Manager

> 本文件記錄當前主題系統的架構、設計決策與遷移方向，供未來 AI Agent 或開發者快速掌握。

---

## 1. 目前架構

### 1.1 單一深色主題

專案目前只有一套深色主題，所有色彩透過 CSS custom properties（自訂屬性）在 `:root` 中定義。

### 1.2 檔案結構

| 檔案                             | 職責                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `src/lib/styles/app.css`         | 入口：引入字體 + `app-basic.css` + CSS reset + `:root` 變數 + 全域基礎樣式              |
| `src/lib/styles/app-basic.css`   | 全域可複用的 UI 原子：`.chip`, `.text-input`, `.modal`, `.kbd`, `.separator` 等 |
| `src/lib/styles/app-button.css`   | 全域按鈕樣式：`.btn-primary`, `.btn-ghost`, `.btn-outlined`, `.btn-destructive`, `.btn-icon`；修飾符 `.btn-sm`, `.pending` |
| 各 `.svelte` 檔案 `<style>` 區塊 | 元件級 scoped 樣式（包含 Toast、Rating 等）                                             |

### 1.3 CSS 變數一覽

```css
:root {
  /* 背景層級 */
  --bg: #0a0a0a; /* 最底層背景 */
  --bg-card: #111111; /* 卡片 / 面板 */
  --bg-hover: #1a1a1a; /* 懸停高亮 */
  --bg-active: #222222; /* 激活 / 按下 */

  /* 邊框 */
  --border: #222222;
  --border-hover: #333333;

  /* 文字 */
  --text: #fafafa; /* 主要文字 */
  --text-muted: #a1a1aa; /* 次要文字 */
  --text-dim: #71717a; /* 最弱文字、提示 */

  /* 功能色 */
  --accent: #ffffff; /* 強調 / 主按鈕 */
  --destructive: #ef4444; /* 危險操作 */
  --color-info: #3b82f6; /* 資訊提示 */
  --color-warning: #eab308; /* 警告 */
  --color-success: #22c55e; /* 成功 */

  /* 其他 */
  --ring: #d4d4d8; /* focus ring */
  --radius: 6px; /* 統一圓角 */
  --font: "Inter", "Noto Sans TC", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

### 1.4 命名慣例

- `--bg-*`：背景由淺→深（從使用者角度的「層級」概念）
- `--text` / `--text-muted` / `--text-dim`：文字亮度遞減
- `--color-*`：語意功能色

### 1.5 反轉配色慣例（Inverted Token）

本專案只有深色模式。當 UI 區塊需要「反轉」配色（如淺底深字的浮動 dock）時，直接對調現有 token，不另建 `--light-*` 變數：

| 需求       | 做法                                                     |
| ---------- | -------------------------------------------------------- |
| 淺色底板   | `background: var(--text)`                                |
| 深色文字   | `color: var(--bg)`                                       |
| 次要文字   | `color: color-mix(in oklch, var(--bg) 65%, var(--text))` |
| 半透明暗色 | `hsl(from var(--bg) h s l / <alpha>)`                    |

---

## 2. 現代 CSS 主題實踐（務必遵循）

### 2.1 使用相對色彩語法（Relative Color Syntax）

現代瀏覽器已支援 [CSS Relative Color Syntax](https://developer.chrome.com/blog/css-relative-color-syntax)，可以從一個基礎色動態產生 tint / shade / 透明度變體，不再需要預定義大量變數。

**語法**：

```css
/* 從 var(--accent) 產生 30% 透明度版本 */
background: hsl(from var(--accent) h s l / 0.3);

/* 降低飽和度 */
color: hsl(from var(--destructive) h calc(s * 0.5) l);

/* 提亮 */
border-color: hsl(from var(--border) h s calc(l + 15));
```

**好處**：

- 一個語意色可衍生出 hover、active、disabled 等狀態色
- 減少 CSS 變數數量
- 只需維護一套深色基礎色即可衍生所有變體

**注意**：需要基礎色本身使用 CSS 支援的格式（hex、rgb、hsl 皆可），瀏覽器會自動解析。

### 2.2 使用 `color-mix()` 作為替代方案

若需要更廣泛的瀏覽器支援，`color-mix()` 也是很好的選擇：

```css
/* 混和白色產生 hover 效果 */
background: color-mix(in srgb, var(--bg-card) 85%, white);

/* 混和黑色產生 pressed 效果 */
background: color-mix(in srgb, var(--accent) 80%, black);
```

### 2.3 強制深色模式

本專案僅支援深色主題，不打算支援淺色模式。在 `:root` 中應明確宣告：

```css
:root {
  color-scheme: dark;
  /* 所有變數皆為深色值 */
}
```

`color-scheme: dark` 告知瀏覽器使用深色系的原生控制項（scrollbar、form elements 等），確保視覺一致。

### 2.4 元件 Scoped 變數 + 外部覆寫

此專案已在 Rating 元件上開始實踐。模式為：

```svelte
<!-- Component.svelte -->
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

---

## 3. 元件結構式選擇器（Scoped Structural Selectors）

Svelte 的 `<style>` 預設為 **scoped**——同一個 class name 出現在不同元件中完全不衝突。本專案利用此特性，以**結構角色**而非業務語意命名 CSS 選擇器，降低命名負擔、減少程式碼量，並讓開發者在撰寫樣式時以「抽象 UI 元件」的角度思考，而非糾結於具體業務名稱。

### 3.1 語意 HTML 優先

若元素本身的 HTML 標籤已足夠描述結構角色，**直接以元素選擇器選取，不額外加 class**：

```svelte
<!-- EditorMetadata.svelte -->
<dl>
  <dt>ID</dt>
  <dd class="mono">{image.id}</dd>

  <dt>解析度</dt>
  <dd>{image.width} × {image.height}</dd>
</dl>

<style>
  dl {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 0.75rem;
    font-size: 0.75rem;
  }

  dt {
    color: var(--text-dim);
  }

  dd {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
```

適用場景：`main`、`aside`、`footer`、`header`、`dl`/`dt`/`dd`、`ul`/`li`、`h1`–`h6`、`p`、`label` 等。在 scoped 環境下，元素選擇器的作用域被限定在元件內部，不會汙染外部。

### 3.2 抽象結構命名

當語意 HTML 不足以區分角色時，使用描述**結構功能**的 class name，而非帶有業務語意的名稱：

| ✓ 結構式                          | ✗ 業務式                                 |
| --------------------------------- | ---------------------------------------- |
| `.card`                           | `.compare-card`                          |
| `.card-image`                     | `.compare-card-image`                    |
| `.field-name`                     | `.editor-name-field`                     |
| `.actions`                        | `.editor-buttons`                        |
| `.tags`                           | `.image-tag-list`                        |
| `.empty`                          | `.no-images-message`                     |

因為 Svelte scope 已隔離命名空間，`.card` 在 `CompareCard.svelte` 和 `HomeCards.svelte` 中互不干擾，省去 BEM 式的前綴或命名空間。

常見的抽象命名模式：

- **佈局容器**：`.page`、`.content`、`.panel`、`.wrapper`
- **卡片結構**：`.card`、`.card-image`、`.card-info`、`.card-header`
- **表單結構**：`.field-*`（`.field-name`、`.field-rating`、`.field-tags`）、`.actions`
- **狀態標記**：`.loading`、`.empty`、`.active`、`.selected`、`.error`
- **文字樣式**：`.mono`、`.label`、`.hint`

### 3.3 Nested CSS 描述層級

善用 CSS nesting（`&`）在父選擇器內描述子元素樣式，減少頂層選擇器數量，同時讓結構關係一目了然：

```svelte
<style>
  .card {
    display: flex;
    flex-direction: column;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 2);
    overflow: hidden;

    &:hover {
      border-color: var(--border-hover);
      box-shadow: 0 0 0 1px var(--border-hover);
    }
  }

  .card-image {
    flex: 1;
    min-height: 0;
    background: var(--bg);

    & img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  }
</style>
```

**使用時機**：

- `&:hover`、`&:focus`、`&.active` 等偽類或狀態 class → 永遠用 nesting
- `& img`、`& span` 等元素子選擇器 → 當該元素在父層下唯一或語意明確時使用
- 不要為了 nesting 而強行嵌套無關的選擇器——若子元素自身具有獨立的結構角色，仍應提升為頂層 class

### 3.4 與全域原子 class 的分工

`app-basic.css` 中定義的全域原子 class（`.chip`、`.text-input`、`.separator` 等）以及 `app-button.css` 中的按鈕 class（`.btn-primary`、`.btn-ghost` 等）負責**跨元件複用的基礎 UI 單元**，在 template 中直接套用即可。元件的 scoped `<style>` 只負責佈局與組合——兩者互補，不重疊：

```svelte
<!-- 全域 class 控制基礎外觀，scoped style 控制佈局位置 -->
<div class="actions">
  <button class="btn-primary btn-sm">儲存</button>
  <button class="btn-destructive btn-sm">刪除</button>
</div>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;

    & > :global(button) {
      flex: 1;
      min-width: 0;
    }
  }
</style>
```

### 3.5 要點整理

1. **能用語意 HTML 就不加 class**——`main`、`footer`、`dl`、`aside` 等在 scoped 環境下已是精確選擇器
2. **class name 描述結構角色**——想像這是一個抽象 UI 元件而非特定業務頁面
3. **善用 nesting 表示層級**——偽類、狀態 class、子元素選擇器收在父層內
4. **全域原子不重造**——`app-basic.css`、`app-button.css` 已有的直接用，scoped style 只管佈局
5. **不需要 BEM / 命名空間前綴**——Svelte scope 天然隔離

---

## 4. Button System

> 定義於 `src/lib/styles/app-button.css`，所有按鈕變體皆為獨立 class，不需要基礎 `.btn` class。

### 4.1 變體

| Class              | 用途           | 外觀                                       |
| ------------------ | -------------- | ------------------------------------------ |
| `.btn-primary`     | 主要操作       | 白底深字，`var(--accent)` 背景             |
| `.btn-outlined`    | 一般操作       | `var(--bg-card)` 背景 + `var(--border)` 邊框 |
| `.btn-ghost`       | 輔助 / 返回    | 透明背景、無邊框                            |
| `.btn-destructive` | 危險操作       | 紅色文字 + 紅色半透明背景                    |
| `.btn-icon`        | 僅圖示         | 無邊框、等寬 padding                        |

### 4.2 修飾符

| Class      | 說明                                     |
| ---------- | ---------------------------------------- |
| `.btn-sm`  | 小尺寸（`padding: 0.25rem 0.625rem`）    |
| `.pending` | 載入中：降低透明度 + 旋轉圓圈動畫         |

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
