# 方案 C：共用 Modal + 全域命令式 ConfirmModal + Snippet 宣告式支援

## 一、目標

1. **共用 Modal 元件** — `Modal.svelte` + `modal.svelte.ts`，處理所有 overlay / focus trap / ARIA / Escape / 點擊外部關閉等基礎行為。
2. **ConfirmModal 改建於 Modal 之上** — 掛載於 `+layout.svelte`，全域監聽 `confirm:request` CustomEvent，任何地方只需 `await requestConfirm(msg)` 即可取得 `boolean`。
3. **Modal 支援 Snippet** — 未來其他用途（設定彈窗、Lightbox 等）可宣告式使用 Modal。

---

## 二、設計

### 2.1 Modal 底層（`modal.svelte.ts` + `Modal.svelte`）

`modal.svelte.ts` 為無頭 UI 工廠函數，管理：

- `open` 狀態（外部控制）
- Escape 鍵關閉（`stopPropagation` + `preventDefault` 消費事件）
- 點擊 overlay 關閉
- **Focus trap**：開啟時記住先前 `activeElement`，將焦點限制在 modal 內；關閉時還原焦點
- `onclose` callback

```ts
// modal.svelte.ts
type ModalOptions = {
  open: boolean;
  onclose: () => void;
};

export function createModal(options: ModalOptions) {
  let dialogEl = $state<HTMLDivElement>();
  let previouslyFocused: HTMLElement | null = null;

  /** 處理 Overlay 點擊事件，點擊背景關閉 Modal */
  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) options.onclose();
  }

  /** 處理鍵盤事件，Escape 關閉 + Tab focus trap */
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      options.onclose();
      return;
    }

    // Focus trap: Tab / Shift+Tab
    if (e.key === "Tab" && dialogEl) {
      const focusable = dialogEl.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /** 開啟時儲存焦點並移入 Modal */
  function saveFocusAndTrap() {
    previouslyFocused = document.activeElement as HTMLElement | null;
    // 延遲一個 tick 讓 DOM 渲染完成
    queueMicrotask(() => {
      const first = dialogEl?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    });
  }

  /** 關閉時還原焦點 */
  function restoreFocus() {
    previouslyFocused?.focus();
    previouslyFocused = null;
  }

  // ---

  /** 監聽 open 狀態變化，開啟時儲存焦點並啟用 trap，關閉時還原焦點 */
  $effect(() => {
    if (options.open) {
      saveFocusAndTrap();
      return () => restoreFocus();
    }
  });

  return {
    get dialogEl() { return dialogEl as HTMLDivElement; },
    set dialogEl(el: HTMLDivElement) { dialogEl = el; },
    handleOverlayClick,
    handleKeydown,
  };
}
```

`Modal.svelte` 結構：

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";
  import { createModal } from "$lib/client/modal.svelte.js";

  type Props = {
    open: boolean;
    onclose: () => void;
    children: Snippet;
    label?: string;
  };

  let { open = $bindable(), onclose, children, label = "對話框" }: Props = $props();

  const ui = createModal({
    get open() { return open; },
    onclose,
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={ui.handleOverlayClick} onkeydown={ui.handleKeydown}>
    <div
      class="modal scale-in"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      bind:this={ui.dialogEl}
    >
      {@render children()}
    </div>
  </div>
{/if}
```

**ARIA 屬性**：`role="dialog"` + `aria-modal="true"` + `aria-label`。
**Focus trap**：Tab 循環鎖定、開啟時自動聚焦第一個可操作元素、關閉時還原先前焦點。
**Escape**：`preventDefault` + `stopPropagation`，解決 report.md 中提到的事件未消費問題。

### 2.2 全域命令式 ConfirmModal

#### 事件協議（`types.ts` 新增）

```ts
/** 前端 Confirm CustomEvent 的事件名稱 */
export type ConfirmEventName = "confirm:request";

/** 前端 Confirm CustomEvent 攜帶的資料 */
export interface ConfirmPayload {
  message: string;
  resolve: (value: boolean) => void;
}
```

#### 命令式 API（`dom.ts` 新增）

```ts
/**
 * 顯示全域確認對話框並等待使用者回應。
 * 內部透過 CustomEvent 將請求派發至 ConfirmModal 的無頭 UI。
 */
export function requestConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const eventName: ConfirmEventName = "confirm:request";
    window.dispatchEvent(
      new CustomEvent<ConfirmPayload>(eventName, {
        detail: { message, resolve },
      })
    );
  });
}
```

#### 無頭 UI（`confirmModal.svelte.ts` 新增）

```ts
// src/lib/client/confirmModal.svelte.ts
import type { ConfirmEventName, ConfirmPayload } from "$lib/types.js";

type ConfirmModalOptions = {};

export function createConfirmModal(_options: ConfirmModalOptions) {
  let open = $state(false);
  let message = $state("");
  let resolveRef: ((v: boolean) => void) | null = null;

  /** 接受確認 */
  function doConfirm() {
    resolveRef?.(true);
    resolveRef = null;
    open = false;
  }

  /** 取消確認 */
  function doCancel() {
    resolveRef?.(false);
    resolveRef = null;
    open = false;
  }

  /** 監聽 window custom event，接收外部 requestConfirm 派發的請求 */
  $effect(() => {
    function onConfirmRequest(e: Event) {
      const { message: msg, resolve } = (e as CustomEvent<ConfirmPayload>).detail;
      message = msg;
      resolveRef = resolve;
      open = true;
    }

    const eventName: ConfirmEventName = "confirm:request";
    window.addEventListener(eventName, onConfirmRequest);
    return () => window.removeEventListener(eventName, onConfirmRequest);
  });

  // ---

  /** 處理確認按鈕點擊事件 */
  function handleConfirmClick() {
    doConfirm();
  }

  /** 處理取消按鈕點擊事件 */
  function handleCancelClick() {
    doCancel();
  }

  // ---

  /** 處理 Modal 關閉事件（overlay 點擊、Escape） */
  function handleModalClose() {
    doCancel();
  }

  return {
    get open() { return open; },
    set open(v: boolean) { open = v; },
    get message() { return message; },
    handleConfirmClick,
    handleCancelClick,
    handleModalClose,
  };
}
```

#### Svelte 封裝（`ConfirmModal.svelte` 重寫）

```svelte
<script lang="ts">
  import Modal from "./Modal.svelte";
  import { createConfirmModal } from "$lib/client/confirmModal.svelte.js";

  const ui = createConfirmModal({});
</script>

<Modal bind:open={ui.open} onclose={ui.handleModalClose} label="確認對話框">
  {#snippet children()}
    <div class="modal-title">確認</div>
    <div class="modal-body">{ui.message}</div>
    <div class="modal-actions">
      <button class="btn" onclick={ui.handleCancelClick}>取消</button>
      <button class="btn btn-primary" onclick={ui.handleConfirmClick}>確認</button>
    </div>
  {/snippet}
</Modal>
```

#### 掛載點（`+layout.svelte`）

```svelte
<script lang="ts">
  import "$lib/styles/app.css";
  import favicon from "$lib/assets/favicon.svg";
  import Toast from "$lib/components/Toast.svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<Toast />
<ConfirmModal />
{@render children()}
```

### 2.3 呼叫端遷移

所有 `.svelte.ts` 中原本的：

```ts
function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    ctx.pendingConfirm = { message, resolve };
  });
}
```

改為：

```ts
import { requestConfirm } from "$lib/client/dom.js";
```

原本 `await confirmDialog(msg)` 改為 `await requestConfirm(msg)`。不再需要引用 ctx。

---

## 三、完整改動清單

### 新增檔案（3 個）

| 檔案 | 說明 |
|------|------|
| `src/lib/client/modal.svelte.ts` | Modal 無頭 UI（focus trap、Escape、overlay click） |
| `src/lib/client/confirmModal.svelte.ts` | ConfirmModal 無頭 UI（CustomEvent 監聽、open/message 狀態） |
| `src/lib/components/Modal.svelte` | 通用 Modal 元件（ARIA、Snippet children） |

### 重寫檔案（1 個）

| 檔案 | 改動 |
|------|------|
| `src/lib/components/ConfirmModal.svelte` | 完全重寫：移除所有 props，改用 Modal + createConfirmModal |

### 修改檔案（13 個）

| 檔案 | 改動 |
|------|------|
| `src/lib/types.ts` | 新增 `ConfirmEventName`、`ConfirmPayload` 型別 |
| `src/lib/client/dom.ts` | 新增 `requestConfirm()` 函式 |
| `src/routes/+layout.svelte` | 加掛 `<ConfirmModal />` |
| **Context（5 個）** | |
| `src/routes/editor/context.svelte.ts` | 刪除 `pendingConfirm` 屬性 |
| `src/routes/editor/[id]/context.svelte.ts` | 刪除 `pendingConfirm` 屬性 |
| `src/routes/trash/context.svelte.ts` | 刪除 `pendingConfirm` 屬性 |
| `src/routes/tagger/context.svelte.ts` | 刪除 `pendingConfirm` 屬性 |
| `src/routes/settings/context.svelte.ts` | 刪除 `pendingConfirm` 屬性 |
| **+page.svelte（5 個）** | |
| `src/routes/editor/+page.svelte` | 刪除 ConfirmModal import + `{#if ctx.pendingConfirm}` 區塊 |
| `src/routes/editor/[id]/+page.svelte` | 刪除 ConfirmModal import + `{#if ctx.pendingConfirm}` 區塊 |
| `src/routes/trash/+page.svelte` | 刪除 ConfirmModal import + `{#if ctx.pendingConfirm}` 區塊 |
| `src/routes/tagger/+page.svelte` | 刪除 ConfirmModal import + `{#if ctx.pendingConfirm}` 區塊 |
| `src/routes/settings/+page.svelte` | 刪除 ConfirmModal import + `{#if ctx.pendingConfirm}` 區塊 |

### 呼叫端遷移（6 處 `.svelte.ts`）

| 檔案 | 改動 |
|------|------|
| `src/routes/editor/editorSelectionDock.svelte.ts` | import `requestConfirm`，刪除 `confirmDialog` 函式，`await confirmDialog(...)` → `await requestConfirm(...)` |
| `src/routes/editor/[id]/editorPanel.svelte.ts` | 同上 |
| `src/routes/trash/trashSelectionDock.svelte.ts` | 同上 |
| `src/routes/trash/trashForm.svelte.ts` | 同上 |
| `src/routes/tagger/taggerPanel.svelte.ts` | 同上 |
| `src/routes/settings/settingsMaintenance.svelte.ts` | import `requestConfirm`，刪除 `confirm` 函式，`await confirm(...)` → `await requestConfirm(...)` |

### 不需要改動

- `src/lib/styles/app-basic.css` — `.modal-overlay`、`.modal`、`.modal-title` 等 CSS class 保持不變，Modal.svelte 直接沿用。

---

## 四、改動量統計

| 類型 | 數量 |
|------|------|
| 新增檔案 | 3 |
| 重寫檔案 | 1 |
| 修改檔案 | 13 |
| 總接觸檔案 | 17 |
| 刪除的重複程式碼 | ~70 行（5 × ~10 行 page boilerplate + 5 × ~1 行 context 屬性 + 6 × ~4 行 confirmDialog 函式） |
| 新增程式碼（Modal 基建） | ~120 行 |
| 淨變化 | 約 +50 行，但消除了所有重複 |

---

## 五、遷移前後對比

### Before（每個 +page.svelte 都需要）

```svelte
<!-- +page.svelte -->
<script>
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  // ...
</script>

{#if ctx.pendingConfirm}
  <ConfirmModal
    message={ctx.pendingConfirm.message}
    onconfirm={() => {
      ctx.pendingConfirm?.resolve(true);
      ctx.pendingConfirm = null;
    }}
    oncancel={() => {
      ctx.pendingConfirm?.resolve(false);
      ctx.pendingConfirm = null;
    }}
  />
{/if}
```

```ts
// context.svelte.ts
pendingConfirm = $state<{ message: string; resolve: (v: boolean) => void } | null>(null);
```

```ts
// anyComponent.svelte.ts
function confirmDialog(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    ctx.pendingConfirm = { message, resolve };
  });
}

const ok = await confirmDialog("確定嗎？");
```

### After（全域，零 boilerplate）

```ts
// anyComponent.svelte.ts
import { requestConfirm } from "$lib/client/dom.js";

const ok = await requestConfirm("確定嗎？");
```

完畢。+page.svelte 不需要任何 ConfirmModal 相關程式碼。Context 不需要 pendingConfirm 屬性。

---

## 六、注意事項

1. **CSS 零改動**：Modal.svelte 沿用現有 `app-basic.css` 中的 `.modal-overlay`、`.modal` 等 class，不新增 CSS。
2. **ARIA 完整性**：`role="dialog"` + `aria-modal="true"` + `aria-label` + focus trap + Escape 消費。
3. **向後相容**：若未來仍有元件需要宣告式 Modal（非 Confirm），直接使用 `<Modal>` + Snippet 即可，不需額外基建。
4. **與 Toast 統一範式**：`requestConfirm()` 與 `addToast()` 採完全相同的 CustomEvent 派發模式，學習成本為零。
