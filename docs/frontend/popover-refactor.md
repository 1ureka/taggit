# Popover 重構：`popover=manual` + Svelte 5 Transition

> 本文件分析 Select 與 Autocomplete 的下拉面板從現行 CSS transition + `use:float` portal 遷移至原生 `popover=manual` + Svelte transition 的可行性。

---

## 1. 現行架構

### 1.1 元素結構

Select 與 Autocomplete 的下拉面板是一個 `<div class="popover">`，掛載 `use:float` action：

```svelte
<!-- Select.svelte -->
<div class="popover" role="listbox" use:float={{ reference: ui.triggerEl, open: ui.open }}>
  {#each options as opt, i}
    <button role="option" ...>{opt.label}</button>
  {/each}
</div>
```

### 1.2 顯示/隱藏

| 環節       | 機制                                                                 |
| ---------- | -------------------------------------------------------------------- |
| Portal     | `float` action 在 mount 時 `document.body.appendChild(node)`        |
| 定位       | `@floating-ui/dom` 的 `computePosition` + `autoUpdate`              |
| 開關控制   | `node.dataset.open = "true" / "false"`（data attribute）            |
| 動畫       | 全域 CSS transition：`opacity 0.12s ease-out, transform 0.12s ease-out` |
| 內容生命週期 | **永遠存在**——無論開關狀態，`{#each}` 內容始終在 DOM 中            |

### 1.3 問題

1. **內容無法惰性渲染**——下拉選項在元件 mount 時就存在於 DOM，即使使用者從未打開過選單
2. **CSS transition 無法通知結束**——開啟/關閉動畫完全由 CSS 控制，JS 無法在動畫結束時執行邏輯（除非手動監聽 `transitionend`）
3. **手動 portal**——`float` action 以命令式 `appendChild` / `removeChild` 操作 DOM，Svelte 不知道元素被移走了

---

## 2. 提案架構

### 2.1 核心概念

利用**原生 `popover=manual`** 取代手動 portal，並以 **Svelte 5 transition** 取代 CSS transition，在 `{#if}` 區塊內部實現惰性渲染：

```
┌─────────────────────────────────────────────┐
│  <div popover="manual">        ← 永遠存在   │
│    {作用：原生 top layer = portal}             │
│                                             │
│    {#if derivedOpen}           ← 惰性渲染   │
│      <div transition:slide>    ← Svelte 動畫 │
│        ...選項內容...                        │
│      </div>                                 │
│    {/if}                                    │
│                                             │
│  </div>                                     │
└─────────────────────────────────────────────┘
```

**三個關鍵角色：**

| 角色               | 元素                    | 說明                                         |
| ------------------ | ----------------------- | -------------------------------------------- |
| **容器（portal）** | `<div popover="manual">` | 永遠存在於 DOM，利用原生 top layer 實現 portal |
| **邏輯狀態**       | UI class 的 `open`       | 由事件推導的開關狀態（與現行相同）            |
| **渲染狀態**       | `{#if derivedOpen}`      | 控制內容是否存在於 DOM                        |

### 2.2 開關時序

#### 開啟流程（同步、立即）

```
使用者觸發 → open = true → showPopover() + derivedOpen = true → {#if} 渲染 + intro 開始
```

開啟時，原生 popover 立即顯示（`showPopover()`），`{#if}` 區塊同步渲染，Svelte intro transition 播放進場動畫。

#### 關閉流程（延遲、等待 outro 結束）

```
使用者觸發 → open = false → derivedOpen 仍為 true（outro 播放中）
                          → onoutroend → derivedOpen = false → {#if} 移除
                                       → hidePopover()
```

關閉時，`open` 立即變為 `false`，但 `derivedOpen` **不立刻** 跟著變——它等到 Svelte outro transition 結束（`onoutroend`）才變為 `false`，此時才呼叫 `hidePopover()` 將原生 popover 隱藏。這確保了出場動畫能完整播放。

### 2.3 「open」不再是原生 open

在提案架構中，UI class 的 `open` 是事件推導出的邏輯狀態，**不是**原生 popover 的 `:popover-open` 狀態：

| 狀態        | 含義                                   |
| ----------- | -------------------------------------- |
| `open`      | 使用者意圖的開/關（由 click、blur、Escape 等事件推導） |
| 原生 `:popover-open` | 原生 popover 是否可見（由 `showPopover()` / `hidePopover()` 控制） |

**開啟時兩者同步，關閉時原生狀態延遲到動畫結束。** 這是提案的核心設計。

---

## 3. 可行性分析

### 3.1 原生 `popover=manual` 的特性

| 特性                     | 說明                                                   | 對本提案的影響   |
| ------------------------ | ------------------------------------------------------ | ---------------- |
| Top layer                | 元素提升至 top layer，脫離正常文件流，自帶 portal 效果 | ✅ 取代手動 portal |
| `showPopover()` / `hidePopover()` | 命令式控制顯示/隱藏                           | ✅ 可精確控制時序 |
| 不自動關閉               | `manual` 模式不會在 click outside 或 Escape 時自動關閉 | ✅ 與現行行為一致（目前已自行處理） |
| `::backdrop`             | 原生 backdrop 偽元素                                   | ⚠️ 不需要，需確保不干擾 |
| 瀏覽器支援               | Chrome 114+、Firefox 125+、Safari 17+                  | ✅ 現代瀏覽器皆支援 |

### 3.2 Svelte 5 transition 的適用性

| 需求                       | Svelte transition 支援                                              |
| -------------------------- | ------------------------------------------------------------------- |
| 進場動畫                   | `in:fn` 或 `transition:fn`                                         |
| 出場動畫                   | `out:fn` 或 `transition:fn`                                        |
| 出場結束回呼               | `onoutroend` 事件——綁定在帶有 transition 的元素上           |
| 自訂動畫函式               | 支援自訂 `(node, params) => { ... }` 函式                          |
| 與 `{#if}` 搭配            | 原生支援——transition 綁定在 `{#if}` 內部的元素上                    |

**關鍵：`onoutroend`**——Svelte 5 在帶有 `transition:` 指令的元素上，於 outro 動畫結束後觸發 `outroend` 事件。將 `onoutroend` 綁定在帶有 transition 的元素上即可攔截此時機，這是延遲 `hidePopover()` 的核心機制。

### 3.3 定位方案

現行 `float` action 使用 `@floating-ui/dom` 定位。原生 `popover=manual` 的元素位於 top layer，定位機制有所不同：

**方案 A：保留 `@floating-ui/dom`**

`@floating-ui/dom` 在 top layer 元素上仍然可用——`computePosition` 計算的是相對於視窗的座標，與 `position: fixed` 行為一致。需要的調整：

- 移除 `document.body.appendChild(node)`（原生 popover 自動進入 top layer）
- 保留 `computePosition` + `autoUpdate` 邏輯
- `float` action 改為在 `showPopover()` 後啟動 `autoUpdate`

**方案 B：使用 CSS Anchor Positioning**

CSS Anchor Positioning（`anchor-name` + `position-area`）是原生替代方案，但目前瀏覽器支援尚不完整（Firefox / Safari 尚未支援），暫不建議。

**建議：方案 A**——保留 `@floating-ui/dom`，僅替換 portal 機制。

### 3.4 與現有架構的相容性

| 面向                       | 相容性                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| UI class 結構              | ✅ `open` 狀態邏輯不變，僅 `#openDropdown()` / `#closeDropdown()` 需小幅調整                    |
| Handler 命名與綁定         | ✅ 所有事件 handler 保持不變                                                                     |
| 鍵盤導航                   | ✅ 不受影響——鍵盤事件處理在 trigger 上，與 popover 機制無關                                       |
| Options pattern            | ✅ 不受影響                                                                                      |
| 全域 `.popover` class      | ⚠️ 需調整——移除 `opacity` / `transform` CSS transition，改由 Svelte transition 控制              |
| `use:float` action         | ⚠️ 需重構——移除 portal 邏輯，保留定位邏輯，加入 `showPopover()` / `hidePopover()` 呼叫           |
| `data-open` 屬性           | ❌ 不再需要——顯示/隱藏改由原生 popover 狀態 + `{#if}` 控制                                      |

### 3.5 快速開關與 transition 生命週期

Svelte 的 transition 生命週期天然處理快速開關，不存在 race condition：

| 情境                           | Svelte 行為                                   | `hidePopover()` 狀態       |
| ------------------------------ | --------------------------------------------- | -------------------------- |
| Outro 中斷（關閉後立即重新開啟） | 取消 outro → 開始 intro，`outroend` **不觸發** | 不呼叫（正確：popover 應保持可見） |
| Intro 中斷（開啟後立即關閉）    | 取消 intro → 開始 outro，`outroend` **最終觸發** | 呼叫（正確：popover 應隱藏）       |

因此 `onoutroend` 回呼不會漏掉也不會多餘觸發——中斷的 outro 不觸發 end 事件，而中斷的 intro 會自然轉入 outro 流程。

### 3.6 其他注意事項

1. **Top layer 與 z-index**——原生 top layer 的堆疊順序由進入順序決定，不受 `z-index` 影響。若同時有 Modal 與 Popover 開啟，需確認堆疊順序正確

2. **Accessibility**——原生 `popover` 自帶部分 ARIA 語意，但 `manual` 模式不會自動管理 focus。現有的 `role="listbox"` / `role="option"` 仍需保留

3. **`::backdrop`**——原生 popover 的 `::backdrop` 預設透明，不影響視覺，但需確保沒有全域 CSS 意外為其加上樣式

---

## 4. 預期改動範圍

### 4.1 需修改的檔案

| 檔案                               | 改動                                                       |
| ---------------------------------- | ---------------------------------------------------------- |
| `src/lib/client/float.ts`          | 移除 `appendChild` / `removeChild`，加入 `showPopover()` / `hidePopover()` 呼叫，保留 `computePosition` |
| `src/lib/components/Select.svelte` | `<div class="popover">` → `<div popover="manual">`，內部加入 `{#if}` + transition |
| `src/lib/components/Autocomplete.svelte` | 同上                                                 |
| `src/lib/ui/select.svelte.ts`      | 小幅調整——可能需要新增 `derivedOpen` 狀態或在 class 外由 template 管理  |
| `src/lib/ui/autocomplete.svelte.ts`| 同上                                                       |
| `src/lib/styles/app-basic.css`     | `.popover` 的 CSS transition 移除或改為只保留基礎樣式       |

### 4.2 Select.svelte 改動示意

```svelte
<script lang="ts">
  import { slide } from "svelte/transition";
  // ...existing imports...
</script>

<button bind:this={ui.triggerEl} type="button" class="trigger" ...>
  ...
</button>

<!-- popover 容器永遠存在（portal） -->
<div
  bind:this={ui.popoverEl}
  class="popover"
  role="listbox"
  popover="manual"
  use:float={{ reference: ui.triggerEl, open: ui.open, placement: "bottom-start" }}
>
  <!-- 內容惰性渲染 -->
  {#if ui.open}
    <div
      class="popover-content"
      transition:slide={{ duration: 120 }}
      onoutroend={ui.handleOutroEnd}
    >
      {#each options as opt, i}
        <button
          type="button" role="option" class="option ellipsis"
          class:active={i === ui.activeIndex}
          class:selected={opt.value === value}
          aria-selected={opt.value === value}
          onmousedown={(e) => ui.handleOptionMouseDown(e, opt)}
          onmouseenter={() => ui.handleOptionMouseEnter(i)}
        >
          {opt.label}
        </button>
      {/each}
    </div>
  {/if}
</div>
```

### 4.3 float.ts 改動示意

```typescript
function apply(o: FloatOptions) {
  cleanup?.();
  cleanup = undefined;

  if (o.open) {
    // 開啟：立即顯示 popover，啟動自動定位
    if (!node.matches(":popover-open")) node.showPopover();
    if (!o.reference) return;
    cleanup = autoUpdate(o.reference, node, () => recompute(o));
  } else {
    // 關閉：定位一次（讓 outro 在正確位置播放）
    // 注意：不在此處 hidePopover()——由 onoutroend 觸發
    if (o.reference) recompute(o);
  }
}
```

### 4.4 select.svelte.ts 改動示意

```typescript
export class Select<T> {
  triggerEl = $state<HTMLButtonElement>();
  popoverEl = $state<HTMLDivElement>();
  open = $state(false);
  // ...

  /** outro 結束時呼叫，真正隱藏原生 popover */
  handleOutroEnd = () => {
    if (!this.open && this.popoverEl?.matches(":popover-open")) {
      this.popoverEl.hidePopover();
    }
  };
}
```

---

## 5. 優勢總結

| 面向           | 現行                                      | 提案                                      |
| -------------- | ----------------------------------------- | ----------------------------------------- |
| Portal         | 手動 `appendChild` 至 `document.body`     | 原生 top layer（`popover=manual`）         |
| 內容生命週期   | 永遠存在於 DOM                            | 惰性渲染（`{#if}` 控制）                  |
| 動畫           | CSS transition（JS 無法感知結束）          | Svelte transition（`onoutroend` 回呼）    |
| 動畫結束處理   | 無                                        | `onoutroend` 精確觸發 `hidePopover()`     |
| z-index 管理   | 手動 `var(--z-popover)`                   | 原生 top layer 自動管理                   |
| 程式碼複雜度   | `float.ts` 包含 portal + 定位 + data attr | `float.ts` 僅負責定位，portal 由原生處理  |

---

## 6. 結論

**可行性：高。** 所有必要的 Web API（`popover=manual`）與 Svelte 5 特性（transition + `{#if}` + `onoutroend`）皆已穩定可用。改動範圍明確且集中，不影響 UI class 的核心邏輯與事件處理。

**建議的實作順序：**

1. 先重構 `float.ts`——移除 portal 邏輯，加入 `showPopover()` / `hidePopover()` 支援
2. 重構 `Select.svelte` 作為先行驗證
3. 確認快速開關、鍵盤導航、無障礙等情境正常後，再套用至 `Autocomplete.svelte`
4. 清理 `app-basic.css` 中不再需要的 CSS transition 規則
