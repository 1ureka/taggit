# 計畫：把 guard 邏輯抽成 `$lib/utils/guard.svelte.ts`

## 現況

四個路由各有一份 `logic/guard.svelte.ts`，演算法本體 100% 相同：

| | `committed` | `staged` | `tags` | `tags/cleanup` |
|---|---|---|---|---|
| 相依 | submit, drafts, reverts, review | drafts, submit, deletion, importer, review | zones, submit, query, review | schedule, submit, query, review |
| `busy` | `submit.pending` | `submit.pending \|\| deletion.pending \|\| importer.pending` | `submit.pending \|\| query.refreshing` | `submit.pending \|\| query.refreshing` |
| 計數 | `review.totalCount` | `review.totalCount` | `review.totalCount` | `review.totalCount` |
| 標題 | 尚未提交的變更 | 尚未提交的變更 | 尚未送出的標籤操作 | 尚未送出的標籤操作 |
| 訊息 | 還有 N 張圖片的**變更**尚未提交… | 還有 N 張圖片的**暫存**尚未提交… | 還有 N 筆標籤操作尚未送出… | 還有 N 筆標籤操作尚未送出… |
| 放棄動作 | `drafts.handleDiscardAll()` + `reverts.handleUnmarkAll()` | `drafts.handleDiscardAll()` | `zones.handleClearAll()` | `schedule.handleClearAll()` |

完全一致、要整包搬走的部分：

1. `nav.type === "leave"` 早退
2. 用 `page.url.pathname`（不是 `location`）比對是否真的離開本頁，同址 `goto` 不攔
3. `busy` 時 `nav.cancel()` + `addToast({ message: "操作進行中，請稍候", variant: "info" })`
4. 計數為 0 直接放行
5. `nav.cancel()` → `requestConfirm(msg, { title, action: "離開" })` → 確認後放棄變更再 `goto(to.url.href)`
6. `handleBeforeUnload`：計數 > 0 或 busy 時 `preventDefault()` + `returnValue = ""`

`action: "離開"` 與 busy toast 文案四處相同 → 一併寫死在工具內。

`getGuardContext` 目前沒有任何子元件消費（只有 `+page.svelte` 用 `createGuardContext()` 的回傳值），但依決議保留對外形狀不變。

---

## 決議

| 項目 | 決定 |
|---|---|
| 抽出位置 | `src/lib/utils/guard.svelte.ts`（保留 `.svelte.ts` 後綴，未來要加 rune 不用改檔名） |
| 路由層 | 保留各路由 `logic/guard.svelte.ts` 當薄設定層，`createGuardContext()` / `getGuardContext()` 形狀不變 |
| busy toast | 寫死在工具內，不開參數 |
| 四個 `+page.svelte` | **零改動** |

類別名稱採 `NavigationGuard`（同 `virtualize.svelte.ts` 的 `Virtualizer`，不加 `Svelte` 前綴）。

---

## 步驟 1：新增 `src/lib/utils/guard.svelte.ts`

```ts
/**
 * @file guard.svelte.ts
 * 攔截離開頁面的導航，在有未提交變更時先跟使用者確認的通用工具
 */

import type { BeforeNavigate } from "@sveltejs/kit";
import { goto } from "$app/navigation";
import { page } from "$app/state";

import { addToast } from "$lib/components/floating/toast-events";
import { requestConfirm } from "$lib/components/widgets/confirm-events";

/** 建立離頁守衛的設定，狀態一律以 getter 傳入，確保事件當下才讀到最新值 */
export type NavigationGuardOptions = {
  /** 會真的改動資料或重跑查詢的操作是否進行中，true 時直接擋下導航並提示稍候 */
  busy: () => boolean;
  /** 尚未提交的變更筆數，0 代表可以直接離開 */
  count: () => number;
  /** 確認對話框標題 */
  title: string;
  /** 確認訊息，收到當下的變更筆數 */
  message: (count: number) => string;
  /** 使用者確認離開後，用來清掉所有未提交的變更 */
  discard: () => void;
};

/**
 * 離頁守衛：擋住會遺失未提交變更的導航，確認後才放行
 *
 * - `handleBeforeNavigate` 交給 `beforeNavigate()`
 * - `handleBeforeUnload` 交給 `<svelte:window onbeforeunload={...} />`
 * - 兩者都只能在 `+page.svelte` 註冊
 */
export class NavigationGuard {
  private options: NavigationGuardOptions;

  constructor(options: NavigationGuardOptions) {
    this.options = options;
  }

  handleBeforeNavigate = (nav: BeforeNavigate) => {
    if (nav.type === "leave") return;

    const to = nav.to;
    // 判斷來源頁必須用 page.url，popstate 時 location 已經是目標頁
    const leaving = to === null || to.url.pathname !== page.url.pathname;
    if (!leaving) return; // 自身的同址 goto（換頁／篩選／重新整理）不攔

    if (this.options.busy()) {
      nav.cancel(); // 避免 in-flight 續跑在新頁面上產生跨頁副作用
      addToast({ message: "操作進行中，請稍候", variant: "info" });
      return;
    }

    const count = this.options.count();
    if (count === 0) return;

    nav.cancel();
    if (to === null) return;

    requestConfirm(this.options.message(count), { title: this.options.title, action: "離開" }).then((confirmed) => {
      if (!confirmed) return;
      this.options.discard();
      goto(to.url.href);
    });
  };

  handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.options.count() > 0 || this.options.busy()) {
      e.preventDefault();
      e.returnValue = ""; // 部分瀏覽器需一併設定才會顯示離開確認
    }
  };
}
```

### 與原本的唯一行為差異

原本 `review.totalCount` 在「判斷是否為 0」與「組訊息」各讀一次，改成快照一次後共用。兩次讀取之間沒有 await，同步執行下結果必然相同。

---

## 步驟 2：四個路由改寫成設定層

四份檔案都變成同一個形狀，`class GuardController` 整個消失：

```ts
/**
 * @file guard.svelte.ts
 * 管理離頁守衛
 */

import { getContext, setContext } from "svelte";
import { NavigationGuard } from "$lib/utils/guard.svelte";

import { get<X>Context } from "./<x>.svelte";
// ...

const key = Symbol("guard-controller");

export const createGuardContext = () => {
  // getContext 必須在元件初始化期間呼叫，createGuardContext() 由 +page.svelte 同步呼叫，成立
  const submit = getSubmitContext();
  const review = getReviewContext();
  // ...

  const controller = new NavigationGuard({ /* 見下表 */ });
  setContext(key, controller);
  return controller;
};

export const getGuardContext = () => getContext<NavigationGuard>(key);
```

### 2-1 `src/routes/committed/logic/guard.svelte.ts`

```ts
const submit = getSubmitContext();
const drafts = getDraftsContext();
const reverts = getRevertMarkContext();
const review = getReviewContext();

const controller = new NavigationGuard({
  busy: () => submit.pending,
  count: () => review.totalCount,
  title: "尚未提交的變更",
  message: (n) => `還有 ${n} 張圖片的變更尚未提交，離開將會遺失這些修改。確定要離開？`,
  discard: () => {
    drafts.handleDiscardAll();
    reverts.handleUnmarkAll();
  },
});
```

順帶修正這支檔案錯誤的檔頭註解（現在寫 `@file guard.ts`）。

### 2-2 `src/routes/staged/logic/guard.svelte.ts`

```ts
const drafts = getDraftsContext();
const submit = getSubmitContext();
const deletion = getDeletionContext();
const importer = getImportContext();
const review = getReviewContext();

const controller = new NavigationGuard({
  busy: () => submit.pending || deletion.pending || importer.pending,
  count: () => review.totalCount,
  title: "尚未提交的變更",
  message: (n) => `還有 ${n} 張圖片的暫存尚未提交，離開將會遺失這些修改。確定要離開？`,
  discard: () => drafts.handleDiscardAll(),
});
```

### 2-3 `src/routes/tags/logic/guard.svelte.ts`

```ts
const zones = getZonesContext();
const submit = getSubmitContext();
const query = getQueryContext();
const review = getReviewContext();

const controller = new NavigationGuard({
  busy: () => submit.pending || query.refreshing,
  count: () => review.totalCount,
  title: "尚未送出的標籤操作",
  message: (n) => `還有 ${n} 筆標籤操作尚未送出，離開將會遺失這些排程。確定要離開？`,
  discard: () => zones.handleClearAll(),
});
```

### 2-4 `src/routes/tags/cleanup/logic/guard.svelte.ts`

同 2-3，只有第一個相依與 `discard` 不同：

```ts
const schedule = getScheduleContext();
// ...
  discard: () => schedule.handleClearAll(),
```

---

## 不做的事

- 不動四個 `+page.svelte`（`beforeNavigate(guard.handleBeforeNavigate)` 與 `<svelte:window onbeforeunload>` 維持原樣）
- 不移除 `getGuardContext`（雖然目前無人消費，屬於另一件事）
- 不改 `docs/svelte_kit_routes.md`（該文件只登錄 `search-params.svelte.ts`，`pagination` / `virtualize` 也未列入，維持一致）

---

## 驗證

- `npm run check`
- `npm run build`
- `npm run test`

程式碼淨減約 120 行（四份 × 約 45 行 → 四份 × 約 25 行 + 工具 70 行）。

### 需要人工驗收的項目

四個頁面（`/staged`、`/committed`、`/tags`、`/tags/cleanup`）各自確認：

1. 有未提交變更時點側邊欄離開 → 跳出確認框，文案與標題和改動前一致
2. 確認離開 → 變更被清掉且成功導航到目標頁
3. 取消 → 留在原頁，變更還在，網址列沒有被改掉
4. 瀏覽器上一頁／下一頁（popstate）同樣會被攔下（驗證 `page.url.pathname` 的判斷沒壞）
5. 送出／刪除／匯入／重新整理進行中時嘗試離開 → 出現「操作進行中，請稍候」toast 且不導航
6. 同頁操作（換頁、改篩選、按重新整理鈕）不會誤觸確認框
7. 有未提交變更時關閉分頁／重新整理瀏覽器 → 出現瀏覽器原生的離開確認
