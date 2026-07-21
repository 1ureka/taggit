# `/committed` 頁面 — 實作計畫

> 這份文件是 [temp3.md](temp3.md)（互動與 UI 需求，已收斂完成）的實作對應：controller 怎麼拆、草稿資料模型長怎樣、檔案怎麼分、API 要怎麼異動。temp3.md 沒談過的「為什麼」在這裡補上；temp3.md 已經談完的互動細節不重複貼一次，只在需要對應到具體實作決策時才引用。

## 1. 路由與資料流

### `+page.server.ts`

比照 `/compare` 的版本：用 `ImageQuery.fromSearchParams(url.searchParams)` 驅動篩選/排序，`limit: 0` 全量載入（不分頁，跟 compare／staged 一致，本專案是個人本地圖庫，前端虛擬化捲動足以應付）。預設排序改成 `committedAt desc`（管理情境下新提交的圖片更可能需要處理）。

不在這裡預先撈全庫標籤名稱／計數（staged 的 `+page.server.ts` 有這麼做，供審查清單判斷「會不會建立新標籤」）。committed 頁的標籤影響改成審查清單開啟時才按需查詢（見第 6 節），只查這次批次真正碰到的少數標籤，不用每次開頁就付一次全庫標籤的成本。

### URL 查詢參數與深連結

沿用 `ImageQuery` 的解析／序列化，跟 compare、home 共用同一套，這也是 [temp3.md 第 1 節](temp3.md#1-進入方式) 提到的兩個既有連結點（compare 卡片的「編輯」、home 詳情彈窗的「編輯」）能夠直接把篩選條件帶過來的原因。

新增一個本頁專屬的 `currentId`：目前在編輯面板中的圖片檔名。設計為**淺路由同步**（`replaceState`，不觸發 `load` 重跑），比照 `(home)/logic/detail.svelte.ts` 與 `compare/logic/pinned.svelte.ts` 的既有模式：

- 掛載時從 `page.url.searchParams.get("currentId")` 讀初始值（`untrack`）。
- 使用者切換編輯目標＝本地立即反應 + `replaceState`，不必等一次完整導航。
- `$effect` 監聽外部造成的 URL 變動（上一頁/下一頁、外部連結）回灌本地狀態。

`(layout)/ModalTrigger.svelte` 讀 `page.url` 顯示全域狀態列文字，在淺路由後可能讀到過期的 `currentId`（該檔案裡已經有一句 TODO 承認這件事）。這是全站共通的 `page.url` vs `location` 落差，不是本頁引入的新問題，不在這次處理範圍。

### 需要同步修正的既有 bug

`(home)/logic/detail.svelte.ts` 的 `editorHref` 目前組出 `/editor?...`，但這個路由不存在（只有 `/committed`）。需要修正成 `/committed`，否則首頁詳情彈窗的「編輯」按鈕連到 404。

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
│   ├── CardInfo.svelte           # 概要列，依草稿狀態切換顯示內容
│   ├── config.ts                 # 沿用 staged（breakpoints / CARD_SIZE / INSPECTOR_WIDTH）
│   └── batch/
│       ├── BatchBar.svelte       # 常駐列本體：全選 + 三個觸發鈕 + 標記退回 + 結束批次選取
│       ├── BatchRatingMenu.svelte    # 評等，Menu + 手刻 Button 觸發鈕，星號只在選項
│       └── BatchTagAction.svelte # 加標籤／去標籤共用（mode: "add" | "remove"），Popover + TagInput + 套用按鈕
├── inspector/
│   ├── Inspector.svelte          # 沿用 staged 版面
│   ├── InspectorHeader.svelte    # 沿用（檔名 + X/Y 指標 + 關閉鈕）
│   ├── InspectorFields.svelte    # 編輯模式：名稱/評等/標籤欄位；退回模式：唯讀摘要
│   ├── InspectorFooter.svelte    # 「還原草稿」+「退回暫存區／取消退回」切換
│   └── Lightbox.svelte           # 沿用 staged，前後張導覽改用 pageData.value.items
├── review/
│   ├── ReviewModal.svelte        # 沿用 staged
│   ├── ReviewHeader.svelte       # 沿用
│   ├── ReviewList.svelte         # 沿用（全選/勾選邏輯不變）
│   ├── ReviewListItem.svelte     # 依 entry.kind 分支：edit 用 diff 呈現；revert 用 kind pill
│   ├── ReviewImpact.svelte       # skeleton 用自己的 CSS；debounce 查詢標籤影響
│   └── ReviewFooter.svelte       # 沿用
└── logic/
    ├── page-data.svelte.ts       # 沿用（context 包 load 的 data）
    ├── filter.svelte.ts          # 幾乎照搬 compare 版本
    ├── operations.svelte.ts      # 沿用 staged 版本（pending 鎖 + 重新整理）
    ├── editor.svelte.ts          # 草稿本地狀態 + 批次寫入方法；currentId 淺路由同步；離頁守衛
    ├── draft.ts                  # Draft 型別、problemOf/isTouched/tagDiff、commitDrafts
    ├── selection.svelte.ts       # 批次選取模式：選取集合、候選標籤、委派寫入給 editor
    ├── review.svelte.ts          # 審查清單 + 標籤影響評估（debounce 查詢）
    ├── review-entry.ts           # ReviewEntry discriminated union（edit/revert）
    └── lightbox.svelte.ts        # 沿用 staged，files 來源改 pageData.value.items 的 id
```

不做 staged 的圖章模式（`stamp.svelte.ts`／`StampBadge.svelte`）——第 4 節的批次選取已經涵蓋同樣的需求，兩者不並存。

---

## 3. 草稿資料模型（`logic/draft.ts`）

跟 staged 最關鍵的差異：**staged 的草稿是「從空白填到有值」，committed 的草稿是「從既有值改成新值」**，因此每份草稿都要挾帶一份 baseline（建立草稿當下的原始快照）：

1. **審查清單要顯示異動前後的 diff**，diff 的「異動前」不能每次都去現場的 `pageData.value.items` 現查——使用者可能編輯途中又改了篩選/排序（真的導覽，會重跑 `load`），甚至把該圖片篩出目前可視範圍。把 baseline 釘進草稿本身，diff 呈現不受篩選狀態影響。
2. **樂觀併發檢查**：`PATCH /api/committed/[filename]` 與 `/api/proto/committed-batch` 都要求 `expectedUpdatedAt`，這個值必須是「使用者開始編輯當下」讀到的 `updatedAt`，同樣得釘住。
3. **「已編輯」判定**：staged 的 `isTouched` 只看草稿是否非空；committed 要看草稿是否偏離 baseline。

```ts
/** 建立草稿當下的原始快照，用於 diff 呈現與樂觀併發檢查 */
type Baseline = { name: string; rating: number; tags: string[]; updatedAt: number };

/** 每張已提交圖片的本地草稿；revert 會蓋掉同張圖片先前的欄位編輯（兩者互斥） */
export type Draft =
  | { kind: "edit"; baseline: Baseline; name: string; rating: number; tags: string[] }
  | { kind: "revert"; baseline: Baseline };

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

---

## 4. `editor.svelte.ts`：單張編輯與批次寫入的共同基礎

### 跟 staged 的關鍵行為差異

- `touchedFiles`（審查清單的來源）不能用「目前篩選可見的檔名列表」去 derive——這是 staged 原本的寫法（`this.files.filter(f => this.drafts[f] && isTouched(...))`），但 committed 的 `this.files`（`pageData.value.items`）只代表這次篩選/排序下可見的圖片，換一次篩選條件就可能讓已編輯的圖片暫時消失於可見清單。改成直接對 `Object.keys(this.drafts)` 做 `isTouched` 過濾，跟目前可見清單脫鉤。
- `activeFile`／`activeIndex`／`total` 這幾個「編輯面板目前選取指標」則維持跟 staged 一樣用目前篩選可見清單 derive——這些是給編輯面板「上一張/下一張」導覽用的，選取的圖片被篩出可視範圍時自動回落成 `null`，沒有理由跟 staged 不同。
- `active` 多一層跟 URL `currentId` 的雙向同步（見第 1 節）。

### 單張與批次共用的內部方法

```ts
private ensureDraft(filename: string): Draft {
  const d = this.drafts[filename];
  if (d) return d;
  const record = this.pageData.value.items.find((r) => r.id === filename);
  const baseline: Baseline = record
    ? { name: record.name, rating: record.rating, tags: record.tags, updatedAt: record.updatedAt }
    : this.knownBaselines[filename]; // 圖片已不在目前篩選可見清單時，退回先前記錄的 baseline
  const next: Draft = { kind: "edit", baseline, name: baseline.name, rating: baseline.rating, tags: [...baseline.tags] };
  this.drafts[filename] = next;
  return next;
}

/** 指定檔名目前「生效」的標籤（有草稿用草稿，沒有用 baseline/record），供批次去標籤的候選清單使用 */
effectiveTagsOf(filename: string): string[] {
  const d = this.drafts[filename];
  if (d?.kind === "edit") return d.tags;
  if (d?.kind === "revert") return [];
  return this.pageData.value.items.find((r) => r.id === filename)?.tags ?? [];
}
```

> `knownBaselines` 是一個輔助 map：第一次看到某檔名的 record 時記下它的 baseline 快照，供該檔名之後被篩出可視範圍、但仍要繼續讀寫草稿時使用（呼應第 3 節第 1 點的理由）。

### 批次寫入方法

加標籤／去標籤面板現在是「編輯 → 按套用 → 一次寫入」的模式（見第 5 節），不再是面板開著時逐個 chip 即時寫入草稿，所以這裡收整批標籤、不是收單一個標籤：

```ts
handleBulkAddTags = (filenames: string[], tags: string[]) => {
  const clean = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  if (clean.length === 0) return;
  for (const f of filenames) {
    const d = this.ensureDraft(f);
    if (d.kind === "revert") continue;
    this.writeDraft(f, { ...d, tags: [...new Set([...d.tags, ...clean])] });
  }
};

handleBulkRemoveTags = (filenames: string[], tags: string[]) => {
  const set = new Set(tags.map((t) => t.trim()).filter(Boolean));
  if (set.size === 0) return;
  for (const f of filenames) {
    const d = this.ensureDraft(f);
    if (d.kind === "revert") continue;
    this.writeDraft(f, { ...d, tags: d.tags.filter((t) => !set.has(t)) });
  }
};

handleBulkSetRating = (filenames: string[], rating: number) => {
  for (const f of filenames) {
    const d = this.ensureDraft(f);
    if (d.kind === "revert") continue;
    this.writeDraft(f, { ...d, rating });
  }
};

handleBulkRevert = (filenames: string[]) => {
  for (const f of filenames) {
    const baseline = this.drafts[f]?.baseline ?? this.baselineOf(f);
    this.writeDraft(f, { kind: "revert", baseline });
  }
};
```

因為套用是「按下套用鈕那一刻」的單一動作，不再需要對稱的 undo 方法——面板裡打字/加入/移除 chip 都只是面板自己的本地狀態（見第 5 節 `BatchTagAction.svelte`），跟圖片草稿完全無關，關掉面板不按套用就直接作廢，沒有東西需要復原。

---

## 5. 批次選取（`logic/selection.svelte.ts` + `cards/batch/`）

### 版面歸屬

[temp3.md 第 5 節](temp3.md#5-批次編輯) 確認：常駐列要跟卡片牆同容器、不隨卡片牆內部捲動、寬度＝卡片牆欄位寬度。做法是把它放進 `Cards.svelte` 自己的根容器裡，跟現有可捲動的 `<section>` 同層、但在它前面，不放進 `<section>` 內部：

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

`BatchBar` 因此天然地只佔卡片牆欄位的寬度（不含 Inspector），且不隨 `<section>` 內部捲動——不需要額外的 sticky 定位技巧。這也是 staged `Cards.svelte` 目前 `.container.strip` 條紋背景那個 class 被拿掉的原因：卡片牆容器不再需要因為批次模式而換外觀，`BatchBar` 本身已經夠顯眼（[temp3.md 第 5 節](temp3.md#5-批次編輯) 已確認）。

### `SelectionController`

跟原本設計相比明顯變簡單：不再需要追蹤「面板目前排隊了哪些標籤」（那是面板自己的本地狀態，見下方 `BatchTagAction.svelte`），`SelectionController` 只管選取集合本身，動作方法收到的都是「已經確定要套用」的完整資料，直接轉呼叫 `editor` 對應的批次方法：

```ts
class SelectionController {
  private editor = getEditorContext();
  private pageData = getPageDataContext();

  active = $state(false);
  private ids = new SvelteSet<string>();

  selectedFiles = $derived([...this.ids]);
  count = $derived(this.ids.size);
  isSelected = (filename: string) => this.ids.has(filename);

  /** 「去標籤」面板的候選：選取範圍內至少一張圖片目前真的有的標籤（用 effectiveTagsOf，含尚未送出的草稿異動） */
  removableTagCandidates = $derived.by(() => {
    const set = new Set<string>();
    for (const f of this.selectedFiles) for (const t of this.editor.effectiveTagsOf(f)) set.add(t);
    return [...set];
  });

  allSelectedState = $derived.by(() => {
    const total = this.pageData.value.items.length;
    if (total === 0 || this.count === 0) return "unchecked";
    if (this.count === total) return "checked";
    return "indeterminate";
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

  handleApplyAddTags = (tags: string[]) => this.editor.handleBulkAddTags(this.selectedFiles, tags);
  handleApplyRemoveTags = (tags: string[]) => this.editor.handleBulkRemoveTags(this.selectedFiles, tags);
  handleSetRating = (rating: number) => this.editor.handleBulkSetRating(this.selectedFiles, rating);
  handleRevert = () => this.editor.handleBulkRevert(this.selectedFiles);
}
```

### `BatchBar.svelte` 的三個觸發鈕

[temp3.md 第 5 節](temp3.md#5-批次編輯) 已確認：三顆觸發鈕外觀完全一致、不因為使用過而改變，實作上就直接照抄本專案既有 `Menu.svelte` 的標準用法——觸發鈕是頁面路由自己手刻的 `Button`（文字 + 手動渲染的 `IconChevronDown`），不透過 `Select` 元件，三顆天生長得一樣。

- **`BatchRatingMenu.svelte`**：用既有的 `Menu` 元件（`$lib/components/floating/Menu.svelte`），`items` 是 1～5 星五個按鈕，選項內容帶星號圖示；點了哪個立刻呼叫 `selection.handleSetRating` 並收合選單。觸發鈕固定顯示「評等」，不因為用過而改變外觀：

  ```svelte
  <script lang="ts">
    import Button from "$lib/components/actions/Button.svelte";
    import Menu from "$lib/components/floating/Menu.svelte";
    import { IconChevronDown, IconStarFilled } from "$lib/icons";
    import { getSelectionContext } from "../../logic/selection.svelte";

    const selection = getSelectionContext();
    const id = $props.id();

    let open = $state(false);
    let anchor = $state<HTMLElement>();

    const items = [1, 2, 3, 4, 5].map((n) => ({
      type: "button" as const,
      content: { render: ratingRow, props: { n } },
      props: { onclick: () => { selection.handleSetRating(n); open = false; } },
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

- **`BatchTagAction.svelte`**（`mode: "add" | "remove"`）：觸發鈕是同一套手刻 `Button` + chevron 寫法，點下去開的不是 `Menu`，是 `Popover` + `TagInput` + 一顆「套用」按鈕。TagInput 綁定的標籤陣列是**元件自己的本地狀態**，跟任何圖片草稿無關，按下套用才把這份清單整批送給 `selection`：

  ```svelte
  <script lang="ts">
    let { mode }: { mode: "add" | "remove" } = $props();

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
      if (mode === "add") selection.handleApplyAddTags(draftTags);
      else selection.handleApplyRemoveTags(draftTags);
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
        {label}
      />
      <Button variant="primary" onclick={handleApply} status={draftTags.length === 0 ? "disabled" : undefined}>
        套用
      </Button>
    </div>
  </Popover>
  ```

  點擊面板外部關閉、不套用（沿用 `FilterPopover.svelte` 既有的 window click 判斷寫法）。`candidates` 只在 `mode === "remove"` 時傳，`mode === "add"` 維持 `TagInput` 原本查全庫標籤的行為（可以打全新的標籤名稱）。

---

## 6. `TagInput.svelte` 新增兩個 prop

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

Markup 依此決定 chips 區塊渲染在 `<Combo>` 之前還是之後；`"above"` 時完全就是目前的 DOM 順序，不影響既有呼叫端（staged Inspector、compare 進階篩選、`/tags` 系列頁面）的外觀。`"below"` 只有這裡的批次標籤面板在用——輸入框固定在上緣，chip 往下長，符合連續輸入時輸入框不跳動的需求（[temp3.md 第 5 節](temp3.md#5-批次編輯) 已確認）。

### `candidates`（新發現的必要修正）

第 5 節原本的設想是直接把 `selection.removableTagCandidates` 傳給 `TagInput` 的候選清單，但重新對照 `TagInput.svelte` 現有原始碼後發現：它目前**沒有**直接傳入候選清單這條路，候選永遠是元件自己 debounce 呼叫 `/api/tags`（用 `scope` 這個 `ImageWhere` 查詢字串去限定範圍）查回來的，`scope` 沒有辦法表達「剛好是這批選取的圖片 id」——`ImageWhere` 只有 search／標籤／評等這些篩選維度，沒有「id 在某個清單內」這種篩法。

「去標籤」要求候選限定在「選取範圍內至少一張圖片目前真的有」的標籤（[temp3.md 第 5 節](temp3.md#5-批次編輯)），這個集合完全來自本地已載入/草稿中的資料（`selection.removableTagCandidates`，見第 5 節），沒有必要也沒有辦法透過 `scope` 從伺服器查——所以要新增這個 `candidates` prop：提供時整個跳過 `/api/tags` 查詢，直接拿這份清單依目前輸入字串做本地字串過濾當候選。`mode === "add"` 不傳這個 prop，維持原本查全庫標籤的行為。

其他既有呼叫端都不傳 `candidates`，行為不受影響。

---

## 7. 審查清單（`review-entry.ts` / `ReviewListItem.svelte`）

### `ReviewEntry` 改為 discriminated union

比照 `tags/cleanup/logic/review-entry.ts` 已經在用的 `kind` 模式：

```ts
type ReviewEntryBase = {
  filename: string;
  imgSrc: string;
  problem: string | null;
  checked: boolean;
  checkable: boolean;
};

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
```

### `ReviewListItem.svelte` 呈現規則

- **`kind: "edit"`**：名稱／評等只在跟 baseline 不同時才顯示 `<del>舊值</del> → <ins>新值</ins>`（比照 `tags/cleanup` 既有手法）。標籤用綠 `+`／紅 `−` Chip 呈現 `addedTags`／`removedTags`，單一方向超過 5 個收斂成 `+N`／`−N` 溢出 chip。
- **`kind: "revert"`**：比照 `tags/cleanup` 的 `span.kind` 圓角徽章（標「退回」），本體用 `<del>` 呈現即將被清空的 name/rating/tags 摘要。

---

## 8. 標籤影響評估（`review.svelte.ts` + `ReviewImpact.svelte`）

### 為什麼要另外查詢，不能用本地資料算

判斷「移除某張圖的標籤 X 後，X 是否在全庫變成 0 張圖片在用」，需要 X 目前的**全域**使用數；審查清單裡的 `addedTags`／`removedTags` 只知道「這批選取的圖片對 X 做了什麼」，不知道 X 在批次之外還被多少張圖片用著，這個數字沒辦法從頁面已載入的資料（`pageData.value.items` 只是目前篩選/排序下的子集）推得。

### 新增一個輕量 proto 端點

比照現有 `GET /api/proto/tags-union-count`（`/tags` 合併區即時預估張數已經在用同款「小型只讀 proto 端點」模式）：

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

`Query`（`$lib/query/index.ts`）新增對應方法，直接用 `Database.tagCount(name)`（已經是 O(1) 的 Map 查找，見 `facet-index.ts`，不需要掃全部標籤）：

```ts
/** 查詢一組指定標籤名稱目前個別的全域使用數（未篩選、未遮蔽），找不到的標籤視為 0 */
tagCounts(names: string[]): { name: string; count: number }[] {
  return [...new Set(names)].map((name) => ({ name, count: this.db.tagCount(name) }));
}
```

### `review.svelte.ts`：debounce + 序號防過期回應

寫法比照 `TagInput.svelte` 既有的 `requestSeq`／`debounceTimer` 模式。**注意**：[temp3.md 第 6 節](temp3.md#6-送出前的審查清單) 已經明確要求 skeleton 要立即顯示、debounce 只管什麼時候真正發送查詢——這兩件事在狀態上要分開追蹤：

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

`impactLoading` 不受 debounce 影響——只要有 `open` 且有東西要查，立刻是 `true`；`impactCounts` 是上一次真正查詢完成後的結果，兩者疊加起來剛好是「查詢中前一刻的結果還在畫面上」還是「顯示 skeleton」由 `ReviewImpact.svelte` 自己決定：只要 `impactLoading` 為真就畫 skeleton，不去看 `impactCounts` 是不是舊的。

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
    {#each review.newTags as t}{@render plusTag(t)}{/each}
  {/if}
  {#if review.orphanedTags.length > 0}
    <span>{review.newTags.length > 0 ? "，並有" : "有"} {review.orphanedTags.length} 個標籤將不再被任何圖片使用：</span>
    {#each review.orphanedTags as t}{@render minusTag(t)}{/each}
  {/if}
{/if}
```

`.skeleton-line` 是這個元件自己的 CSS（灰底 + shimmer 動畫），不是共用元件（[temp3.md 第 6 節](temp3.md#6-送出前的審查清單) 已確認：本專案目前沒有 skeleton 元件的先例，這裡不新造一個共用的）。`plusTag`／`minusTag` 兩個 snippet 沿用第 7 節 `ReviewListItem` 每列用的同一組 `+`／`−` Chip 樣式，聚合層級一樣適用「超過 5 個收斂成 `+N`／`−N`」的規則。

---

## 9. 提交流程與 API 異動

### 為什麼要擴充 `/api/proto/committed-batch`

送出審查清單時，勾選項目裡混著兩種操作：`kind: "edit"` 要走 `updateRecord`（PATCH 語意），`kind: "revert"` 要走 `removeRecord`（DELETE 語意）。現有 `/api/proto/committed-batch` 只支援前者，`removeRecord` 目前只有單筆的 `DELETE /api/committed/[filename]`。

兩個選項：前端自己發兩批請求（一次 batch POST 給 edit、N 次個別 DELETE 給 revert）再手動合併兩種不同形狀的回應；或者擴充 proto 端點一次吃兩種操作，回應維持原本 `{ results: [{ id, ok, error? }] }` 的單一形狀。選後者——`/api/proto/*` 本來就是標了「原型」的技術債，該讓它自己背負「支援兩種操作」的複雜度、寫 TODO 留給日後轉正，而不是讓 `committed/logic/review.svelte.ts` 這種本該乾淨的頁面邏輯去遷就它、手動縫合兩種 API 回應形狀（[[proto-api-debt-boundary]]）。

```ts
type CommittedBatchItem =
  | { id: string; op?: "update"; name?: string; tags?: string[]; rating?: number; expectedUpdatedAt: number }
  | { id: string; op: "revert" };
```

伺服器端 `op === "revert"` 呼叫 `mutation.removeRecord(id)`，其餘沿用現有的 `mutation.updateRecord(...)` 分支，加註：

```ts
// TODO: 原型端點，混雜 update/revert 兩種操作；正式轉正時應拆成語意更清楚的端點或改走真正的批次 command 模式
```

`errorMessage()` 裡既有的 `case "last_tag"` 分支維持原樣，不要清掉：`last_tag` 是「一張已提交圖片不可以沒有標籤」這條業務規則在**整個標籤被刪除**（`TagCommands.delete`，`/tags`、`/tags/cleanup` 在用）這條路徑上的守門，跟這裡的 `updateRecord`／`removeRecord`（單張圖片編輯，規則落在 `Validator.tags()` 那一層）是兩種不同層級的保護，只是這個端點目前的呼叫方式用不到它，不代表這個 case 沒用。

### `commitDrafts`（`logic/draft.ts`）

```ts
export async function commitDrafts(
  entries: { filename: string; draft: Draft }[],
): Promise<Map<string, string>> {
  const items = entries.map(({ filename, draft }) =>
    draft.kind === "revert"
      ? { id: filename, op: "revert" as const }
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

跟 staged 的 `commitDrafts` 一樣的失敗匯總形狀，`review.svelte.ts` 的 `handleSubmit` 幾乎可以整段照抄 staged 版本，不必為了 edit/revert 混合而多寫分支。單張「退回」（不透過批次選取，直接在 Inspector 標記）也走同一條草稿 + 審查 + `commitDrafts` 的路徑，沒有獨立的立即生效 API 呼叫——跟 compare 現有的 `handleRevert`（立即生效）刻意不同，這是 [temp3.md 第 4 節](temp3.md#4-逐張編輯編輯面板) 已經確認的方向。

---

## 10. 明確排除在本次範圍外

- staged 原本的圖章（釘選＋拖曳塗抹）模式。
- `(layout)/ModalTrigger.svelte` 對淺路由 `currentId` 的過期讀取問題（全站共通的既有 TODO，不是本頁引入的新問題）。
- 開發伺服器啟動、瀏覽器手動測試（依專案規範由使用者驗收，不自動執行）。

---

## 11. 待使用者確認的剩餘小節點

目前沒有還沒收斂的節點。設計已經對應 temp3.md 收斂完成的互動需求，可以進入實作階段。
