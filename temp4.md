# `/committed` 頁面 — 實作計畫（取代 temp2.md）

> 這份文件是 [temp3.md](temp3.md)（互動與 UI 需求，已收斂完成）的實作對應，取代舊的 temp2.md。
>
> 跟舊版最大的差異在第 5 節：舊版 `SelectionController` 有一組醜陋的一對一代理方法（`handleApplyAddTags`／`handleApplyRemoveTags`／`handleSetRating`／`handleRevert`，全部只是轉呼叫 `editor` 對應方法並帶入 `selectedFiles`）。根本原因是舊版 `editor` 的草稿寫入方法只認單一 `filename`，導致 selection 得包一層轉接。這版把 `editor.svelte.ts` 的草稿寫入方法全部改成統一吃 `filenames: string[]`——單張編輯傳 `[file]`、批次選取傳 `selection.selectedFiles`，呼叫端（Inspector 或批次面板）直接呼叫 `getEditorContext()`，完全不經過 `SelectionController` 轉手。`SelectionController` 因此瘦身成只管選取集合本身，不再擁有任何寫入方法（本節末已與你確認此方向）。
>
> 另外在核對現有程式碼的過程中，發現並修正了兩個舊版沒處理到、但範圍上屬於這次改動一部分的問題：`problemOf` 沒有擋掉空白名稱（第 3 節），以及「committed 預設排序」跟「temp3.md 要求的沿用來源頁排序」之間有一個網址參數層級的衝突（第 1 節）。這兩點都不需要額外跟你確認方向，屬於單純的正確性修正。

## 1. 路由與資料流

### `+page.server.ts`

```ts
import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { Database } from "$lib/database";
import { Query } from "$lib/query";
import { parseCommittedQuery } from "./logic/query";

export const load: PageServerLoad = ({ url }) => {
  if (!Database.isLoaded()) throw redirect(303, "/settings?alert=error");
  const query = new Query(Database.requireLoaded());

  const base = parseCommittedQuery(url.searchParams);
  const { items, total } = query.images(base.with({ list: base.list.with({ limit: 0 }) }));

  return { items, total };
};
```

`limit: 0` 全量載入，比照 `/compare`／`/staged`（不分頁，前端虛擬化捲動足以應付）。

### `logic/query.ts`（新檔案，純函式，供 server 與 client 共用）

```ts
/**
 * @file query.ts
 * /committed 專屬的查詢條件解析：沒有明確指定排序時，預設改用「提交時間 desc」
 * （管理情境下新提交的圖片更可能需要處理；其餘頁面維持 ImageQuery 全域預設的 rating desc）
 */
import { ImageQuery } from "$lib/query-spec";

export function parseCommittedQuery(params: URLSearchParams): ImageQuery {
  const base = ImageQuery.fromSearchParams(params);
  if (params.has("sort")) return base;
  return base.with({ list: base.list.with({ sort: "committedAt", order: "desc" }) });
}
```

`logic/filter.svelte.ts`（client 端）的 `syncedQuery` 也要用同一個 `parseCommittedQuery`，不能各自各的：

```ts
private synced = syncedQuery(parseCommittedQuery);
```

**為什麼要拆出這個共用函式，而不是各自寫一次判斷**：`ImageQuery.toSearchParams()`（`$lib/query-spec/image-query.ts:39-47`）為了精簡網址，排序等於全域預設（`rating desc`）時**不會**寫進查詢字串。這代表「網址沒有 `sort` 參數」本身沒辦法區分「使用者真的從沒設定過」跟「使用者在來源頁面剛好就是用 rating 排序」——兩種情況產生的網址一模一樣。如果只在 `+page.server.ts` 這邊土法加預設值，會出現一個實際的衝突：[temp3.md 第 1 節](temp3.md#1-進入方式) 明確要求「進入本頁時沿用來源頁當下的篩選/排序條件」，但如果來源頁（compare 或 home）當下剛好是用預設的 rating 排序，它們組出的深連結就不會帶 `sort` 參數，於是這裡的「沒帶 sort 就用 committedAt」邏輯會誤判成「使用者沒有來源頁」，把使用者原本在瀏覽的 rating 排序意圖悄悄換成 committedAt——不會報錯、不會有警告，跟 `docs/svelte_kit_routes.md` 開頭提到的那種靜默覆蓋是同一類問題。

修法是讓兩個深連結來源改成**離開時一律明確帶上目前的 sort/order**，不依賴 `toSearchParams()` 的精簡行為：

- `(home)/logic/detail.svelte.ts` 的 `editorHref`：

  ```ts
  editorHref = $derived.by(() => {
    if (!this.record) return "/committed";
    const params = this.filter.query.toSearchParams();
    params.set("sort", this.filter.query.list.sort);
    params.set("order", this.filter.query.list.order);
    params.set("currentId", this.record.id);
    return `/committed?${params.toString()}`;
  });
  ```

  同時把 `/editor` 修正為 `/committed`——這是既有 bug（該路由本來就不存在），[temp3.md 第 1 節](temp3.md#1-進入方式) 已提到要一併修正。

- `compare/cards/CardInfo.svelte` 的 `href`（需額外 `import { getFilterContext } from "../logic/filter.svelte"`）：

  ```ts
  const filter = getFilterContext();
  const href = $derived.by(() => {
    const params = new URLSearchParams(page.url.searchParams);
    params.delete("pinned");
    params.set("sort", filter.query.list.sort);
    params.set("order", filter.query.list.order);
    params.set("currentId", record.id);
    return `/committed?${params.toString()}`;
  });
  ```

如此一來，`parseCommittedQuery` 的「沒有 `sort` 參數就用 committedAt」只會在真的沒有來源頁、從導覽列直接進入時生效，兩個深連結永遠明確帶著自己的排序，不會被誤判。

### `currentId`：淺路由同步

跟 compare 的 `pinned`、home 的 `modal` 同一套模式（`replaceState`，不觸發 `load` 重跑），細節見第 4 節 `EditorController`。

`(layout)/ModalTrigger.svelte`（`src/routes/(layout)/ModalTrigger.svelte:21`）已經有一句 TODO 承認淺路由後可能讀到過期的 `currentId`，這是全站共通的 `page.url` vs `location` 落差，不在這次處理範圍（[temp3.md 第 8 節](temp3.md#8-明確不做)已確認）。

---

## 2. 檔案樹

```
routes/committed/
├── +page.server.ts
├── +page.svelte
├── header/
│   ├── Toolbar.svelte            # <Filters /> + <Actions />，版面比照 compare
│   ├── Filters.svelte            # 搬 compare 版本（搜尋 + 排序 + 篩選彈出視窗）
│   ├── FilterButton.svelte       # 搬 compare 版本
│   ├── FilterPopover.svelte      # 搬 compare 版本
│   └── Actions.svelte            # 重新整理 + 批次選取切換鈕 + 檢視待提交的變更 (N)
├── cards/
│   ├── Cards.svelte              # masonry virtualizer；批次選取模式開啟時在卡片牆上方渲染 BatchBar
│   ├── Card.svelte               # 四態外觀；點擊行為依 selection.active 分支
│   ├── CardInfo.svelte           # 有草稿用草稿欄位，沒草稿直接顯示伺服器資料
│   ├── config.ts                 # 沿用 staged（breakpoints / CARD_SIZE / INSPECTOR_WIDTH）
│   └── batch/
│       ├── BatchBar.svelte           # 常駐列本體：全選 + 三個觸發鈕 + 標記退回 + 結束批次選取
│       ├── BatchRatingMenu.svelte    # 評等，Menu + 手刻 Button 觸發鈕
│       └── BatchTagAction.svelte     # 加標籤／去標籤共用（mode: "add" | "remove"），Popover + TagInput + 套用按鈕
├── inspector/
│   ├── Inspector.svelte          # 沿用 staged 版面
│   ├── InspectorHeader.svelte    # 沿用（檔名 + X/Y 指標 + 關閉鈕）
│   ├── InspectorFields.svelte    # kind === "edit" 顯示可編輯欄位；kind === "revert" 顯示唯讀摘要
│   ├── InspectorFooter.svelte    # 見第 4 節：兩顆按鈕共用同一個 handleDiscardDraft
│   └── Lightbox.svelte           # 沿用 staged，前後張導覽改用 pageData.value.items
├── review/
│   ├── ReviewModal.svelte        # 沿用 staged
│   ├── ReviewHeader.svelte       # 沿用
│   ├── ReviewList.svelte         # 沿用（全選/勾選邏輯不變）
│   ├── ReviewListItem.svelte     # 依 entry.kind 分支：edit 用 TagChipList 呈現 diff；revert 用 kind 徽章
│   ├── ReviewImpact.svelte       # skeleton 用自己的 CSS；debounce 查詢；標籤呈現同樣用 TagChipList
│   ├── TagChipList.svelte        # 新增：+/− 標籤 chip 列表，超過 max 收斂成 +N/−N，見第 7 節
│   └── ReviewFooter.svelte       # 沿用
└── logic/
    ├── page-data.svelte.ts       # 沿用（context 包 load 的 data）
    ├── query.ts                  # 新增：parseCommittedQuery，見第 1 節
    ├── filter.svelte.ts          # 幾乎照搬 compare 版本，parse 改用 parseCommittedQuery
    ├── operations.svelte.ts      # 沿用 staged 版本（pending 鎖 + 重新整理）
    ├── editor.svelte.ts          # 草稿 CRUD（統一吃 filenames[]）+ currentId 淺路由同步 + 離頁守衛
    ├── draft.ts                  # Draft/Baseline 型別、problemOf/isTouched/tagDiff、commitDrafts
    ├── selection.svelte.ts       # 純選取狀態：ids/active/衍生候選，不含任何寫入方法
    ├── review.svelte.ts          # 審查清單 + 標籤影響評估（debounce 查詢）
    ├── review-entry.ts           # ReviewEntry discriminated union（edit/revert）
    └── lightbox.svelte.ts        # 沿用 staged，files 來源改 pageData.value.items 的 id
```

不做 staged 的圖章模式（`stamp.svelte.ts`／`StampBadge.svelte`）——第 5 節的批次選取已經涵蓋同樣的需求，兩者不並存（[temp3.md 第 8 節](temp3.md#8-明確不做)已確認）。

---

## 3. 草稿資料模型（`logic/draft.ts`）

跟 staged 最關鍵的差異：**staged 的草稿是「從空白填到有值」，committed 的草稿是「從既有值改成新值」**，因此每份草稿都要挾帶一份 baseline（建立草稿當下的原始快照）：

```ts
/**
 * @file draft.ts
 * 已提交圖片的本地草稿：型別、驗證與批次提交
 */
import { api } from "$lib/utils/request";

/** 建立草稿當下的原始快照，用於 diff 呈現與樂觀併發檢查 */
export type Baseline = { name: string; rating: number; tags: string[]; updatedAt: number };

/** 每張已提交圖片的本地草稿；沒有草稿代表「一般」狀態，直接顯示伺服器資料，revert 會蓋掉先前的欄位編輯（兩者互斥） */
export type Draft =
  | { kind: "edit"; baseline: Baseline; name: string; rating: number; tags: string[] }
  | { kind: "revert"; baseline: Baseline };

export function baselineOf(record: { name: string; rating: number; tags: string[]; updatedAt: number }): Baseline {
  return { name: record.name, rating: record.rating, tags: record.tags, updatedAt: record.updatedAt };
}

function sameTagSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((t) => set.has(t));
}

/** 草稿是否偏離 baseline（revert 恆為 true） */
export function isTouched(d: Draft): boolean {
  if (d.kind === "revert") return true;
  return (
    d.name.trim() !== d.baseline.name.trim() ||
    d.rating !== d.baseline.rating ||
    !sameTagSet(d.tags, d.baseline.tags)
  );
}

/** 這份草稿還不能提交的原因；revert 沒有欄位驗證，恆可提交 */
export function problemOf(d: Draft): string | null {
  if (d.kind === "revert") return null;
  // 不同於 staged：committed 沒有「留空 = 沿用檔名」的 fallback，
  // 伺服器端 Validator.name（$lib/mutation/validator.ts:29）要求非空字串，這裡要提前擋掉
  if (d.name.trim().length === 0) return "名稱不可為空";
  if (d.name.length > 200) return "名稱不可超過 200 字元";
  if (d.tags.length === 0) return "至少需要一個標籤";
  for (const t of d.tags) {
    if (t.trim().length === 0) return "標籤不可為空";
    if (t.trim().length > 50) return `標籤「${t}」不可超過 50 字元`;
    if (t.includes(",")) return `標籤「${t}」不可包含逗號`;
  }
  return null;
}

/** 標籤集合的新增/移除差集，供 diff 呈現使用 */
export function tagDiff(baseline: string[], next: string[]): { added: string[]; removed: string[] } {
  const before = new Set(baseline);
  const after = new Set(next);
  return { added: next.filter((t) => !before.has(t)), removed: baseline.filter((t) => !after.has(t)) };
}
```

沒有草稿的卡片直接顯示伺服器回傳的 `ImageWithId`，不像 staged 需要一份共用 `EMPTY_DRAFT` 佔位——委託頁面的資料本來就有值可顯示。

### `commitDrafts`

```ts
type CommittedBatchItem =
  | { id: string; op?: "update"; name?: string; tags?: string[]; rating?: number; expectedUpdatedAt: number }
  | { id: string; op: "revert" };

export async function commitDrafts(entries: { filename: string; draft: Draft }[]): Promise<Map<string, string>> {
  const items: CommittedBatchItem[] = entries.map(({ filename, draft }) =>
    draft.kind === "revert"
      ? { id: filename, op: "revert" }
      : {
          id: filename,
          name: draft.name.trim(),
          tags: draft.tags,
          rating: draft.rating,
          expectedUpdatedAt: draft.baseline.updatedAt,
        },
  );

  const res = await api.post<{ results: { id: string; ok: boolean; error?: string }[] }>(
    "/api/proto/committed-batch",
    { items },
  );
  if (!res.ok || !res.data) throw new Error(res.error || "提交失敗");

  const failures = new Map<string, string>();
  for (const r of res.data.results) if (!r.ok) failures.set(r.id, r.error ?? "未知錯誤");
  return failures;
}
```

`revert` 項目不帶 `expectedUpdatedAt`：伺服器端 `Mutation.removeRecord`（`$lib/mutation/image.ts` 的 `remove()`）本來就沒有樂觀併發檢查，跟 compare 頁面既有的單筆 `DELETE /api/committed/[filename]` 行為一致，不在這次擴大範圍。

---

## 4. `editor.svelte.ts`：草稿 CRUD、統一的批次寫入介面、目前編輯中的圖片

這是本次相對舊版 temp2.md 的核心修正所在。

### 統一介面：所有草稿寫入方法都吃 `filenames: string[]`

不再區分「單張」與「批次」兩套方法。單張編輯（Inspector 的「標記退回」按鈕）傳 `[file]`；批次操作（BatchBar 的三個面板）傳 `selection.selectedFiles`；呼叫端完全相同，不需要 `SelectionController` 代為轉接。

還有一個額外的收斂：Inspector 裡「還原草稿」（編輯模式下把欄位改回 baseline）跟「取消退回」（退回模式下取消標記）在底層其實是同一個動作——都是「整個刪掉這張圖目前的草稿」，回到毫無草稿的初始狀態。因此這兩顆按鈕共用同一個 `handleDiscardDraft`，UI 只依 `draft.kind` 換文字，不需要兩個不同名字的方法，也不需要記住「退回前打到一半的欄位內容」（標記退回時直接蓋掉先前編輯，取消退回後也直接回到 baseline，不嘗試恢復）。這個方法還有第三個呼叫點：提交成功後清掉已送出檔名的草稿（見第 9 節），同樣是「刪掉草稿回到一般狀態」，語意完全一致。

```ts
/**
 * @file editor.svelte.ts
 * 已提交圖片的草稿本地狀態、統一的批次寫入方法、目前編輯中的圖片（含 currentId 淺路由同步）、離頁守衛
 */
import type { BeforeNavigate } from "@sveltejs/kit";
import { getContext, setContext, untrack } from "svelte";
import { goto, replaceState } from "$app/navigation";
import { page } from "$app/state";

import { addToast } from "$lib/components/floating/toast-events";
import { requestConfirm } from "$lib/components/widgets/confirm-events";

import { baselineOf, isTouched, type Baseline, type Draft } from "./draft";
import { getPageDataContext } from "./page-data.svelte";
import { getOperationsContext } from "./operations.svelte";

class EditorController {
  private pageData = getPageDataContext();
  private operations = getOperationsContext();

  /** 每張已提交圖片的本地草稿，key 不存在 = 該圖片目前是「一般」狀態 */
  private drafts = $state<Record<string, Draft>>({});
  /** 圖片被篩出目前可視範圍、但仍持有草稿時，供 ensureDraft 取用的 baseline 備份 */
  private knownBaselines: Record<string, Baseline> = {};

  private get files() {
    return this.pageData.value.items.map((r) => r.id);
  }

  private echo = untrack(() => page.url.searchParams.get("currentId"));
  private activeState = $state(this.echo);

  /** 被編輯過的檔名，不依賴目前篩選可見清單（見下方說明） */
  touchedFiles = $derived(Object.keys(this.drafts).filter((f) => isTouched(this.drafts[f])));
  /** 目前編輯中的圖片；篩選/排序改變導致它不在可視範圍時自動回落為 null */
  activeFile = $derived(this.activeState !== null && this.files.includes(this.activeState) ? this.activeState : null);
  /** 目前編輯中圖片在目前篩選結果內的指標（1-based） */
  activeIndex = $derived(this.activeFile !== null ? this.files.indexOf(this.activeFile) + 1 : 0);
  /** 目前篩選結果的總數 */
  total = $derived(this.files.length);
  /** 目前編輯中的草稿；Inspector 以此決定顯示可編輯欄位或唯讀摘要 */
  activeDraft = $derived(this.activeFile !== null ? this.drafts[this.activeFile] : undefined);

  /** 指定檔名的草稿，沒有草稿代表「一般」狀態（呼叫端改讀伺服器資料顯示） */
  draftOf = (filename: string): Draft | undefined => this.drafts[filename];

  /** 指定檔名目前「生效」的標籤（有草稿用草稿，revert 視為空，沒草稿用伺服器資料），供批次去標籤候選使用 */
  effectiveTagsOf = (filename: string): string[] => {
    const d = this.drafts[filename];
    if (d?.kind === "edit") return d.tags;
    if (d?.kind === "revert") return [];
    return this.pageData.value.items.find((r) => r.id === filename)?.tags ?? [];
  };

  private ensureDraft(filename: string): Draft {
    const existing = this.drafts[filename];
    if (existing) return existing;
    const record = this.pageData.value.items.find((r) => r.id === filename);
    const baseline = record ? baselineOf(record) : this.knownBaselines[filename];
    this.knownBaselines[filename] = baseline;
    const next: Draft = { kind: "edit", baseline, name: baseline.name, rating: baseline.rating, tags: [...baseline.tags] };
    this.drafts[filename] = next;
    return next;
  }

  // --- 統一的草稿寫入介面：單張傳 [file]，批次傳 selection.selectedFiles，呼叫端相同 ---

  /** 對指定檔名新增標籤（自動去重、忽略空白），revert 中的草稿略過 */
  handleAddTags = (filenames: string[], tags: string[]) => {
    const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
    if (clean.length === 0) return;
    for (const f of filenames) {
      const d = this.ensureDraft(f);
      if (d.kind === "revert") continue;
      this.drafts[f] = { ...d, tags: [...new Set([...d.tags, ...clean])] };
    }
  };

  /** 對指定檔名移除標籤，revert 中的草稿略過 */
  handleRemoveTags = (filenames: string[], tags: string[]) => {
    const set = new Set(tags.map((t) => t.trim()).filter(Boolean));
    if (set.size === 0) return;
    for (const f of filenames) {
      const d = this.ensureDraft(f);
      if (d.kind === "revert") continue;
      this.drafts[f] = { ...d, tags: d.tags.filter((t) => !set.has(t)) };
    }
  };

  /** 對指定檔名設定評等，revert 中的草稿略過 */
  handleSetRating = (filenames: string[], rating: number) => {
    for (const f of filenames) {
      const d = this.ensureDraft(f);
      if (d.kind === "revert") continue;
      this.drafts[f] = { ...d, rating };
    }
  };

  /** 標記指定檔名為「退回暫存區」，會直接蓋掉該檔名目前的任何欄位編輯 */
  handleMarkRevert = (filenames: string[]) => {
    for (const f of filenames) {
      const baseline =
        this.drafts[f]?.baseline ??
        this.knownBaselines[f] ??
        baselineOf(this.pageData.value.items.find((r) => r.id === f)!);
      this.drafts[f] = { kind: "revert", baseline };
    }
  };

  /**
   * 捨棄指定檔名目前的草稿，回到「一般」狀態。
   * Inspector 的「還原草稿」（kind === "edit"）與「取消退回」（kind === "revert"）都呼叫這同一個方法，
   * UI 只依 draft.kind 決定按鈕文字；提交成功後清掉已送出檔名的草稿（見第 9 節）也是同一個方法。
   */
  handleDiscardDraft = (filenames: string[]) => {
    for (const f of filenames) delete this.drafts[f];
  };

  // --- 目前編輯中的圖片：導覽 + currentId 淺路由同步 ---

  constructor() {
    $effect(() => {
      // 上一頁/下一頁或其他外部原因造成 URL 的 currentId 參數變動時
      const urlId = page.url.searchParams.get("currentId");
      if (urlId !== this.echo) this.activeState = urlId;
      this.echo = urlId;
    });
  }

  private commit(id: string | null) {
    this.activeState = id;
    this.echo = id;
    const params = new URLSearchParams(location.search); // 不是 page.url，理由見 docs/svelte_kit_routes.md
    if (id) params.set("currentId", id);
    else params.delete("currentId");
    const qs = params.toString();
    replaceState(`${location.pathname}${qs ? `?${qs}` : ""}`, page.state);
  }

  /** 開啟指定檔名的編輯面板 */
  handleSelect = (filename: string) => {
    this.ensureDraft(filename);
    this.commit(filename);
  };

  /** 關閉編輯面板 */
  handleClose = () => {
    if (this.activeState === null) return;
    this.commit(null);
  };

  private navigate(delta: number) {
    if (this.activeFile === null) return;
    const idx = this.files.indexOf(this.activeFile);
    const next = Math.min(this.files.length - 1, Math.max(0, idx + delta));
    this.commit(this.files[next]);
  }

  /** 編輯面板：上一張 */
  handlePrev = () => this.navigate(-1);
  /** 編輯面板：下一張 */
  handleNext = () => this.navigate(1);

  // --- 離頁守衛 ---

  handleBeforeNavigate = (nav: BeforeNavigate) => {
    if (nav.type === "leave") return;

    const to = nav.to;
    const leaving = to === null || to.url.pathname !== page.url.pathname;
    if (!leaving) return; // 自身的同址 goto with invalidate 不攔

    if (this.operations.pending) {
      nav.cancel();
      addToast({ message: "操作進行中，請稍候", variant: "info" });
      return;
    }

    if (this.touchedFiles.length === 0) return;

    nav.cancel();
    if (to === null) return;

    const msg = `還有 ${this.touchedFiles.length} 張圖片的變更尚未提交，離開將會遺失這些修改。確定要離開？`;
    requestConfirm(msg, { title: "尚未提交的變更", action: "離開" }).then((confirmed) => {
      if (!confirmed) return;
      this.drafts = {};
      goto(to.url.href);
    });
  };

  handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (this.touchedFiles.length > 0 || this.operations.pending) {
      e.preventDefault();
      e.returnValue = "";
    }
  };
}

const key = Symbol("editor-controller");

export const createEditorContext = () => {
  const controller = new EditorController();
  setContext(key, controller);
  return controller;
};

export const getEditorContext = () => getContext<EditorController>(key);
```

`touchedFiles` 用 `Object.keys(this.drafts)` 而不是「目前篩選可見清單」去 derive：committed 的 `this.files`（`pageData.value.items`）只代表這次篩選/排序下可見的圖片，換一次篩選條件就可能讓已編輯的圖片暫時消失於可見清單，`touchedFiles` 因此要跟可見清單脫鉤；但 `activeFile`／`activeIndex`／`total` 這幾個「編輯面板導覽用」的指標則刻意維持跟可見清單綁定——選取的圖片被篩出可視範圍時自動回落成 `null`，這是編輯面板「上一張/下一張」導覽的合理行為。

### Inspector 單張欄位編輯：維持直接綁定，不經過上面的批次方法

`InspectorFields.svelte` 對名稱／評等／標籤欄位的編輯，做法跟 staged 完全一樣：直接 `bind:value={draft.name}`、`bind:value={draft.rating}`、`bind:tags={draft.tags}`，因為 `activeDraft` 是 `$state` record 裡的即時參照，直接改欄位就是即時寫入。這幾個欄位不需要、也不應該透過 `handleSetRating`／`handleAddTags` 這類批次方法——那些是「一次套用到 N 張圖」的動作，跟「使用者正在對這一張圖打字」是不同性質的操作，維持兩條路徑分開才是真正的正交，而不是為了「統一」把逐字元輸入也包成方法呼叫。

`InspectorFooter.svelte`：

```svelte
<script lang="ts">
  const editor = getEditorContext();
  const file = $derived(editor.activeFile);
  const draft = $derived(editor.activeDraft);
</script>

{#if file !== null && draft}
  {#if draft.kind === "edit"}
    <Button variant="outlined" onclick={() => editor.handleDiscardDraft([file])}>還原草稿</Button>
    <Button variant="destructive" onclick={() => editor.handleMarkRevert([file])}>退回暫存區</Button>
  {:else}
    <Button variant="outlined" onclick={() => editor.handleDiscardDraft([file])}>取消退回</Button>
    <p>送出後這筆紀錄會消失、檔案回到暫存區。</p>
  {/if}
{/if}
```

---

## 5. `selection.svelte.ts`：純選取狀態

跟舊版最大的不同：這裡不再有任何草稿寫入方法。批次面板（見第 6 節）直接呼叫 `getEditorContext()`，`SelectionController` 只管選取集合本身跟幾個唯讀衍生投影。

```ts
/**
 * @file selection.svelte.ts
 * 批次選取模式：選取集合本身與衍生的唯讀投影。不擁有任何草稿寫入邏輯——
 * 寫入一律由呼叫端（batch/ 底下三個面板元件）直接呼叫 editor 的 handle* 方法。
 */
import { getContext, setContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import { getPageDataContext } from "./page-data.svelte";
import { getEditorContext } from "./editor.svelte";

class SelectionController {
  private pageData = getPageDataContext();
  private editor = getEditorContext();

  /** 批次選取模式是否開啟 */
  active = $state(false);
  private ids = new SvelteSet<string>();

  /** 目前選取的檔名列表 */
  selectedFiles = $derived([...this.ids]);
  /** 目前選取張數 */
  count = $derived(this.ids.size);
  isSelected = (filename: string) => this.ids.has(filename);

  /** 全選 checkbox 的三態，對應目前篩選結果 */
  allSelectedState = $derived.by(() => {
    const total = this.pageData.value.items.length;
    if (total === 0 || this.count === 0) return "unchecked" as const;
    if (this.count === total) return "checked" as const;
    return "indeterminate" as const;
  });

  /** 「去標籤」面板的候選：選取範圍內至少一張圖片目前真的有的標籤（含尚未送出的草稿異動） */
  removableTagCandidates = $derived.by(() => {
    const set = new Set<string>();
    for (const f of this.selectedFiles) for (const t of this.editor.effectiveTagsOf(f)) set.add(t);
    return [...set];
  });

  handleToggleMode = () => {
    this.active = !this.active;
    if (!this.active) this.ids.clear();
  };

  handleToggle = (filename: string) => {
    if (this.ids.has(filename)) this.ids.delete(filename);
    else this.ids.add(filename);
  };

  handleToggleAllVisible = () => {
    const allIds = this.pageData.value.items.map((r) => r.id);
    const allSelected = allIds.length > 0 && allIds.every((id) => this.ids.has(id));
    for (const id of allIds) {
      if (allSelected) this.ids.delete(id);
      else this.ids.add(id);
    }
  };
}

const key = Symbol("selection-controller");

export const createSelectionContext = () => {
  const controller = new SelectionController();
  setContext(key, controller);
  return controller;
};

export const getSelectionContext = () => getContext<SelectionController>(key);
```

`removableTagCandidates` 讀 `editor.effectiveTagsOf` 是「讀」不是「寫」，跟這次要拆掉的代理寫入方法是不同性質——多個 controller 互相讀取對方的衍生狀態是這個架構本來就允許、甚至鼓勵的做法（`docs/svelte_kit_routes.md` 也提到「子組件可能拿 A 上下文的狀態投影，但事件傳給 B 上下文」），要拆的是「A 只是把呼叫原封不動轉給 B」這種零附加價值的寫入代理。

---

## 6. 批次選取 UI（`cards/batch/`）

### 版面歸屬

[temp3.md 第 5 節](temp3.md#5-批次編輯) 確認：常駐列要跟卡片牆同容器、不隨卡片牆內部捲動、寬度＝卡片牆欄位寬度。做法是把它放進 `Cards.svelte` 自己的根容器裡，跟現有可捲動的 `<section>` 同層、但在它前面：

```svelte
<!-- cards/Cards.svelte -->
<div class="container">
  {#if selection.active}
    <BatchBar />
  {/if}
  <section aria-label="已提交清單" bind:this={masonry.viewportEl}>
    ...
  </section>
</div>
```

```css
div.container { display: flex; flex-direction: column; }
div.container > section { flex: 1; min-height: 0; overflow-y: auto; }
```

`BatchBar` 因此天然只佔卡片牆欄位的寬度（不含 Inspector），且不隨 `<section>` 內部捲動。卡片牆容器不需要因為批次模式而換外觀（不同於 staged 圖章模式的整片條紋背景），`BatchBar` 本身已經夠顯眼（[temp3.md 第 5 節](temp3.md#5-批次編輯) 已確認）。

### `BatchBar.svelte`

同時匯入兩個 context，三個動作各自直接呼叫 `editor`：

```svelte
<script lang="ts">
  import { getEditorContext } from "../../logic/editor.svelte";
  import { getSelectionContext } from "../../logic/selection.svelte";

  const editor = getEditorContext();
  const selection = getSelectionContext();
</script>

<div class="bar">
  <Checkbox
    checked={selection.allSelectedState === "checked"}
    indeterminate={selection.allSelectedState === "indeterminate"}
    onchange={selection.handleToggleAllVisible}
  />
  <span>已選取 {selection.count} 張</span>

  <BatchRatingMenu />
  <BatchTagAction mode="add" />
  <BatchTagAction mode="remove" />

  <Button
    variant="destructive"
    status={selection.count === 0 ? "disabled" : undefined}
    onclick={() => editor.handleMarkRevert(selection.selectedFiles)}
  >
    標記退回
  </Button>

  <Button variant="ghost" onclick={selection.handleToggleMode}>結束批次選取</Button>
</div>
```

### `BatchRatingMenu.svelte`

三顆觸發鈕外觀完全一致、不因為使用過而改變（[temp3.md 第 5 節](temp3.md#5-批次編輯) 已確認），實作上直接照抄本專案既有 `Menu.svelte` 標準用法（參考 `menu-keyboard/+page.svelte` 的 profile menu 寫法：手刻 `Button` 觸發鈕 + `Menu` 的 `items` 用 `{type:"button", content:{render, props}, props:{onclick}}`）：

```svelte
<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import Menu from "$lib/components/floating/Menu.svelte";
  import { IconChevronDown, IconStarFilled } from "$lib/icons";
  import { getEditorContext } from "../../logic/editor.svelte";
  import { getSelectionContext } from "../../logic/selection.svelte";

  const editor = getEditorContext();
  const selection = getSelectionContext();
  const id = $props.id();

  let open = $state(false);
  let anchor = $state<HTMLElement>();

  const items = [1, 2, 3, 4, 5].map((n) => ({
    type: "button" as const,
    content: { render: ratingRow, props: { n } },
    props: {
      onclick: () => {
        editor.handleSetRating(selection.selectedFiles, n);
        open = false;
      },
    },
  }));
</script>

{#snippet ratingRow({ n }: { n: number })}
  <IconStarFilled size={14} />
  <span>{n}</span>
{/snippet}

<div bind:this={anchor}>
  <Button
    id="{id}-trigger"
    onclick={() => (open = !open)}
    aria-expanded={open}
    status={selection.count === 0 ? "disabled" : undefined}
  >
    <span>評等</span>
    <span class="chevron" class:open><IconChevronDown size={14} /></span>
  </Button>
</div>

<Menu id="{id}-menu" labelledBy={{ triggerId: "{id}-trigger" }} {open} reference={anchor} {items} onclose={() => (open = false)} />
```

### `BatchTagAction.svelte`（`mode: "add" | "remove"`）

觸發鈕是同一套手刻 `Button` + chevron 寫法，點下去開的是 `Popover` + `TagInput` + 一顆「套用」按鈕。`TagInput` 綁定的標籤陣列是**元件自己的本地狀態**，跟任何圖片草稿無關；只有按下套用，才把當下面板裡的整份標籤清單一次呼叫 `editor` 對應方法：

```svelte
<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import Popover from "$lib/components/floating/Popover.svelte";
  import TagInput from "$lib/components/widgets/TagInput.svelte";
  import { IconChevronDown } from "$lib/icons";
  import { getEditorContext } from "../../logic/editor.svelte";
  import { getSelectionContext } from "../../logic/selection.svelte";

  let { mode }: { mode: "add" | "remove" } = $props();

  const editor = getEditorContext();
  const selection = getSelectionContext();

  let open = $state(false);
  let anchor = $state<HTMLElement>();
  let draftTags = $state<string[]>([]); // 面板自己的暫存清單，關閉不套用就作廢

  const label = mode === "add" ? "新增標籤" : "去除標籤";

  function handleOpen() {
    draftTags = [];
    open = true;
  }
  function handleApply() {
    if (mode === "add") editor.handleAddTags(selection.selectedFiles, draftTags);
    else editor.handleRemoveTags(selection.selectedFiles, draftTags);
    open = false;
  }
</script>

<div bind:this={anchor}>
  <Button onclick={handleOpen} aria-expanded={open} status={selection.count === 0 ? "disabled" : undefined}>
    <span>{label}</span>
    <span class="chevron" class:open><IconChevronDown size={14} /></span>
  </Button>
</div>

<Popover {open} reference={anchor} placement="bottom-start">
  <div class="panel">
    <TagInput
      bind:tags={draftTags}
      chipsPlacement="below"
      candidates={mode === "remove" ? selection.removableTagCandidates : undefined}
      label={label}
    />
    <Button variant="primary" onclick={handleApply} status={draftTags.length === 0 ? "disabled" : undefined}>
      套用
    </Button>
  </div>
</Popover>
```

點擊面板外部關閉、不套用（沿用 `FilterPopover.svelte` 既有的 window click 判斷寫法）。`candidates` 只在 `mode === "remove"` 時傳，`mode === "add"` 維持 `TagInput` 原本查全庫標籤的行為（可以打全新的標籤名稱）。

---

## 7. `TagInput.svelte` 新增兩個 prop

核對過現有原始碼（`src/lib/components/widgets/TagInput.svelte`）：目前只有 `tags`／`label`／`labelHidden`／`placeholder`／`scope`／`onchange`，候選永遠是元件自己 debounce 呼叫 `/api/tags`（用 `scope` 這個 `ImageWhere` 查詢字串限定範圍）查回來的。「去標籤」要求候選限定在「選取範圍內至少一張圖片目前真的有」的標籤，這個集合完全來自本地已載入/草稿中的資料，`scope`（`ImageWhere`）沒有「id 在某個清單內」這種篩法可以表達，因此需要新增：

```ts
type Props = {
  tags: string[];
  label: string;
  labelHidden?: boolean;
  placeholder?: string;
  scope?: string;
  /** chip 清單相對於輸入框的堆疊方向，預設 "above"（維持現有行為） */
  chipsPlacement?: "above" | "below";
  /** 提供時直接用這份清單當候選（僅依輸入字串本地過濾），不打 /api/tags 查詢 */
  candidates?: string[];
  onchange?: (tags: string[]) => void;
};
```

### `chipsPlacement`

Markup 依此決定 chips 區塊渲染在 `<Combo>` 之前還是之後；`"above"` 時完全就是目前的 DOM 順序，不影響既有呼叫端（staged Inspector、compare 進階篩選、`/tags` 系列頁面）的外觀。`"below"` 只有批次標籤面板在用——輸入框固定在上緣，chip 往下長，符合連續輸入時輸入框不跳動的需求（[temp3.md 第 5 節](temp3.md#5-批次編輯) 已確認）。

### `candidates`

提供時整個跳過現有的 `runQuery`／debounce `$effect`（該邏輯本來就已經用 `requestSeq` 判斷過期回應，這裡直接在 `$effect` 開頭 `if (candidates) return;` 即可），改成本地字串過濾：

```ts
const localCandidateKeys = $derived(
  candidates
    ?.filter((t) => !tags.includes(t))
    .filter((t) => !value.trim() || t.toLowerCase().includes(value.trim().toLowerCase())),
);

const candidateKeys = $derived(candidates ? (localCandidateKeys ?? []) : rawMatches.filter((t) => !tags.includes(t.name)).map((t) => t.name));
```

`candidate` snippet 目前會讀 `tagIndex.get(key)` 顯示 count／hidden 圖示；`candidates` 模式下沒有這份 `Tag` metadata，`meta` 會是 `undefined`，既有寫法（`{meta?.count}`、`{#if meta?.meta.hidden}`）本來就是可選鏈，不會壞，只是候選列不顯示數量——這是合理的降級，本來就沒有全域數量的概念可顯示。

其他既有呼叫端都不傳 `candidates`，行為不受影響。

---

## 8. 審查清單（`review-entry.ts` / `TagChipList.svelte` / `ReviewListItem.svelte`）

### `ReviewEntry` discriminated union

比照 `tags/cleanup/logic/review-entry.ts` 已經在用的 `kind` 模式：

```ts
type ReviewEntryBase = { filename: string; imgSrc: string; problem: string | null; checked: boolean; checkable: boolean };

export type ReviewEntry =
  | (ReviewEntryBase & {
      kind: "edit";
      nameBefore: string;
      nameAfter: string;
      ratingBefore: number;
      ratingAfter: number;
      addedTags: string[];
      removedTags: string[];
    })
  | (ReviewEntryBase & { kind: "revert"; name: string; rating: number; tags: string[] });

export function buildReviewEntry(filename: string, draft: Draft, checked: boolean, failure?: string): ReviewEntry {
  const problem = problemOf(draft);
  const finalProblem = problem ?? (failure ? `提交失敗：${failure}` : null);
  const checkable = finalProblem === null;
  const base = { filename, imgSrc: imgSrc(filename, "sm"), problem: finalProblem, checkable, checked: checkable && checked };

  if (draft.kind === "revert") {
    return { ...base, kind: "revert" as const, name: draft.baseline.name, rating: draft.baseline.rating, tags: draft.baseline.tags };
  }

  const { added, removed } = tagDiff(draft.baseline.tags, draft.tags);
  return {
    ...base,
    kind: "edit" as const,
    nameBefore: draft.baseline.name,
    nameAfter: draft.name.trim(),
    ratingBefore: draft.baseline.rating,
    ratingAfter: draft.rating,
    addedTags: added,
    removedTags: removed,
  };
}
```

### `TagChipList.svelte`（新增，`review/` 底下共用元件）

[temp.md](temp.md) 展示的 `+`／`−` chip 呈現手法，跟「超過 5 個收斂成 +N/−N」的規則（[temp3.md 第 6 節](temp3.md#6-送出前的審查清單)），在 committed 頁面實際上有兩個呼叫點：`ReviewListItem` 的單列 diff（`addedTags`／`removedTags`）跟 `ReviewImpact` 的全域彙總（`newTags`／`orphanedTags`）。與其在兩處各自算一次 `chipStyle` 字串跟溢出邏輯，拆成一個共用元件：

```svelte
<!-- review/TagChipList.svelte -->
<script lang="ts">
  import Chip from "$lib/components/display/Chip.svelte";

  type Props = { tags: string[]; sign: "+" | "-"; max?: number };
  let { tags, sign, max = 5 }: Props = $props();

  const colorVar = sign === "+" ? "var(--color-success)" : "var(--color-error)";
  const chipStyle = `color: ${colorVar}; border-color: hsl(from ${colorVar} h s l / 0.5); background: hsl(from ${colorVar} h s l / 0.08);`;

  const shown = $derived(tags.slice(0, max));
  const overflow = $derived(tags.length - shown.length);
</script>

{#each shown as tag (tag)}
  <Chip style={chipStyle}><span class="sign">{sign}</span>{tag}</Chip>
{/each}
{#if overflow > 0}
  <Chip style={chipStyle}><span class="sign">{sign}</span>{overflow}</Chip>
{/if}

<style>
  .sign {
    font-family: var(--font-family-mono);
  }
</style>
```

`ReviewListItem.svelte`（`kind === "edit"` 分支）：

```svelte
<div class="tags">
  <TagChipList tags={entry.addedTags} sign="+" />
  <TagChipList tags={entry.removedTags} sign="-" />
</div>
```

`kind === "revert"`：比照 `tags/cleanup` 的 `span.kind` 圓角徽章（標「退回」），本體用 `<del>` 呈現即將被清空的 name/rating/tags 摘要；名稱／評等只在跟 baseline 不同時才顯示 `<del>舊值</del> → <ins>新值</ins>`（`kind === "edit"` 分支，比照 `tags/cleanup` 既有手法）。

---

## 9. 標籤影響評估（`review.svelte.ts` + `ReviewImpact.svelte`）

### 為什麼要另外查詢，不能用本地資料算

判斷「移除某張圖的標籤 X 後，X 是否在全庫變成 0 張圖片在用」，需要 X 目前的**全域**使用數；審查清單裡的 `addedTags`／`removedTags` 只知道「這批選取的圖片對 X 做了什麼」，不知道 X 在批次之外還被多少張圖片用著，這個數字沒辦法從頁面已載入的資料（`pageData.value.items` 只是目前篩選/排序下的子集）推得。

### 新增一個輕量 proto 端點

比照現有 `GET /api/proto/tags-union-count`（`/tags` 合併區即時預估張數已經在用同款「小型只讀 proto 端點」模式，已核對其原始碼）：

```ts
// src/routes/api/proto/tags-impact/+server.ts
/**
 * `GET /api/proto/tags-impact`
 * 原型專用：查詢一組指定標籤名稱目前個別的全域使用數（純讀取，不受篩選/遮蔽影響）。
 * Query：`names=<逗號分隔的標籤名稱>`，找不到的標籤 count 為 0。
 */
export const GET: RequestHandler = ({ url }) => {
  if (!Database.isLoaded()) return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  const names = (url.searchParams.get("names") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const query = new Query(Database.requireLoaded());
  return json({ ok: true, data: { counts: query.tagCounts(names) } });
};
```

`Query`（`$lib/query/index.ts`）新增對應方法，直接用 `db.tagCount(name)`（已核對是 `$lib/database/store.ts:210`，O(1) 的 Map 查找）：

```ts
/** 查詢一組指定標籤名稱目前個別的全域使用數（未篩選、未遮蔽），找不到的標籤視為 0 */
tagCounts(names: string[]): { name: string; count: number }[] {
  return [...new Set(names)].map((name) => ({ name, count: this.db.tagCount(name) }));
}
```

### `review.svelte.ts`：debounce + 序號防過期回應

寫法比照 `TagInput.svelte` 既有的 `requestSeq`／`debounceTimer` 模式。[temp3.md 第 6 節](temp3.md#6-送出前的審查清單) 明確要求 skeleton 要立即顯示、debounce 只管什麼時候真正發送查詢——這兩件事在狀態上要分開追蹤：

```ts
private touchedTagNames = $derived.by(() => {
  const set = new Set<string>();
  for (const e of this.entries) {
    if (!e.checked || e.kind !== "edit") continue;
    for (const t of e.addedTags) set.add(t);
    for (const t of e.removedTags) set.add(t);
  }
  return [...set];
});

private netDelta(tag: string): number {
  let delta = 0;
  for (const e of this.entries) {
    if (!e.checked || e.kind !== "edit") continue;
    if (e.addedTags.includes(tag)) delta++;
    if (e.removedTags.includes(tag)) delta--;
  }
  return delta;
}

/** skeleton 顯示與否：跟 open / touchedTagNames 同步變動，沒有 debounce */
impactLoading = $derived(this.open && this.touchedTagNames.length > 0);

private impactCounts = $state(new Map<string, number>());
private impactSeq = 0;
private impactTimer: ReturnType<typeof setTimeout> | undefined;

newTags = $derived(this.touchedTagNames.filter((t) => {
  const before = this.impactCounts.get(t) ?? 0;
  return before === 0 && before + this.netDelta(t) > 0;
}));
orphanedTags = $derived(this.touchedTagNames.filter((t) => {
  const before = this.impactCounts.get(t) ?? 0;
  return before > 0 && before + this.netDelta(t) <= 0;
}));

// 建構子內：
$effect(() => {
  const names = this.touchedTagNames;
  clearTimeout(this.impactTimer);
  if (!this.open || names.length === 0) return;

  const seq = ++this.impactSeq;
  this.impactTimer = setTimeout(async () => {
    const res = await api.get<{ counts: { name: string; count: number }[] }>(
      `/api/proto/tags-impact?names=${encodeURIComponent(names.join(","))}`,
    );
    if (seq !== this.impactSeq) return; // 已有更新的查詢在路上，這次回應作廢
    if (res.ok && res.data) this.impactCounts = new Map(res.data.counts.map((c) => [c.name, c.count]));
  }, 200);
});
```

### `ReviewImpact.svelte`

```svelte
{#if review.impactLoading}
  <div class="skeleton-line"></div>
{:else if review.checkedCount === 0}
  <span>尚未勾選任何項目。</span>
{:else if review.newTags.length === 0 && review.orphanedTags.length === 0}
  <span>此次變動不會影響標籤的整體使用情況。</span>
{:else}
  {#if review.newTags.length > 0}
    <span>將新增 {review.newTags.length} 個新標籤：</span>
    <TagChipList tags={review.newTags} sign="+" />
  {/if}
  {#if review.orphanedTags.length > 0}
    <span>{review.newTags.length > 0 ? "，並有" : "有"} {review.orphanedTags.length} 個標籤將不再被任何圖片使用：</span>
    <TagChipList tags={review.orphanedTags} sign="-" />
  {/if}
{/if}
```

`.skeleton-line` 是這個元件自己的 CSS（灰底 + shimmer 動畫），不是共用元件（[temp3.md 第 6 節](temp3.md#6-送出前的審查清單) 已確認：本專案目前沒有 skeleton 元件的先例，這裡不新造一個共用的）。

---

## 10. 提交流程與 API 異動

### 擴充 `/api/proto/committed-batch`

送出審查清單時，勾選項目裡混著兩種操作：`kind: "edit"` 要走 `updateRecord`（PATCH 語意），`kind: "revert"` 要走 `removeRecord`（DELETE 語意）。核對過現有端點原始碼（`src/routes/api/proto/committed-batch/+server.ts`），目前只支援前者。

`/api/proto/*` 本來就是標了「原型」的技術債，該讓它自己背負「支援兩種操作」的複雜度、寫 TODO 留給日後轉正，而不是讓 `committed/logic/review.svelte.ts` 這種本該乾淨的頁面邏輯去遷就它、手動縫合兩種 API 回應形狀（[[proto-api-debt-boundary]]）：

```ts
type CommittedBatchItem =
  | { id: string; op?: "update"; name?: string; tags?: string[]; rating?: number; expectedUpdatedAt: number }
  | { id: string; op: "revert" };
```

伺服器端 `op === "revert"` 呼叫 `mutation.removeRecord(id)`，其餘沿用現有的 `mutation.updateRecord(...)` 分支，加註：

```ts
// TODO: 原型端點，混雜 update/revert 兩種操作；正式轉正時應拆成語意更清楚的端點或改走真正的批次 command 模式
```

`errorMessage()` 裡既有的 `case "last_tag"` 分支維持原樣：`last_tag` 是 `TagCommands.delete`（整個刪除一個標籤，`/tags`、`/tags/cleanup` 在用）的守門，跟這裡的 `updateRecord`／`removeRecord`（單張圖片編輯，規則落在 `Validator.tags()`）是不同層級的保護，這個端點目前用不到它不代表這個 case 沒用（已核對 `$lib/mutation/index.ts`／`$lib/mutation/tag.ts` 的錯誤型別確實只有 `TagCommands.delete` 會產生 `LastTag`）。

### `review.svelte.ts` 的 `handleSubmit`

跟 staged 的 `handleSubmit` 幾乎一致，提交成功後清除草稿改呼叫 `editor.handleDiscardDraft(committed)`（第 4 節已提過：這跟「還原」「取消退回」是同一個方法，語意完全一致——刪掉已經送出的草稿，回到「一般」狀態）：

```ts
handleSubmit = async () => {
  const filenames = this.entries.filter((e) => e.checked).map((e) => e.filename);
  if (filenames.length === 0 || this.operations.pending) return;

  this.operations.pending = true;
  try {
    const result = await commitDrafts(filenames.map((f) => ({ filename: f, draft: this.editor.draftOf(f)! })));
    this.failures = Object.fromEntries(result);

    const committed = filenames.filter((f) => !result.has(f));
    this.editor.handleDiscardDraft(committed);
    for (const f of committed) this.checked.delete(f);

    if (committed.length > 0) addToast({ message: `已提交 ${committed.length} 張圖片`, variant: "success" });
    if (result.size > 0) addToast({ message: `${result.size} 張提交失敗`, variant: "error" });
    if (result.size === 0) this.open = false;

    await goto(location.href, { replaceState: true, noScroll: true, keepFocus: true, invalidateAll: true });
  } catch (e) {
    addToast({ message: formatError(e), variant: "error" });
  } finally {
    this.operations.pending = false;
  }
};
```

單張「退回」（不透過批次選取，直接在 Inspector 標記）也走同一條草稿 + 審查 + `commitDrafts` 的路徑，沒有獨立的立即生效 API 呼叫——跟 compare 現有的 `handleRevert`（立即生效）刻意不同，這是 [temp3.md 第 4 節](temp3.md#4-逐張編輯編輯面板) 已經確認的方向。

---

## 11. 明確排除在本次範圍外

- staged 原本的圖章（釘選＋拖曳塗抹）模式。
- `(layout)/ModalTrigger.svelte` 對淺路由 `currentId` 的過期讀取問題（全站共通的既有 TODO，不是本頁引入的新問題）。
- `Mutation.removeRecord` 沒有樂觀併發檢查——這是既有行為（compare 頁面的單筆退回也是如此），不在這次擴大範圍。
- 開發伺服器啟動、瀏覽器手動測試（依專案規範由使用者驗收，不自動執行，見第 12 節）。

---

## 12. 驗收檢查清單（實作完成後，需要你手動驗證）

- [ ] 從導覽列直接進入 `/committed`：預設排序是「提交時間 desc」。
- [ ] 從首頁詳情彈窗、compare 卡片的「編輯」按鈕進入 `/committed`：沿用來源頁當下的排序（含「來源頁剛好也是用預設 rating 排序」的情況，這是第 1 節修正的重點）與篩選條件，並直接開啟該圖片的編輯面板。
- [ ] 編輯面板：欄位顯示目前實際值、標籤/評等/名稱編輯即時反映在卡片牆的「已編輯」標記；「還原草稿」能把欄位改回原始值。
- [ ] 「退回暫存區」／「取消退回」：欄位編輯區在標記退回後變成唯讀摘要，取消退回後欄位恢復可編輯且是 baseline 值（不是退回前打到一半的內容）。
- [ ] 批次選取模式：全選（含三態）、評等選單、加/去標籤面板（去標籤只能選當下真的有的標籤）、標記退回，皆正確套用到所有選取圖片的草稿且不立即送出。
- [ ] 審查清單：edit/revert 兩種列呈現正確；標籤新增/移除用 +/− chip 呈現，超過 5 個收斂成 +N/−N；標籤庫影響區塊在開啟/勾選時立即顯示 skeleton、debounce 後顯示正確的新增/孤立標籤。
- [ ] 提交：混合 edit + revert 一次送出成功；部分失敗時個別標示原因、不整批回滾。
- [ ] 離開頁面（分頁關閉、重新整理、點連結）在有未送出草稿時會提示。
