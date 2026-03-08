# Theme System — Image Manager

> 本文件記錄當前主題系統的架構、設計決策與遷移方向，供未來 AI Agent 或開發者快速掌握。

---

## 1. 目前架構

### 1.1 單一深色主題

專案目前只有一套深色主題，所有色彩透過 CSS custom properties（自訂屬性）在 `:root` 中定義。

### 1.2 檔案結構

| 檔案 | 職責 |
|---|---|
| `src/lib/styles/app.css` | 入口：引入字體 + `app-basic.css` + CSS reset + `:root` 變數 + 全域基礎樣式 |
| `src/lib/styles/app-basic.css` | 全域可複用的 UI 原子：`.btn`, `.chip`, `.text-input`, `.modal`, `.kbd`, `.separator` 等 |
| 各 `.svelte` 檔案 `<style>` 區塊 | 元件級 scoped 樣式（包含 Toast、Rating 等） |

### 1.3 CSS 變數一覽

```css
:root {
  /* 背景層級 */
  --bg:          #0a0a0a;     /* 最底層背景 */
  --bg-card:     #111111;     /* 卡片 / 面板 */
  --bg-hover:    #1a1a1a;     /* 懸停高亮 */
  --bg-active:   #222222;     /* 激活 / 按下 */

  /* 邊框 */
  --border:       #222222;
  --border-hover: #333333;

  /* 文字 */
  --text:        #fafafa;     /* 主要文字 */
  --text-muted:  #a1a1aa;     /* 次要文字 */
  --text-dim:    #71717a;     /* 最弱文字、提示 */

  /* 功能色 */
  --accent:      #ffffff;     /* 強調 / 主按鈕 */
  --destructive: #ef4444;     /* 危險操作 */
  --color-info:  #3b82f6;     /* 資訊提示 */
  --color-warning: #eab308;   /* 警告 */
  --color-success: #22c55e;   /* 成功 */

  /* 其他 */
  --ring:   #d4d4d8;          /* focus ring */
  --radius: 6px;              /* 統一圓角 */
  --font:      "Inter", "Noto Sans TC", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

### 1.4 命名慣例

- `--bg-*`：背景由淺→深（從使用者角度的「層級」概念）
- `--text` / `--text-muted` / `--text-dim`：文字亮度遞減
- `--color-*`：語意功能色

### 1.5 反轉配色慣例（Inverted Token）

本專案只有深色模式。當 UI 區塊需要「反轉」配色（如淺底深字的浮動 dock）時，直接對調現有 token，不另建 `--light-*` 變數：

| 需求 | 做法 |
|------|------|
| 淺色底板 | `background: var(--text)` |
| 深色文字 | `color: var(--bg)` |
| 次要文字 | `color: color-mix(in oklch, var(--bg) 65%, var(--text))` |
| 半透明暗色 | `hsl(from var(--bg) h s l / <alpha>)` |

全域原子 class（`app-basic.css` 的 `.btn`, `.chip` 等）為全域命名、無 scope，目前無衝突但限制了命名自由度。

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

## 3. 遷移路線建議

1. **短期**：繼續使用目前的 semantic tokens（`--bg`, `--text` 等），逐步將元件內的硬編碼色轉為變數。
2. **中期**：為需要外部覆寫的元件引入 component-level CSS custom properties（如 `--rating-color`），消除所有 `:global()` 穿透。
