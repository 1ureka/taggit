# 前端架構總覽

> 本文件群描述專案的前端 pattern 與 best practice。

---

## Template 與 UI

本專案將前端拆分為兩個正交的維度：

- **Template**：HTML 結構 + CSS 樣式——寫給人看的，關注語意、無障礙、視覺呈現
- **UI**：互動邏輯——寫給機器跑的，關注狀態管理、事件處理、API 呼叫

兩者分別放在不同的檔案類型中：

| 維度     | 檔案類型    | 內容                                                                 |
| -------- | ----------- | -------------------------------------------------------------------- |
| Template | `.svelte`   | `<template>` + `<style>`，以及最少量的 `<script>`（僅 import + 實例化） |
| UI       | `.svelte.ts` | `export class`，管理 `$state`、`$derived`、`$effect`、event handlers  |

### 為什麼不全部組件化？

傳統前端框架鼓勵「一切皆組件」——每段 UI 都拆成獨立的 `.svelte` 檔案。但在多數網站的規模下，過度組件化帶來幾個問題：

1. **結構碎片化**：要理解一個頁面的完整 DOM 結構，得在 6-7 個檔案間反覆跳轉。語意標籤、ARIA 屬性、元素層級分散在各處，難以一眼掌握
2. **Prop 嫁接鏈**：共享狀態必須從 `+page.svelte` → 子組件 `.svelte`（`$bindable` + getter/setter），每層都只是搬運，不是邏輯
3. **視覺自由受限**：HTML 結構被綁在組件邊界上。如果設計需要將兩個不同邏輯單元的元素放在同一個視覺區塊，就面臨結構與邏輯的兩難
4. **樣式追蹤困難**：同一個頁面的 CSS 散落在多個 scoped `<style>` 中，難以統一審視

**Template vs UI 的拆分解決了這個問題**：Template（HTML + CSS）保持完整，在一個檔案中呈現整個頁面的結構；UI（互動邏輯）沿職責邊界拆分為多個 class，各自獨立。結構與邏輯的切割線本就不同，不必綁在同一個組件邊界上。

### 三個層面

Template vs UI 的拆分在三個層面上運作：

- **頁面層面**——一個路由只有一個 `+page.svelte`，所有互動邏輯拆至 `*.svelte.ts` class。→ [pages.md](./pages.md)
- **共用組件層面**——跨頁面復用的 UI 單元維持 `.svelte` + `.svelte.ts` 雙檔案結構。→ [components.md](./components.md)
- **互動邏輯層面**——無論頁面或組件，class 的結構、狀態管理、事件處理 pattern 是統一的。→ [ui.md](./ui.md)

---

## Pages、Snippets 與 Components

### Pages

每個路由只有一個 `+page.svelte`，它是該路由的唯一 `.svelte` 檔案（不拆頁面特有的子組件）。它負責：

- 接收 SSR 資料（`$props()`）
- 實例化所有互動邏輯 class
- 呈現完整的 HTML 結構與 scoped 樣式

→ 詳見 [pages.md](./pages.md)

### Snippets

Svelte 5 的 `{#snippet}` 是 **template 層面的變數**——就像 JS 中會把複雜運算透過變數使其可讀，snippet 把重複或複雜的 HTML 抽成一個具名片段:

- **迴圈內的深層結構**: 從 `{#each}` 中抽出 item template，降低嵌套層級
- **頁面章節組織**: 無參數 snippet 拆分長頁面的邏輯區塊，可直接使用該頁面的所有資料與互動邏輯 (class) 而不需傳入
- **Snippet 作為參數傳遞**: 一個 snippet 接受 `Snippet` 型別參數，實現可注入內容的「元件化 snippet」
- **注入共用組件**: 把 snippet 作為 children 傳入共用組件

→ 詳見 [snippets.md](./snippets.md)（完整的用途分類、程式碼範例、snippet vs 組件的判斷依據）

### Components

共用組件位於 `src/lib/components/`，有明確的跨頁面復用場景（如 Rating、Autocomplete、Modal）。判定原則：**如果一段 UI 只在一個頁面出現，它就不是共用組件。**

→ 詳見 [components.md](./components.md)

### Layout

`+layout.svelte` 是特殊案例——它提供跨路由的共享外殼（header、導航、全域 modal/toast 容器）。本專案只有一個根 layout，作為全域 shell 使用。Layout 內可以持有少量自己的 `$state`（如導航面板的開關狀態），這是對一般頁面規則的例外。

---

## 語意化、無障礙與 CSS

### 語意 HTML

本專案大量使用語意標籤：`<main>`、`<aside>`、`<header>`、`<footer>`、`<figure>`、`<figcaption>`、`<nav>`、`<dl>`/`<dt>`/`<dd>`、`<ul>`/`<li>` 等。在 Svelte scoped 環境下，這些標籤本身就是精確的選擇器，不需要額外加 class。

### 無障礙

無障礙開發最大的挑戰是需要全局視角——ARIA landmarks、focus 管理、鍵盤導航路徑都需要理解整個頁面的 DOM 結構。「一頁一 svelte」架構讓所有語意標記集中在一個檔案中，大幅降低無障礙審計的難度。

常用的無障礙 pattern：

- `role="listbox"` + `role="option"` + `aria-selected`（列表選擇）
- `role="dialog"` + `aria-modal` + `aria-label`（Modal）
- `role="spinbutton"` + `aria-valuenow/min/max/text`（Rating）
- `role="alert"` + `aria-live="polite"`（通知）
- `:focus-visible` 用於鍵盤 focus ring（而非 `:focus`）

### CSS 選擇器策略

本專案的 CSS 有一個核心原則：**最大化利用 Svelte CSS 靜態分析器的警告能力，同時不須大量撰寫 classname。**

具體做法：

1. **優先使用語意 HTML 元素選擇器**——scoped 環境下，`header`、`aside`、`dl` 等本身就是精確選擇器
2. **必要時使用結構式 class name**——如 `.card`、`.actions`，而非業務式命名如 `.editor-buttons`
3. **使用直接子代選擇器 `>` 或 `& >`**——避免模糊的後代選擇器（空格），確保 Svelte 分析器能精準追蹤匹配關係
4. **善用 CSS nesting（`&`）描述層級**——偽類、狀態 class、子元素選擇器收在父層內

為什麼要避免模糊後代選擇器？Svelte 的靜態分析器會檢查選擇器是否匹配到模板中的元素。直接子代選擇器 `>` 讓分析器能精準判斷匹配關係，並在選擇器失效時發出警告；而空格後代選擇器可能匹配到深層的任意後代，分析器難以確定是否真的被使用，無法給出有效警告。

→ 詳見 [css.md](./css.md)（完整的選擇器策略、scoped 樣式、全域原子）
→ 詳見 [theme.md](./theme.md)（設計變數、色彩系統、按鈕系統、圖示系統）

---

## 狀態管理與互動邏輯

### 資料流策略

本專案盡量讓資料流轉於 URL 與 SSR 之間，減少純客戶端狀態：

1. **URL 作為 source of truth**：篩選條件、排序、當前項目 ID 等狀態存在 URL searchParams 中，而非 `$state`。讓狀態可書籤化，瀏覽器前進/後退自然運作
2. **SSR 資料流**：`+page.server.ts` 從 URL 參數讀取查詢條件、查詢資料庫、回傳 `data`。`goto()` 或 `invalidateAll()` 觸發 `load` 重跑，資料自動更新
3. **最小化客戶端狀態**：只有無法放入 URL 的暫態（如 hover index、drag 狀態、pending flag）才使用 `$state`

### 互動邏輯的組織

所有互動邏輯收進 `*.svelte.ts` 的 class 中。Template（`.svelte`）只做實例化與綁定，不包含事件處理或狀態計算。

由於 template vs UI 與 pages vs snippet vs components 兩個軸線是正交的，互動邏輯的 class 結構無論在頁面或組件中都是統一的——同樣的 `$state`、同樣的 options pattern、同樣的 handler 命名。

→ 詳見 [ui.md](./ui.md)
