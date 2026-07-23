# `/committed` 頁面 — 剩餘待辦事項

> 原本的實作計畫（含 controller 拆分、API 異動、審查清單設計）已經完成並通過 `npm run check`／`npm run build`／`npm run test`，過程中中途換過一次架構（`logic/` 現在是 `page-data.svelte.ts`、`snapshots.svelte.ts`、`drafts.svelte.ts`、`reverts.svelte.ts`、`pointers.svelte.ts`、`guard.svelte.ts`、`query.svelte.ts`、`submit.svelte.ts`、`review.svelte.ts`、`tag-impact.svelte.ts`，取代原計畫的 `editor.svelte.ts`／`selection.svelte.ts`／`filter.svelte.ts`／`operations.svelte.ts`／`draft.ts`）。已完成的部分已從本文件移除，互動需求全文仍在 [temp3.md](temp3.md)。

## 1. 批次選取（temp3.md 第 5 節，完全尚未實作）

目前 `cards/`、`header/`、`logic/` 底下都還沒有任何批次選取相關的程式碼（沒有 `selection.svelte.ts`，沒有 `cards/batch/` 資料夾）。這是目前唯一還沒動工的完整功能。

好消息是重寫後的 `logic/drafts.svelte.ts`、`logic/reverts.svelte.ts` 的寫入方法本來就統一吃 `filenames: string[]`（單張傳 `[file]`、批次傳 `selection.selectedFiles`），跟這裡需要的介面天生吻合，不需要再另外做一層轉接。

### 檔案樹（新增部分）

```
cards/
├── Cards.svelte     # 既有，批次模式開啟時在卡片牆上方插入 <BatchBar />
├── Card.svelte      # 既有，點擊行為需依 selection.active 分支（見下方）
└── batch/
    ├── BatchBar.svelte           # 常駐列：全選 + 三個觸發鈕 + 標記退回 + 結束批次選取
    ├── BatchRatingMenu.svelte    # 評等，Menu + 手刻 Button 觸發鈕
    └── BatchTagAction.svelte     # 加標籤／去標籤共用（mode: "add" | "remove"）
logic/
└── selection.svelte.ts   # 純選取狀態：ids/active，不依賴任何其他 controller
```

`+page.svelte` 需要多加一行 `const selection = createSelectionContext();`（只依賴 `pageData`，建立順序不受其他 controller 限制）。

### 版面歸屬

常駐列要跟卡片牆同容器、不隨卡片牆內部捲動、寬度＝卡片牆欄位寬度，放進 `Cards.svelte` 自己的根容器裡，跟現有可捲動的 `<section>` 同層、但在它前面：

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
div.container {
  display: flex;
  flex-direction: column;
}
div.container > section {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
```

### `Card.svelte` 需要補的點擊分支

```ts
const handleClick = () => {
  if (selection.active) selection.handleToggle(record.id);
  else pointers.handleSelect(record.id);
};
```

批次選取模式開啟時，卡片本身「選取中」的疊層（checkbox、強調色邊框）疊在既有四態外觀之上，不影響現在算 `info` 的邏輯。

### `selection.svelte.ts`

原設計本來就不依賴任何編輯 controller，照抄即可：

```ts
/**
 * @file selection.svelte.ts
 * 批次選取模式：選取集合本身與衍生的唯讀投影。不擁有任何草稿寫入邏輯——
 * 寫入一律由呼叫端（batch/ 底下三個面板元件）直接呼叫 drafts/reverts 的 handle* 方法。
 */
import { getContext, setContext } from "svelte";
import { SvelteSet } from "svelte/reactivity";
import { getPageDataContext } from "./page-data.svelte";

class SelectionController {
  private pageData = getPageDataContext();

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

### `BatchBar.svelte`

```svelte
<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";
  import { getRevertMarkContext } from "../../logic/reverts.svelte";
  import { getSelectionContext } from "../../logic/selection.svelte";
  import BatchRatingMenu from "./BatchRatingMenu.svelte";
  import BatchTagAction from "./BatchTagAction.svelte";

  const reverts = getRevertMarkContext();
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
    onclick={() => reverts.handleMark(selection.selectedFiles)}
  >
    標記退回
  </Button>

  <Button variant="ghost" onclick={selection.handleToggleMode}>結束批次選取</Button>
</div>
```

三顆觸發鈕（評等／加標籤／去標籤）外觀完全一致、不因為使用過而改變；「標記退回」不需要二次確認（真正的確認關卡在審查清單），照 temp3.md 第 5 節。

### `BatchRatingMenu.svelte`

照抄本專案既有 `Menu.svelte` 標準用法（參考 `menu-keyboard/+page.svelte` 的 profile menu 寫法）：

```svelte
<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import Menu from "$lib/components/floating/Menu.svelte";
  import { IconChevronDown, IconStarFilled } from "$lib/icons";
  import { getDraftsContext } from "../../logic/drafts.svelte";
  import { getSelectionContext } from "../../logic/selection.svelte";

  const drafts = getDraftsContext();
  const selection = getSelectionContext();
  const id = $props.id();

  let open = $state(false);
  let anchor = $state<HTMLElement>();

  const items = [1, 2, 3, 4, 5].map((n) => ({
    type: "button" as const,
    content: { render: ratingRow, props: { n } },
    props: {
      onclick: () => {
        drafts.handleSetRating(selection.selectedFiles, n);
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

<Menu
  id="{id}-menu"
  labelledBy={{ triggerId: `${id}-trigger` }}
  {open}
  reference={anchor}
  {items}
  onclose={() => (open = false)}
/>
```

### `BatchTagAction.svelte`（`mode: "add" | "remove"`）

```svelte
<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import Popover from "$lib/components/floating/Popover.svelte";
  import TagInput from "$lib/components/widgets/TagInput.svelte";
  import { IconChevronDown } from "$lib/icons";
  import { getDraftsContext } from "../../logic/drafts.svelte";
  import { getSelectionContext } from "../../logic/selection.svelte";
  import { getQueryContext } from "../../logic/query.svelte";

  let { mode }: { mode: "add" | "remove" } = $props();

  const drafts = getDraftsContext();
  const selection = getSelectionContext();
  const query = getQueryContext();

  let open = $state(false);
  let anchor = $state<HTMLElement>();
  let draftTags = $state<string[]>([]); // 面板自己的暫存清單，關閉不套用就作廢

  const label = mode === "add" ? "新增標籤" : "去除標籤";
  const scope = $derived(mode === "remove" ? query.facetScope : undefined);

  function handleOpen() {
    draftTags = [];
    open = true;
  }
  function handleApply() {
    if (mode === "add") drafts.handleAddTags(selection.selectedFiles, draftTags);
    else drafts.handleRemoveTags(selection.selectedFiles, draftTags);
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
    <TagInput bind:tags={draftTags} {scope} label={label} />
    <Button variant="primary" onclick={handleApply} status={draftTags.length === 0 ? "disabled" : undefined}>
      套用
    </Button>
  </div>
</Popover>
```

點擊面板外部關閉、不套用（沿用 `FilterPopover.svelte` 既有的 window click 判斷寫法）。

**待確認**：「去標籤」候選標籤範圍，temp3.md 原文是「這次選取的圖片中至少一張目前真的有的標籤」，但 `TagInput` 目前的 `scope` 機制沒有「id 在某個集合內」這種篩法可以表達。上面的骨架先用「目前頁面篩選條件」當 scope（即 `query.facetScope`，跟 `FilterPopover.svelte` 同一套機制），候選會反映篩選結果內流通的標籤，但不保證每個候選都恰好被選取的那幾張圖使用到。如果要嚴格符合 temp3.md 原文的精確度，需要另外討論、可能要新增 `TagInput` 的 `candidates` prop。

## 2. 已知缺陷：深連結進入時卡片牆不會捲動到位置

帶 `?currentId=xxx` 深連結首次進入頁面時，Inspector 會正確展開，但 `Cards.svelte` 的

```ts
$effect(() => {
  if (activeFile === null) return;
  masonry.scrollToItem(activeFile);
});
```

依賴 masonry 版面已經量測完成（`viewportEl` 綁定、`ResizeObserver` 跑過第一次）。平常點卡片切換時頁面早就掛載完成所以沒問題，但深連結首次掛載當下 `activeFile` 一開始就非空，這個效果很可能在版面量測完成前就先執行、量不到位置直接放棄，之後也不會重試。尚未修正。

## 3. 驗收檢查清單（尚未經人工瀏覽器驗證）

- [ ] 從導覽列直接進入：排序跟其他頁面一樣是預設的 rating desc
- [ ] 從首頁詳情彈窗、compare 卡片的「編輯」按鈕進入：沿用來源頁排序/篩選條件，並直接開啟該圖片的編輯面板（深連結首次進入就要正確展開；卡片牆捲動到位置的已知問題見上方第 2 節，不在此驗證範圍）
- [ ] 只是點開編輯面板看一眼、沒有做任何修改就關閉：該圖片的卡片不會顯示「已編輯」標記，也不會被算進「檢視待提交的變更 (N)」的 N 裡
- [ ] 編輯面板：欄位顯示目前實際值，標籤/評等/名稱編輯即時反映在卡片牆的「已編輯」標記；「還原草稿」能把欄位改回原始值
- [ ] 「退回暫存區」／「取消退回」：欄位編輯區在標記退回後變成唯讀摘要；取消退回後欄位恢復可編輯，且**保留剛才編輯過的草稿內容**（重寫後刻意選擇的新行為：標記退回不會像原計畫一樣直接銷毀既有的編輯草稿）
- [ ] 審查清單：edit/revert 兩種列呈現正確；標籤新增/移除用 +/− chip 呈現（收斂門檻見上方第 3 節）
- [ ] 標籤庫影響區塊：開啟清單或變動勾選時立即顯示 skeleton；debounce 後查詢真正完成時，不論結果是「會新增/孤立標籤」還是「完全不影響」，都要正確從 skeleton 換成對應文字（不會卡在 skeleton 不放，也不會在查詢完成前提早顯示結果）
- [ ] 提交：混合 edit + revert 一次送出成功；部分失敗時個別標示原因、不整批回滾
- [ ] 離開頁面（分頁關閉、重新整理、點連結）在有未送出草稿時會提示
- [ ] 批次選取（需等上方第 1 節實作完成後才能測）：全選（含三態）、評等選單、加/去標籤面板、標記退回，皆正確套用到所有選取圖片的草稿且不立即送出；「去標籤」的候選反映目前頁面篩選條件下的標籤
