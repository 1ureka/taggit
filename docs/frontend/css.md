# CSS

> 本專案的 CSS 策略建立在 Svelte scoped style 之上，以語意 HTML 與直接子代選擇器為核心，最大化利用編譯器的靜態分析能力。

---

## 核心原則

1. **語意 HTML 優先**——能用元素選擇器就不加 class
2. **直接子代選擇器**——使用 `>` 或 `& >` 而非模糊後代選擇器
3. **結構式命名**——class 描述結構角色（`.card`、`.actions`）而非業務語意（`.editor-buttons`）
4. **Scoped + 全域互補**——元件 scoped style 負責佈局與組合，全域原子 class 負責基礎外觀

---

## 選擇器策略

### 語意 HTML 元素選擇器

在 Svelte scoped 環境下，元素選擇器的作用域被限定在元件內部，不會汙染外部。當元素的 HTML 標籤已足夠描述結構角色時，**直接以元素選擇器選取，不加 class**：

```svelte
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
  }

  dt { color: var(--text-dim); }

  dd {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
```

適用的語意標籤：`main`、`aside`、`header`、`footer`、`nav`、`figure`、`figcaption`、`dl`/`dt`/`dd`、`ul`/`li`、`h1`–`h6`、`p`、`label` 等。

### 直接子代選擇器 `>`

**避免模糊後代選擇器（空格）**，使用直接子代選擇器 `>` 或 `& >`：

```css
/* ✗ 模糊後代選擇器——可能匹配深層任意後代 */
.sidebar header { ... }
.panel button { ... }

/* ✓ 直接子代選擇器——精確描述層級關係 */
.sidebar > header { ... }
.panel > button { ... }
```

為什麼這麼做？

1. 強型別般的 CSS：使用 > 就像是在定義函數的型別簽名，同時也減少意外匹配的可能性。
2. 編譯即檢查：當你為了 Scroll 需求多加了一層 div.scroll-container，原本的 aside > header 結構就「斷了」。
3. 透過嚴格的 > 選擇器，確保任何 HTML 結構的變動都能觸發編譯器的「未使用的 CSS」警告。適應前端開發的快速迭代與設計稿頻繁變動的特性。

> 在 svelte 中，由於有 scoped style 的特性，保持 CSS 的脆弱性 (Fragility) 而非 健壯性 (Robustness) 是更好的選擇

### 結構式 class 命名

當語意 HTML 不足以區分角色時，使用描述**結構功能**的 class name：

| ✓ 結構式       | ✗ 業務式              |
| -------------- | --------------------- |
| `.card`        | `.compare-card`       |
| `.card-image`  | `.compare-card-image` |
| `.field-name`  | `.editor-name-field`  |
| `.actions`     | `.editor-buttons`     |
| `.tags`        | `.image-tag-list`     |
| `.empty`       | `.no-images-message`  |

Svelte scope 已隔離命名空間，`.card` 在不同的 `.svelte` 中互不干擾，不需要 BEM 式前綴。

常見的結構命名模式：

- **佈局**：`.page`、`.content`、`.panel`、`.left-panel`、`.right-panel`
- **卡片**：`.card`、`.card-image`、`.card-info`、`.card-header`
- **表單**：`.field-*`（`.field-name`、`.field-rating`、`.field-tags`）、`.actions`
- **狀態**：`.loading`、`.empty`、`.active`、`.selected`、`.error`
- **文字**：`.mono`、`.label`、`.hint`

---

## CSS Nesting

善用 CSS nesting（`&`）描述層級關係，減少頂層選擇器數量：

```css
.card {
  display: flex;
  flex-direction: column;
  background: var(--bg-card);
  border: var(--border-style);
  border-radius: calc(var(--radius) * 2);
  overflow: hidden;

  &:hover {
    border-color: var(--border-hover);
    box-shadow: 0 0 0 1px var(--border-hover);
  }
}
```

### Nesting 使用時機

| 情境                        | 做法                                   |
| --------------------------- | -------------------------------------- |
| 偽類、偽元素                | 永遠嵌套：`&:hover`、`&::after`        |
| 狀態 class                  | 永遠嵌套：`&.active`、`&.loading`      |
| 語意唯一的子元素            | 嵌套：`& > img`、`& > span`            |
| 具有獨立結構角色的子元素    | 提升為頂層 class：`.card-image { ... }` |

不要為了 nesting 而強行嵌套無關的選擇器。若子元素自身具有獨立的結構角色，應提升為頂層 class。

### 區段分隔

CSS 區塊之間使用 `/* --- */` 作為視覺分隔符，與 `.svelte.ts` 中的 `// ---` 慣例一致：

```css
.sidebar { ... }
.sidebar > header { ... }

/* --- */

.preview { ... }
.preview > img { ... }

/* --- */

.panel { ... }
.panel > form { ... }
```

---

## `:has()` 偽類

本專案積極使用 `:has()` 來根據子元素狀態調整父元素樣式，避免為了樣式而在 template 中添加額外的狀態 class：

```css
/* 當 figure 內有 .preview-container 時調整佈局 */
figure:has(.preview-container) { flex: 1; min-height: 0; }

/* 當 .preview-container 內有 .empty 時置中 */
.preview-container:has(.empty) { display: flex; justify-content: center; }

/* header 有無 h1 時的不同佈局 */
header:has(h1) { justify-content: center; }
header:not(:has(h1)) { justify-content: space-between; }
```

---

## `class:` 指令

Svelte 的 `class:` 指令用於狀態驅動的 CSS class 切換，由 class instance 的狀態控制：

```svelte
<div class:pending={form.pending}>...</div>
<li class:active={listSelect.activeIndex === i}>...</li>
<section class:loading={preview.imageLoading}>...</section>
```

對應的 CSS 在 scoped `<style>` 中以 nesting 定義這些狀態：

```css
.container {
  transition: opacity 0s step-start;

  &.loading {
    opacity: 0.4;
    transition: opacity 0.2s step-end;
  }
}
```

---

## Scoped Style 與全域 CSS 的分工

### 全域原子 Class

`src/lib/styles/` 中定義的全域 class 負責**跨頁面、跨組件複用的基礎 UI 單元**：

| Class              | 來源             | 用途                       |
| ------------------ | ---------------- | -------------------------- |
| `.text-input`      | `app-basic.css`  | 文字輸入框                 |
| `.chip`            | `app-basic.css`  | 標籤藥丸                   |
| `.chip-removable`  | `app-basic.css`  | 可移除的互動標籤           |
| `.kbd`             | `app-basic.css`  | 鍵盤快捷鍵提示             |
| `.badge`           | `app-basic.css`  | 數字徽章                   |
| `.separator`       | `app-basic.css`  | 水平分隔線                 |
| `.ellipsis`        | `app-basic.css`  | 文字截斷                   |
| `.visually-hidden` | `app.css`        | 螢幕閱讀器專用             |
| `.slide-up`        | `app.css`        | 滑入動畫                   |
| `.defer-dim`       | `app.css`        | 延遲暗化（loading debounce）|
| `.btn-primary`     | `app-button.css` | 主要操作按鈕               |
| `.btn-outlined`    | `app-button.css` | 一般操作按鈕               |
| `.btn-ghost`       | `app-button.css` | 輔助操作按鈕               |
| `.btn-destructive` | `app-button.css` | 危險操作按鈕               |
| `.btn-icon`        | `app-button.css` | 僅圖示按鈕                 |
| `.btn-sm`          | `app-button.css` | 小尺寸修飾符               |
| `.pending`         | `app-button.css` | 載入中狀態                 |

在 template 中直接套用這些 class，元件的 scoped `<style>` **只負責佈局與位置**：

```svelte
<div class="actions">
  <button class="btn-primary btn-sm">儲存</button>
  <button class="btn-destructive btn-sm">刪除</button>
</div>

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }
</style>
```

### `:global()` 的使用

`:global()` 只用於必須從 scoped 作用域影響全域元素的罕見情境：

```css
/* Layout 中設定 body 樣式 */
:global(body) {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
}
```

一般頁面與組件中**不使用 `:global()`**。全域樣式放在 `app*.css` 中，scoped 樣式只管自己的作用域。

---

## 載入 Debounce（CSS-only）

使用者觸發導航後，若立刻顯示載入狀態，快速完成的導航（< 200ms）會造成閃爍。採用**純 CSS 雙 transition 規則**實現載入提示的 debounce：

```svelte
<div class="container" class:loading={navigating.to}>
  <!-- 正常內容 -->
</div>

<style>
  .container {
    transition: opacity 0s step-start;

    &.loading {
      opacity: 0.4;
      transition: opacity 0.2s step-end;
    }
  }
</style>
```

| 方向         | 套用的規則                          | 效果                   |
| ------------ | ----------------------------------- | ---------------------- |
| 進入 loading | `transition: opacity 0.2s step-end` | 延遲 200ms 才跳變     |
| 離開 loading | `transition: opacity 0s step-start` | 瞬間恢復              |

此模式不限於 `navigating`——任何布林旗標驅動的暫態視覺回饋（如 API 呼叫中的 `loading`、按鈕的 `disabled`）都適用。全域 class `.defer-dim` 已封裝此 pattern。

模板必須使用 **`class:loading`** 而非 `style:opacity`，因為需要讓 CSS 能根據不同狀態套用不同的 transition 規則。

---

## 頁面 vs 組件的 CSS 差異

| 面向       | 頁面（`+page.svelte`）                     | 組件（`src/lib/components/`）              |
| ---------- | ------------------------------------------ | ------------------------------------------ |
| 樣式規模   | 較大，可達 200-400 行 CSS                   | 較小，聚焦於單一組件                        |
| 選擇器風格 | 大量語意元素選擇器 + 少量結構 class         | 以 class 為主（`.rating`、`.select-*`）     |
| 全域 class | 直接在 template 使用                        | 直接在 template 使用                        |
| 命名空間   | Svelte scope 隔離                           | Svelte scope 隔離                           |
| Responsive | 偶爾使用 `@media` nested 在規則內           | 較少                                       |

→ 頁面的結構與 template pattern 詳見 [pages.md](./pages.md)
→ 組件的樣式慣例詳見 [components.md](./components.md)
