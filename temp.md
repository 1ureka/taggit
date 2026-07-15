# StagedList 投影型別分析（分析用，尚未實作）

## tagger-b 的 StagedGrid 到底要顯示什麼

看完 `tagger-b/list/StagedGrid.svelte` + `logic/stamp.ts` + `list/Toolbar.svelte` + `list/SessionProgress.svelte`，每張卡片需要的資料是：

- 縮圖 `imgSrc(file, "sm")`
- 是否為目前檢視中（`class:current`，還會被拿去做 `scrollIntoView`）
- 是否 touched（`isTouched(draft)`）——決定要不要顯示「已編輯」標記列
- 若 touched：ready/blocked 狀態（`isReady`/`problemOf`）決定顯示打勾還是警示圖示，圖示 title 帶 `problemOf` 文字
- 若 touched：draft 摘要行——`rating`（★數字）、`tags.length`（幾個標籤）、`name.trim()`（引號包住的名稱）
- 圖章模式（`stamp: Stamp | null`）是**整個 grid 層級**的狀態，不是逐卡資料：卡片只依賴這個全域旗標切換 `onclick` 要打 `onstamp(file)` 還是選取，沒有任何卡片專屬的圖章欄位（來源卡片也沒有特殊樣式）。`Toolbar`/`SessionProgress` 也只吃彙總數字（`total`/`touchedCount`/`readyCount`），不是逐卡資料。

結論：卡片需要的 6 樣東西（imgSrc、name、rating、tags、problem、是否 touched）裡，前 5 樣**跟 `ReviewEntry` 長得很像**，只是最後的旗標不同（`ReviewEntry` 是 `checked`/`disabled`，這裡是 `touched`/`current`）。

## 不抽共用型別，`stagedEntry.ts` 自己獨立一份

跟 `ReviewEntry` 長得像，但**不**抽出共用的 `DraftView`/`viewDraft()`——這大概是 tagger 路由狀態投影拼圖的最後一塊，兩份重複不算多，獨立寫反而讓 `list/` 跟 `review/` 兩個 domain 各自完整、互不牽動，之後想單獨調整某一邊的顯示規則（例如 list 的縮圖尺寸、review 的失敗訊息格式）不會不小心動到另一邊。維持 `review/reviewEntry.ts` 原樣，新增一個平級、自成一體的 `list/stagedEntry.ts`：

```ts
// list/stagedEntry.ts（新檔，跟 review/reviewEntry.ts 平級，不共用）
import { imgSrc } from "$lib/image/client";
import { isTouched, problemOf, stripExt, type Draft } from "../inspector/draft";

export type StagedEntry = {
  filename: string;
  imgSrc: string;
  name: string;
  rating: number;
  tags: string[];
  /** 不可提交的原因（null = 可提交），只有 touched 時才有意義 */
  problem: string | null;
  /** 是否已被使用者編輯過（有任何內容） */
  touched: boolean;
  /** 是否為目前檢視中的檔案 */
  current: boolean;
};

export function buildStagedEntry(filename: string, draft: Draft, current: boolean): StagedEntry {
  return {
    filename,
    imgSrc: imgSrc(filename, "sm"),
    name: draft.name.trim() || stripExt(filename),
    rating: draft.rating,
    tags: draft.tags,
    problem: problemOf(draft),
    touched: isTouched(draft),
    current,
  };
}
```

## 一個容易漏掉的地雷：drafts 現在是延遲建立的

`+page.svelte` 這輪改過之後，`drafts[file]` 只在使用者**選取**該檔案時才會被建立（`selectFile` 裡 `drafts[file] ??= emptyDraft()`）。清單要顯示**全部** `data.stagedFiles`，但大多數檔案可能從沒被點過、`drafts[file]` 是 `undefined`。

投影必須容忍這件事，且**不能因為算投影就順便建立 draft**（那會在一個 `$derived` 裡產生寫入副作用，違反目前整個 route 在做的「衍生值只讀不寫」原則）。所以呼叫端要這樣寫：

```ts
const stagedEntries = $derived(
  data.stagedFiles.map((f) => buildStagedEntry(f, drafts[f] ?? emptyDraft(), f === validCurrentFile)),
);
```

`emptyDraft()` 只是拿來算顯示值，不寫回 `drafts`——只有 `selectFile` 才會真的建立。

## StagedList 的新介面（提案）

```ts
type Props = {
  entries: StagedEntry[];
  onselect: (file: string) => void;
  // 圖章模式是之後的事，先不列；到時會是額外兩個 grid 層級的 prop（stamp、onstamp、onexitstamp），不是投影欄位
};
```

`isTouched` 這個 callback prop 整個消失——`touched` 已經是 `entries[i].touched`。`currentFile`/`activeFile` prop 也可以整個消失，改成讀 `entries[i].current`；如果之後要做「捲動到目前卡片」的效果（tagger-b 有這個），可以在元件內部用 `entries.find(e => e.current)?.filename` 找目標，不需要額外一個 `activeFile` prop 重複同一個資訊。

## 順便看到的一個小優化空間（不是這次的重點，先記錄）

`+page.svelte` 現在的 `touchedFiles = $derived(data.stagedFiles.filter((f) => drafts[f] && isTouched(drafts[f])))` 跟未來的 `stagedEntries` 其實在做重疊的判斷（isTouched）。如果先算 `stagedEntries`，`touchedFiles` 可以改成 `stagedEntries.filter((e) => e.touched).map((e) => e.filename)`，少一次獨立的 `isTouched` 呼叫迴圈。要不要做看你，不影響正確性，純粹避免重複邏輯。

## 這次不動的部分

- 圖章模式（`stamp`/`StampTool`/`stamp.ts`）本來就不需要投影欄位，維持 grid 層級的獨立 state，之後直接照 tagger-b 抄過來即可。
- `Toolbar`/`SessionProgress` 吃彙總數字（`total`/`touchedCount`/`readyCount`），不受這次投影變動影響，`touchedCount` 可以從 `touchedFiles.length` 或 `stagedEntries.filter(e=>e.touched).length` 算，`readyCount` 目前专案還沒有「ready」概念（`disabled` 是 review 專用的，list 端目前只需要 touched/problem），要顯示的話用 `stagedEntries.filter(e => e.touched && e.problem === null).length`。
