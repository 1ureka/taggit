# /tags mergeCount 查詢式重構評估（temp3）

診斷對象：`(app)/tags` 目前用「單一全域變更集預覽」驅動 mergeCount／刪除清空警告／存在性檢查，你認為根本問題是把「其實只需要查一個 union」的小事，包成了一整套 changeset projection 機制。本檔是逐行核對程式碼後的評估，不是實作。

## 結論先講

你的診斷是對的，而且比你講的更徹底：**真正需要打後端的只有 mergeCount（union），刪除區、隱藏區現在其實完全不需要碰後端。** 目前它們會觸發全域預覽查詢，純粹是因為 `schedulePreview()` 是無差別地綁在所有畫布操作上，不是因為刪除/隱藏的顯示真的需要查詢結果。

但這個重構的真實刪除範圍比你列的「tags/logic 可能消散」大得多、也不在那個資料夾裡——真正整組消失的是 `$lib/query/changeset.ts`、`$lib/query-spec/changeset.ts`、`Query.changeset()` facade、`api/proto/tags-preview` 端點。這件事我已經 grep 過全專案確認除了 `/tags` 沒有其他呼叫者，砍掉不會波及 `/compare` 或 `/tagger`。

第一輪收斂後，Skeleton 做法、merge/rename 精準度、GET 參數格式都已定案（見第三、五節）；唯一還沒收斂的是 mergedCount 的命名，以及要不要順手幫 `rename`/`delete` 補上目前完全沒有的 `not_found` 檢查（技術上可行、成本低，建議做，細節見 3.1）。

## 一、現況資料流複核

`+page.svelte` 用一個全域 `projection: ChangesetPreview | null` + `projectionPending`，300ms debounce，`schedulePreview()` 被綁在**所有**畫布變動上——不只是 group 改名/成員增減，連 `addToZone`／`clearDeleteList`／`clearToggleList`（刪除區、隱藏區的加入/清空）也都呼叫它（`+page.svelte:104,114,119`）。每次都打 `POST /api/proto/tags-preview`，帶著**整個**變更集，換回：

- `ChangesetEngine.preview()`（`$lib/query/changeset.ts:13-19`）拆成三塊：
  - `statuses()`：referenced 標籤的 `exists/count/hidden`。count、hidden 其實跟畫布上的 `Tag` 快照重複（拖上畫布那一刻就有），差別只在 `exists`。
  - `mergedCounts()`：對每個 rename 目標，把來源＋目標的位圖做 `orInPlace` 聯集（`changeset.ts:44-65`）——這就是你說的「其實只是 union」，逐行核對後完全屬實，就是一個 `BitSet` 迴圈聯集再 `.size()`。
  - `emptied()`：刪除會不會讓圖片變成零標籤，是唯一**真的**需要「跨圖片交集式」計算、前端算不出來的部分（要看同一張圖片的標籤是不是全部都在刪除集合內）。

也就是說：刪除區、隱藏區只用到 `statuses()` 的 `count/hidden/exists`，而 `count/hidden` 本來就在畫布 `Tag` 快照裡，唯一「現查」的價值是 `exists`（偵測外部改動）。這與你的推測一致：`mergeCount` 是唯一真正需要即時查詢的數字。

## 二、逐項評估你的 5 個預期改動

### 1. 觸發者改成 group 自查、review 純投影、各查各的

同意，而且範圍比「換個觸發位置」更大：刪除區/隱藏區完全不需要接觸後端。`addToZone`/`clearDeleteList`/`clearToggleList` 裡的 `schedulePreview()` 呼叫（`+page.svelte:104,114,119`）可以整段刪掉，不是移到別的層級——這兩區從此對後端零查詢。

只有 `groups` 需要「各查各的」debounce+query：
- `MergeGroup` 型別加一個 `mergeCount: number | null`（`logic/changeset.ts:10-14`）。
- `createGroup`/`addToGroup` 呼叫「該 group 自己的」排程函式，不再呼叫全域 `schedulePreview()`。
- `detachFromBoard(name)` 目前無腦對每個 group 都 `filter` 一次、不管有沒有命中（`+page.svelte:71-77`）。要改成先找出真正命中的 group，只 reschedule 那一個——不然「各查各的」會退化成「還是全部查一次，只是分開發 request」。
- Review 端不再拿一個共用 `projection`，而是直接讀 `group.mergeCount`（見第四節型別草案）。

### 2. `Query.union`-類方法，不設 query-spec，直接寫在 `query/index`

可行性已核對：`db.tagBits(name): BitSet | null`（`$lib/database/store.ts:187`）＋ `BitSet.orInPlace/clone/size`（`bitmap.ts`）就是 `ChangesetEngine.mergedCounts()` 在做的事，逐行等價。「找不到的是空集合」也已經是現有語意：`tagBits` 找不到回 `null`，`acc ?? 0` 的 fallback 就是空集合聯集。

命名（補充討論，尚未定案）：你澄清了原本「不要直接稱為 union」的限制只針對「字面上就叫 union」，不是排斥 union 這個概念家族。整理幾個候選：

| 候選 | 理由 | 疑慮 |
|---|---|---|
| `Query.mergedCount(tags)` | 跟現有詞彙對齊——`ChangesetPreview.mergedCounts`（雖然整個型別要刪）、`ZoneBodyGroup`/`MergeGroup` 的 `mergeCount` prop 都已經在用這個字 | 隱含「這是給合併用的」，如果以後有別的地方也想用同一個 union count（例如畫多標籤 AND/OR 篩選的統計），語意上會有點名不符實 |
| `Query.unionCount(tags)` | 直接、精確描述「這是集合聯集大小」，滿足「不要裸用 union」（有 Count 後綴限定），不會誤導成別的意思 | 是資料結構詞彙而非領域詞彙，跟 `projectChangeset→previewChangeset` 那次「避開技術詞彙、改用領域詞彙」的既有考量方向相反 |
| `Query.anyTagsCount(tags)` | 對齊 memory 裡記錄的「OR/anyTags 查詢」既有 API 整理候選（見 `phase0-status` 第七輪備註）——語意是「符合這些標籤中任一個的圖片數」，如果以後真的要做一個通用的 OR 標籤篩選查詢，這個方法可以直接被那個需求收編，不用重複造一個 | 目前 `/tags` 這裡的呼叫情境是「合併預覽」，用 `anyTags` 命名要多轉一層才想到是在做合併預估 |

我傾向 `mergedCount`（跟現場既有詞彙密度最高、最快看懂），但 `anyTagsCount` 有「順便對齊未來 OR 查詢整理」的加分，兩個都合理，你選一個即可，我沒有強烈立場。端點路徑會跟著方法名走（例如 `tags-merged-count` 或 `tags-any-count`）。

端點：不需要包一層 query-spec class。tag 名稱本來就禁止逗號（`isValidTagName` / `Validator.tagName`），`ImageWhere.includedTags` 已經用逗號分隔編碼＋`parseTags()` 解析（`query-spec/search-params.ts:7-13`），可以直接重用同一個 helper（它目前沒被 barrel 匯出，深路徑 import 或補一行 export 都行）。**已確認採用**：

```
GET /api/proto/tags-merged-count?tags=a,b,c  ->  { count: number }
```

不需要新的 `+server.ts` 之外的任何檔案。

### 3. mergeCount 本身即 pending 訊號，200ms debounce

同意，這會讓 `previewPending` 整條傳遞鏈消失：
- `ReviewModal` 的 `previewPending` prop 整個拿掉（`review/ReviewModal.svelte:16,29,37`）。
- `ReviewHeader` 的 `CircularProgress` + 「正在更新預估…」整段砍掉（`ReviewHeader.svelte:11-14`）。
- `ZoneBodyGroup` 現在的 `{count ?? "…"} 張` 純文字 fallback（`ZoneBodyGroup.svelte:38`）跟 `ReviewImpact` 的 `mergedCount` 顯示都要換成 Skeleton。

**卡點（已決定）**：`$lib/components` 目前沒有 Skeleton 元件，`lab` 也沒有對應的 use case（`display/` 底下只有 `CircularProgress/Chip/LinearProgress/MarkupText/ImageCanvas/NavigationIndicator`）。已定案走 local 方案——比照 `ChipTooltip.svelte` 現在就在用的 pulse placeholder（同檔案 `.thumb.placeholder` + `@keyframes pulse`，`ChipTooltip.svelte:105-125`），在 `ZoneBodyGroup`／`ReviewImpact` 各自路由本地刻一個小 skeleton span，不升級成 `$lib/components` 正式元件、不建 lab 展示頁。

### 4. `onrename`/`onactive` 合併成純粹 `() => void`

同意，而且可以做得更乾淨。目前 `onactive(name)` 在 `+page.svelte` 只做一件事：`setCanonical(groupId, name)` 也就是 `g.canonical = name`（`+page.svelte:122-126`）——這跟 `bind:rename` 動的是同一份底層值。既然 `rename` 已經是 `$bindable()`（`ZoneBodyGroup.svelte:23`），星號按鈕可以直接在子層做 `rename = name`，不必回呼給父層改；`onactive` 整個消失，只留一個無參數、rename 有任何變動（不管是打字還是按星號）都會觸發的 `onchange: () => void`，用來排程該 group 自己的查詢。這正是你講的「底層其實是 bind」——多一層具名 callback 傳 `name` 是多餘的一步。

### 5. `tags/logic` 消散？

範圍跟你想的不同，而且更大、不在這個資料夾：

**不會消失**（因為送出流程跟查詢預覽是兩件獨立的事）：
- `logic/changeset.ts` 的 `TagChangeset` 型別、`changesetFromBoard()`、`changesetSize()`、`renameKey/deleteKey/hiddenKey`——`submitChangeset`（送到 `tags-batch`）跟 `Toolbar` 的 `touchedCount` 徽章都還吃這個型別/函式。
- `logic/api.ts` 裡的 `submitChangeset()`。

**真正整組消失**（我已 grep 全專案確認只有 `/tags` 用到，砍掉不影響 `/compare`、`/tagger`）：
- `$lib/query/changeset.ts`（`ChangesetEngine` 整個類別）
- `$lib/query-spec/changeset.ts`（`Changeset`／`ChangesetPreview` 型別）
- `$lib/query/index.ts` 的 `Query.changeset()` facade 方法
- `api/proto/tags-preview/+server.ts` 整個端點
- `logic/api.ts` 裡的 `fetchProjection()`
- `test/repo/query/changeset.suite.mjs`（17 條測試），會整份改寫成只測 `mergedCount`

`logic/` 資料夾本身只是瘦身（少了 `fetchProjection` 這條線），不會消散。

## 三、連鎖影響（你沒明講、但同源必須一起決定）

### 3.1 「已不存在」預檢查消失後的行為

`buildReviewEntries` 現在用 `projection.tags[name].exists` 擋掉三種情況：rename 來源不存在（`reviewEntry.ts:71`）、delete 目標不存在（`:90`）、hidden 目標不存在（`:99`），文案都是「已不存在，可能已被外部操作改動」。拿掉 projection 後這個檢查沒有替代資料來源——畫布上的 `Tag` 快照是拖上去那一刻的靜態值，沒辦法自證是否還存在。

我查了 `$lib/mutation/tag.ts` 確認後端行為，分兩種情況：

- **刪除造成圖片清空**：後端本身就硬擋（`tag.ts:89` `if (wouldEmpty.length > 0) return lastTag(wouldEmpty)`），跟前端有沒有預檢查無關。你說的「提交後再顯示就好」在這件事上**完全沒有資料風險**——這個檢查已經被後端保護，使用者只是會晚一輪 API 才看到同樣的錯誤訊息（`errorMessage` 的 `last_tag` 分支文字，跟現在的 `problem` 文案幾乎一樣）。而且 `tags-batch` 是逐筆處理、逐筆回結果（`+server.ts:53-82`），就算一次勾選多筆混著送，不會因為一筆失敗連累其他筆。
- **標籤本身已不存在（被外部改名/刪除）**：`renameTag`/`deleteTag`/`setTagMeta` 完全沒有 `not_found` 分支（跟圖片操作的 `updateRecord`/`removeRecord` 不同，那些真的有 `NotFound`）。`rename()` 對不存在的 `from` 只會 `affected: 0` 靜默成功（`tag.ts:37,64`）；`delete()` 對不存在的 `target` 一樣靜默 `ok`（`tag.ts:78,115`）；`setMeta()` 甚至會幫一個已經不存在（count 0）的名字重新生出一筆 meta（`tag.ts:121-129`，沒有任何存在性檢查）。

也就是說，拿掉 exists 預檢查後，「畫布上留著一個其實已經在別處被刪掉/改名的標籤」**送出時不會報錯**——會顯示「已套用 N 筆標籤操作」成功 toast，但那一筆實際上什麼都沒發生。這在單人本機工具情境下發生機率很低，但如果要接受，這是一個要明確承認、記錄成刻意決定的行為退化：從「擋下並告知」變成「靜默無效操作＋誤導性成功訊息」，跟刪除清空警告那個「純粹延後顯示、無資料風險」的情況不是同一等級。

**這個缺口可以修、但只有一半該修**（追問「這能修嗎」的回答）：

- **`rename`/`delete` 可以、也建議補上 `not_found`**。做法很小：在 `TagCommands.rename()`/`delete()` 開頭加一個存在性檢查——`db.tagBits(name)` 有值、或 `db.tagMetaEntries()` 裡有這個名字，兩者都沒有才回 `notFound()`（`result.ts:20-23` 這個 factory 已經存在，只是目前 tags 相關方法完全沒人呼叫它）。錯誤往下傳的管線**不用改**：`Result` 的錯誤型別加上 `NotFound` 只是把既有聯集用上，`tags-batch/+server.ts` 的 `errorMessage()` 早就有 `case "not_found": return "找不到目標紀錄"` 這個分支（現在只是死碼，因為沒有東西會回這個 kind）。補上後，rename/delete 兩種操作在「標籤已被外部刪掉/改名」時會在送出當下正確失敗、跳出跟現在文案很接近的錯誤，而不是靜默假成功——跟 `last_tag` 是同一種「後端本身把關、前端預檢查只是提早告知」的安全退化，不是資料風險。
- **`setTagMeta`（hidden 切換）不應該加這個檢查**。我去讀了 `api/tags/[tagName]/+server.ts` 的 `PATCH` 端點（`+server.ts:31-35`），文件註解明講：「元資料獨立於標籤的使用狀態存在，允許為目前未使用的標籤名稱設定」——這是刻意設計，不是疏漏。也就是說「隱藏切換」這件事本來就沒有被後端當成「標籤要存在才能做」的操作，現在畫布預檢查會擋下這種情況反而是比後端契約更嚴格。拿掉 hidden 這條的 exists 預檢查**不是退化，是對齊後端實際契約**。

淨結果：只要順手把 `rename`/`delete` 這個小檢查加上去（兩個方法、各三行），拿掉前端 exists 預檢查幾乎沒有行為代價——三種操作裡有兩種會在送出時正確失敗（只是比現在晚一輪 API），第三種（hidden）現在的預檢查本來就比後端設計更嚴，拿掉它是修正而不是妥協。建議把這個小補丁一併排進這輪重構的範圍。

（附帶一提：`emptiedTotal` 這個欄位算出來後其實從沒被 UI 顯示過，只有 `emptiedBy[name]` 被拿去擋 checkbox——確認 `emptied()` 的產出在畫面上只有這一個用途。）

### 3.2 merge / rename 標籤精準度

`ReviewList.svelte:23-27` 的 `entryKind` 決定顯示「合併」還是「重命名」，判斷式是 `(status(to)?.exists ?? false) || 多來源同目標`（`reviewEntry.ts:73`）。第一個條件（目標名稱本身是否已經是別的既有標籤）沒有 exists 資料就測不出來了，只剩「這個 group 有多個成員」這條線索可用。

**已決定**：規則簡化為 `isMerge = g.members.length > 1`，不再嘗試判斷目標名稱是否為既有標籤——單一成員的 group 一律顯示「重命名」，即使改名後的名字其實已經是別的既有標籤也一樣。`mergeCount` 數字本身依然正確（union 查詢本來就會把目標既有的圖片算進去），只有 UI 文案/樣式（`ReviewImpact` 的合併/重命名措辭、`ReviewListItem` 的 pill 顏色）在這個邊角情況不精準，接受。

### 3.3 per-group debounce/timer 生命週期

建議 timer/序號放在頁面層一個非 `$state` 的 `Map<groupId, ...>`（比照現有 `previewTimer` 是模組層純變數的做法，`+page.svelte:202`），不要塞進 `$state` 的 `MergeGroup` 物件裡跟 `setTimeout` handle 混在一起。group 被解散後殘留的 timer 觸發不需要主動 `clearTimeout`——反正沒人再讀那個已離開 `groups` 陣列的物件的 `mergeCount` 了，這跟 [[tagger-dataflow-pattern]] 的「不主動清除、讓它變成沒人讀的殘影」是同一個原則，只是這次殘影是一次浪費的 fetch 而不是資料。

## 四、型別/介面草案（討論用，非定案）

```ts
// logic/changeset.ts
export type MergeGroup = {
  id: number;
  canonical: string;
  members: Tag[];
  mergeCount: number | null; // null = 尚無結果（含 pending）
};
```

```ts
// $lib/query/index.ts（Query class 內新增方法，不另立 engine）
mergedCount(tags: string[]): number {
  let acc: BitSet | null = null;
  for (const name of tags) {
    const bits = this.db.tagBits(name);
    if (!bits) continue;
    acc = acc ? acc.orInPlace(bits) : bits.clone();
  }
  return acc?.size() ?? 0;
}
```

```ts
// api/proto/tags-merged-count/+server.ts
export const GET: RequestHandler = ({ url }) => {
  if (!Database.isLoaded()) return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
  const tags = parseTags(url.searchParams.get("tags"));
  const query = new Query(Database.requireLoaded());
  return json({ ok: true, data: { count: query.mergedCount(tags) } });
};
```

```ts
// zone/ZoneBodyGroup.svelte Props
type Props = {
  tags: Tag[];
  rename: string; // $bindable，星號按鈕跟輸入框都寫這個
  mergeCount: number | null;
  onremove: (name: string) => void;
  onchange: () => void; // 取代 onrename + onactive，任何會影響查詢結果的變動都觸發一次
};
```

```ts
// review/reviewEntry.ts —— 不再吃 cs + projection，直接吃畫布三塊狀態
export function buildReviewEntries(
  groups: MergeGroup[],
  deleteList: Tag[],
  toggleList: Tag[],
  checkedKeys: Set<string>,
  failures: Record<string, string>,
): ReviewEntry[]
```

## 五、待你收斂的問題清單

已收斂（本輪定案）：
- ~~Skeleton 走正式元件還是 local~~ → local pulse placeholder，比照 `ChipTooltip.svelte`。
- ~~merge/rename 精準度退化~~ → 接受，規則簡化為 `members.length > 1`。
- ~~GET 逗號分隔參數~~ → 確認採用，沿用 `includedTags` 既有慣例。

還剩：

1. `rename`/`delete` 補 `not_found` 檢查（3.1 節）——技術上可行、成本低（兩個方法各加一個存在性檢查，錯誤管線已存在），建議排進這輪一併做。`setTagMeta` 則確認不該補（後端本來就設計成與存在狀態無關）。若你同意，這條會補進實作範圍，不算是還要選邊的問題，只是想讓你知道要多動兩個小地方。
2. 命名：`mergedCount` / `unionCount` / `anyTagsCount` 三選一（見第二節表格），我傾向 `mergedCount` 但不堅持。
