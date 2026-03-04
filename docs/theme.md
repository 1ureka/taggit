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

1. **硬編碼顏色**：`EditorSelectionDock` 的白底 dock 使用了大量 `#ffffff`, `#000000`, `#555555` 等硬編碼值，未走 CSS 變數。
2. **全域 class 穿透**：部分元件透過 `:global()` 覆寫其他元件內部 class（如 dock 覆寫 `.rating-star` 顏色）。
3. **全域原子 class**：`app-basic.css` 中的 `.btn`, `.chip` 等為全域命名，無 scope — 雖然目前沒有衝突，但限制了命名自由度。

---

## 3. 推薦的現代 CSS 主題實踐

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
- 切換主題（如淺色模式）只需改基礎色

**注意**：需要基礎色本身使用 CSS 支援的格式（hex、rgb、hsl 皆可），瀏覽器會自動解析。

### 3.2 使用 `color-mix()` 作為替代方案

若需要更廣泛的瀏覽器支援，`color-mix()` 也是很好的選擇：

```css
/* 混和白色產生 hover 效果 */
background: color-mix(in srgb, var(--bg-card) 85%, white);

/* 混和黑色產生 pressed 效果 */
background: color-mix(in srgb, var(--accent) 80%, black);
```

### 3.3 將主題層級化

建議日後將變數組織為三層：

```
┌─────────────────────────────────┐
│  Primitive Tokens               │  --gray-100, --gray-200, --red-500 …
├─────────────────────────────────┤
│  Semantic Tokens                │  --bg, --text, --destructive …
├─────────────────────────────────┤
│  Component Tokens               │  --rating-color, --toast-bg, --btn-bg …
└─────────────────────────────────┘
```

- **Primitive**：原始色票（可由設計工具匯出）
- **Semantic**：語意化映射，切換主題只需重新映射此層
- **Component**：元件級覆寫點，讓 scoped 樣式更靈活

### 3.4 淺色 / 深色模式切換（未來目標）

```css
:root {
  color-scheme: dark;
  --bg: #0a0a0a;
  --text: #fafafa;
  /* … */
}

@media (prefers-color-scheme: light) {
  :root {
    color-scheme: light;
    --bg: #ffffff;
    --text: #0a0a0a;
    /* … */
  }
}
```

或用 `data-theme` attribute 手動切換：

```css
:root[data-theme="light"] {
  --bg: #ffffff;
  --text: #171717;
  /* … */
}
```

### 3.5 元件 Scoped 變數 + 外部覆寫

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
2. **中期**：為需要外部覆寫的元件引入 component-level CSS custom properties（如 `--rating-color`），消除 `:global()` 穿透。
3. **中期**：將 dock 等淺色區塊的硬編碼色改用 `hsl(from … h s l / alpha)` 或 `color-mix()` 從語意色衍生。
4. **長期**：引入 primitive token 層，支援多主題（dark / light / 自訂），搭配 `data-theme` 切換。

---

## 5. 關鍵提示（給 AI Agent）

- 新增顏色時，**先檢查是否可用既有語意變數 + relative color syntax 衍生**，避免新增不必要的 primitive。
- 元件内部不要依賴外部穿透的 `:global()` 來獲得樣式 —— 改用 CSS custom properties 作為 API。
- `hsl(from ${color} h s l / ${alpha})` 語法已在所有主流瀏覽器支援（Chrome 111+, Safari 16.4+, Firefox 128+），可直接使用。
- 請使用 `color-mix(in oklch, …)` 而非 `color-mix(in srgb, …)` 以獲得更均勻的色彩混合，除非有特定理由。
