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
| `src/lib/styles/app-basic.css` | 全域可複用的 UI 原子：`.btn`, `.chip`, `.input`, `.modal`, `.kbd`, `.separator` 等 |
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

---

## 2. 已知耦合 & 技術債

1. **硬編碼反轉顏色**：`EditorSelectionDock`、`TrashSelectionDock` 的白底 dock、以及 `browse/player/page.css` 中使用了大量 `#ffffff`, `#000000`, `#555555` 等硬編碼值，未走 CSS 變數。詳見 §2.1。
2. **全域原子 class**：`app-basic.css` 中的 `.btn`, `.chip` 等為全域命名，無 scope — 雖然目前沒有衝突，但限制了命名自由度。

### 2.1 Token 反轉（Inverted Token）策略

本專案**只有深色模式**，不會有淺色模式。因此，當 UI 區塊需要「反轉」配色（如淺底深字的浮動 dock）時，**不需要另建一組 `--light-*` 變數**，直接對調使用現有 token 即可：

| 需求 | 硬編碼（❌） | Token 反轉（✅） |
|------|-------------|-----------------|
| 淺色底板 | `background: #ffffff` | `background: var(--text)` |
| 深色文字 | `color: #000000` | `color: var(--bg)` |
| 次要/柔和文字 | `color: #555555` | `color: var(--text-dim)` — 搭配 `color-mix()` 微調 |
| hover 高亮 | `background: #e0e0e0` | `background: color-mix(in oklch, var(--text) 85%, var(--bg))` |

**原理**：深色主題中 `--text`（`#fafafa`）是亮色，`--bg`（`#0a0a0a`）是暗色。在「反轉區塊」中，亮色就是底板、暗色就是文字 — 語意上完全對称。

#### 需修正的檔案

| 檔案 | 硬編碼 | 替換 |
|------|--------|------|
| `EditorSelectionDock.svelte` | `.dock-inner { background: #ffffff; color: #000000; }` | `background: var(--text); color: var(--bg);` |
| `EditorSelectionDock.svelte` | `.dock-close, .dock-count { color: #555555; }` | `color: color-mix(in oklch, var(--bg) 65%, var(--text))` |
| `TrashSelectionDock.svelte` | `.dock-inner { background: #ffffff; color: #000000; }` | `background: var(--text); color: var(--bg);` |
| `TrashSelectionDock.svelte` | `.dock-close, .dock-count { color: #555555; }` | `color: color-mix(in oklch, var(--bg) 65%, var(--text))` |
| `browse/player/page.css` | `.browse-player { background: #000; }` | `background: var(--bg);` |

#### 命名指引

在反轉區塊中，不要發明新變數。直接反用 `--bg` / `--text` / `--text-muted` / `--text-dim`：

```css
/* ✅ 反轉 dock */
.dock-inner {
  background: var(--text);
  color: var(--bg);
}
.dock-muted {
  color: color-mix(in oklch, var(--bg) 65%, var(--text));
}

/* ❌ 不要這樣做 */
.dock-inner {
  background: var(--dock-bg);   /* 多餘的新變數 */
  color: var(--dock-text);
}
```

---

## 3. 現代 CSS 主題實踐（務必遵循）

### 3.1 使用相對色彩語法（Relative Color Syntax）

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

### 3.2 使用 `color-mix()` 作為替代方案

若需要更廣泛的瀏覽器支援，`color-mix()` 也是很好的選擇：

```css
/* 混和白色產生 hover 效果 */
background: color-mix(in srgb, var(--bg-card) 85%, white);

/* 混和黑色產生 pressed 效果 */
background: color-mix(in srgb, var(--accent) 80%, black);
```

### 3.3 強制深色模式

本專案僅支援深色主題，不打算支援淺色模式。在 `:root` 中應明確宣告：

```css
:root {
  color-scheme: dark;
  /* 所有變數皆為深色值 */
}
```

`color-scheme: dark` 告知瀏覽器使用深色系的原生控制項（scrollbar、form elements 等），確保視覺一致。

### 3.4 元件 Scoped 變數 + 外部覆寫

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

## 4. 遷移路線建議

1. **短期**：繼續使用目前的 semantic tokens（`--bg`, `--text` 等），逐步將元件內的硬編碼色轉為變數。
2. **中期**：為需要外部覆寫的元件引入 component-level CSS custom properties（如 `--rating-color`），消除所有 `:global()` 穿透。
3. **中期**：將 dock 等特殊區塊的硬編碼色改用 `hsl(from … h s l / alpha)` 或 `color-mix()` 從語意色衍生，減少 magic number。

---

## 5. 關鍵提示（給 AI Agent）

- 新增顏色時，**先檢查是否可用既有語意變數 + relative color syntax 衍生**，避免新增不必要的 primitive。
- 元件内部不要依賴外部穿透的 `:global()` 來獲得樣式 —— 改用 CSS custom properties 作為 API。
- `hsl(from ${color} h s l / ${alpha})` 語法已在所有主流瀏覽器支援（Chrome 111+, Safari 16.4+, Firefox 128+），可直接使用。
- 請使用 `color-mix(in oklch, …)` 而非 `color-mix(in srgb, …)` 以獲得更均勻的色彩混合，除非有特定理由。
