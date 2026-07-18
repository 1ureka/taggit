# /tags 審查資料流二次清理：計畫（未實作）

沿用 `/tagger` 已驗證過的模式（`reviewEntry.ts` 把「勾選狀態／可勾選與否」一次算好、`ReviewModal` 只從 `entries` 局部衍生統計、頁面層不重複維護一份總表），把 `/tags` 拉齊，並修正 `+page.svelte` 裡明確標記的 TODO bug。

---

## 結論先講

1. **`ReviewEntry` 改成 `OneOf`，但只切 3 支不是 5 支**：`to`/`mergedCount` 只有 rename 家族（rename、merge）需要、`hidden`/`visible` 兩者欄位完全相同（純粹是同一個布林的另一種標籤）。切 5 支對型別安全沒有額外好處，只是把 `kind` 的字面量集合變大；3 支已經涵蓋所有「欄位真的不同」的邊界。
2. **`checkable` 補上，且直接吃掉 `pending`**：跟 `/tagger` 的 `disabled` 算法對稱（`disabled = problem !== null || pending`），`checkable = problem === null && !pending`。算好之後 `ReviewList`/`ReviewModal` 不用再各自重算一次 `entry.problem === null`。
3. **`pendingCount`／`changeset` 這兩個 page-level `$derived` 直接刪掉**：`changesetFromBoard` 移到 `handleSubmit` 裡才呼叫一次；`Toolbar` 的 `touchedCount` 改吃 `reviewEntries.length`（這才是目前那行 TODO 的正確修法——現在餵進去的 `pendingCount` 語意上其實對應 `/tagger` 的 `readyCount`，不是 `touchedCount`，兩個数字概念不同，餵錯 prop 了）。
4. **`groups` 改成 `SvelteMap<string, MergeGroup>`（key 用 `crypto.randomUUID()`）是對的方向，但『改容器』本身不會修好 TODO 那個 bug**——bug 的真正成因是物件識別度（identity）在插入 `$state` 陣列時被分岔，跟用陣列還是 Map 無關；下面第一節有完整追蹤。真正的修法是「`MergeGroup` 物件本身在建立當下就先 `$state()` 化，再放進容器」，Map 只是讓這個修法沒有藉口被跳過（因為 Map 不會像陣列那樣偷偷幫你重新包一層代理，所以你被迫養成「只信任讀回來的參照」的習慣）。
5. **`tags/logic` 幾乎不會消散**：真正被砍掉的只有 `changesetSize`（一個函式）；`MergeGroup`/`TagChangeset`/`changesetFromBoard`/`renameKey`/`deleteKey`/`hiddenKey` 全部還在，只是 `changesetFromBoard` 的呼叫時機從「每次 render」搬到「送出當下」。

---

## 一、`+page.svelte` 那個 TODO bug 到底是什麼

```ts
// +page.svelte 現況（createGroup）
const createGroup = (tags: Tag[]) => {
  ...
  const group: MergeGroup = { id: groupSeq++, canonical, members: [...tags], mergeCount: null };
  groups.push(group);
  scheduleMergeCount(group); // ← 問題出在這裡傳的 group
};
```

```ts
const scheduleMergeCount = (group: MergeGroup) => {
  group.mergeCount = null;
  ...
  const timer = setTimeout(async () => {
    const count = await fetchUnionCount(tags);
    if (groupTimers.get(group.id)?.seq !== seq) return;
    group.mergeCount = count;
    console.log(count); // 正確 243
    console.log(group.mergeCount); // 正確 243
    // TODO: 但是畫面仍是 skeleton，直到下次觸發該組的 scheduleMergeCount
  }, 200);
  ...
};
```

### 根因：`$state` 陣列在 `push` 一個 plain object 時，會另外包一層新的 Proxy，而不是把你手上那個參照直接變成響應式

讀 Svelte 原始碼可以精確定位（`node_modules/svelte/src/internal/client/proxy.js`）。`$state([])` 回傳的陣列本身是一個 Proxy，它的 `set` trap（`groups.push(group)` 會觸發對索引屬性的 `set`）大致是：

```js
set(target, prop, value, receiver) {
  ...
  var p = with_parent(() => proxy(value)); // ← 對「你傳進來的物件」再包一層全新 Proxy
  set(s, p);                                 // ← 陣列內部存的是這個新 Proxy p，不是 value 本身
  ...
}
```

而 `proxy(value)` 建立的新 Proxy，雖然 target 跟你手上的 `group` 是同一個底層物件，但它有自己私有的 `sources`（每個屬性一個 Signal，且是**第一次透過這個 Proxy 讀取該屬性時才惰性建立**）。這代表：

- `groups.push(group)` 之後，陣列裡存的是一個新 Proxy `p`（target 雖然還是同一個 `group`，但 `p` 是全新的、獨立的響應式包裝）。
- 你手上的 `group`（`createGroup` 閉包裡那個）**還是原本那個 plain object 參照，不是 `p`**。
- `scheduleMergeCount(group)` 用的正是這個閉包裡的舊參照，之後不管是同步的 `group.mergeCount = null` 還是非同步的 `group.mergeCount = count`，都是**直接改到底層 target 的屬性**，完全繞過了 `p` 的 Proxy trap——沒有觸發任何 Signal，Svelte 的響應式系統根本不知道發生了寫入。
- 但模板 `{#each groups as group}` 綁定的 `group` 是**讀陣列拿到的 `p`**（真正的 Proxy）。`p.mergeCount` 第一次被模板讀到時（顯示 Skeleton 那次），會 lazily 建立一個 Signal，值是**當下**底層 target 的 `mergeCount`。之後底層被直接改掉，這個 Signal 完全不會被通知——UI 卡住。
- 為什麼「下次觸發該組的 `scheduleMergeCount` 就會恢復正常」？因為下一次呼叫（不管是打字觸發的 `onchange={() => scheduleMergeCount(group)}`，還是 `addToGroup` 裡 `groups.find(...)` 找到的）用的 `group` 都是**從響應式陣列讀出來的 `p`**，這次是真的透過 Proxy 的 `set` trap 寫入，會正確通知 Signal——連帶把上一輪被繞過的值也一併「補顯示」出來（因為底層 target 早就是新值了，只是 Signal 沒被通知；這次寫入順便把 Signal 更新到跟 target 一致）。

`addToGroup` 之所以沒這個問題，是因為它一直用 `groups.find((x) => x.id === groupId)` 重新從響應式陣列讀出正確的 `p` 再操作；只有 `createGroup` 這條路徑，圖快直接用了 push 前的原始參照。

### 那換成 `SvelteMap` 能解決嗎？—— 不能，光換容器沒用

`node_modules/svelte/src/reactivity/map.js` 的文件註解寫得很直白：

> Note that values in a reactive map are _not_ made deeply reactive.

`SvelteMap.set(key, value)` 只是 `super.set(key, value)` 存進原生 `Map`，**不會**像 `$state` 陣列的 `set` trap 那樣對 `value` 再包一層 `proxy()`。也就是說如果只是把 `groups` 從 `$state<MergeGroup[]>([])` 換成 `new SvelteMap<string, MergeGroup>()`，然後照舊塞 plain object 進去、照舊直接 `group.mergeCount = x`——**這樣的欄位層級變動完全不會觸發任何響應式更新，甚至比現在的陣列版本更糟**（陣列版本至少「下一次透過容器讀回來的操作」還救得回來；Map 版本因為從不深層代理，永遠救不回來，除非每次都整包 `map.set(id, {...group, mergeCount: x})` 重新塞一次）。

### 真正的修法：`MergeGroup` 物件在建立當下就先 `$state()` 化

```ts
const group = $state<MergeGroup>({
  id: crypto.randomUUID(),
  canonical,
  members: [...tags],
  mergeCount: null,
});
groups.set(group.id, group); // SvelteMap 不會再包一層，存進去的就是這個 Proxy 本身
scheduleMergeCount(group);   // 之後不管誰拿到這個參照（閉包／groups.get()／迭代），都是同一個 Proxy
```

`$state(...)` 在建立當下就把 `group` 變成 Proxy（`proxy.js` 的 `get`/`set` trap 直接掛在這個物件上），**之後不會再被任何容器重新包一層**（因為 `SvelteMap.set()` 不做這件事）。所以不管是 `createGroup` 閉包裡留著的參照、還是之後 `groups.get(id)` 讀回來的參照、還是模板 `{#each groups.values() as group}` 迭代拿到的參照，都是**同一個** Proxy——對它的任何欄位寫入都會正確觸發 Signal。這才是根治，不是「換個容器碰運氣」。

換句話說：**`SvelteMap` 這個決定是對的，但對的理由不是「Map 比較會做深層代理」（事實正好相反，Map 完全不做），而是「Map 的『不做深層代理』逼你必須自己在建立當下就把物件變成真正的響應式參照，不能再依賴容器插入時的隱性重包裝」**。順便解決的額外好處：`members: Tag[]` 這個巢狀陣列欄位既然 `group` 本身已經是 `$state` 物件，讀取 `group.members` 時 Svelte 一樣會遞迴代理它，`g.members.push(...)`／`g.members = g.members.filter(...)` 全部維持可用，不用額外處理。

（附帶一提：這個檔案裡已經有 `const selected = new SvelteMap<string, Tag>();` 的先例，但 `selected` 存的是唯讀快照 `Tag`，從不做欄位層級變動，所以不會踩到這個坑；`groups` 不一樣，`canonical`/`members`/`mergeCount` 都要能被欄位層級改寫，所以才需要額外的「建立當下就 `$state()` 化」這一步。）

---

## 二、逐項評估

### 1.（含 3、5）`ReviewEntry` 補上 `checkable`；砍掉 `pendingCount`；`Toolbar` 的 prop 接錯

現況三個問題其實是同一條線：

- `ReviewList.svelte` 現在有兩處各自重算 `entry.problem === null`（`checkableCount` 一次、傳給 `ReviewListItem` 的 `checkable` 一次），沒有單一事實來源。
- `+page.svelte` 的 `pendingCount = changesetSize(changeset)`，語意是「畫布上有幾筆操作」，但這其實就是 `reviewEntries.length`（比對 `/tagger`：`touchedCount={touchedFiles.length}`，直接用陣列長度，沒有另外包一層 `touchedFiles`→別的數字的轉換）。
- 目前 `<Toolbar touchedCount={pendingCount} />` 這行就是把「總筆數」的 prop 塞進了語意對不上的值——`pendingCount` 這個名字／算法，實際對應的反而是 `/tagger` 的 `readyCount`（`reviewEntries.filter((e) => !e.disabled).length`，即「可送出」的子集合筆數），不是「總筆數」。兩個数字現在的實作剛好一樣（因為現況沒有「不可送出但仍算一筆」的過濾差異太大），所以肉眼看不出接錯，但概念上是錯的、未來只要出現「畫布上有操作但暫時不可送出」的情境（例如本來就有的 rename 目標碰撞檢查）就會露餡。

修法比對 `/tagger` 的 `reviewEntry.ts`／`ReviewModal.svelte` 一比一對齊：

- `buildReviewEntries` 新增 `pending: boolean` 參數，在既有的 `finish(key, problem)` 內順便算 `checkable = finalProblem === null && !pending`，回傳值多一個 `checkable` 欄位。
- `toggleAllEntries` 內的 `entries.filter((e) => e.problem === null)` 改成 `entries.filter((e) => e.checkable)`。
- `ReviewModal.svelte` 比照 `/tagger`，自己用 `$derived` 算 `checkedCount`／`checkableCount`（不是靠 `+page.svelte` 傳下來），往下傳給 `ReviewList`／`ReviewFooter`。
- `ReviewList.svelte` 拿掉自己算 `checkableCount` 那行，改吃 prop；`checkable={entry.problem === null && !pending}` 改成 `checkable={entry.checkable}`。`pending` prop 保留（tags 特有的 `discardable={!pending}` 還需要它，`/tagger` 沒有「捨棄單筆」功能所以不用留這個 prop）。
- `+page.svelte`：刪掉 `pendingCount`/`changeset` 兩個 `$derived`（見下一項），`<Toolbar touchedCount={reviewEntries.length} />`，`beforeNavigate`/`beforeunload` 的守衛也改讀 `reviewEntries.length`（比對 `/tagger` 用 `touchedFiles.length` 而不是 `readyCount`，守衛看的是「有沒有東西留在畫布上」，不是「有幾筆可送出」）。

### 2. `ReviewEntry` 用 `OneOf`

現況 `ReviewEntry` 是一個扁平物件，`kind: "rename" | "delete" | "hidden"` 只有三種，但 `merge`/`hidden` 方向另外用 `merge?: boolean`／`hidden?: boolean` 兩個獨立可選欄位表達，導致：

- `ReviewList.svelte` 要另外寫一個 `entryKind()` 把 `(kind, merge, hidden)` 三個欄位重新組合成 `ReviewImpact`/`ReviewListItem` 實際要的 5 種展示用 `kind`（`"rename"|"merge"|"delete"|"visible"|"hidden"`），邏輯重複而且跟資料模型脫節。
- 存取 `.to`/`.mergedCount`/`.hidden` 沒有被型別擋住是否對應正確的 `kind`——理論上 `kind === "delete"` 的項目讀 `.to` 也不會被 TS 抱怨（只是 `undefined`），全靠人肉記得哪個欄位屬於哪個 `kind`。

改法：讓 `buildReviewEntries` 直接算出最終的展示用 5 值 `kind`（`merge`/`rename` 依 `isMerge` 決定、`hidden`/`visible` 依目標值決定），`ReviewList.svelte` 的 `entryKind()` 整個刪掉，直接讀 `entry.kind`。

型別上用專案既有的 `OneOf`（`$lib/types`），但只切 **3 支**而不是 5 支——切分依據是「欄位形狀是否真的不同」，不是「展示標籤有幾種」：

```ts
import type { OneOf } from "$lib/types";

type EntryCommon = {
  key: string;
  name: string;
  count: number;
  problem: string | null;
  checked: boolean;
  checkable: boolean;
};

type RenameFamily = EntryCommon & {
  kind: "rename" | "merge";
  /** 目標名稱 */
  to: string;
  /** 合併後張數；只有 merge 才可能有值，尚無結果或本來就是 rename 時為 undefined */
  mergedCount?: number;
};

type DeleteEntry = EntryCommon & { kind: "delete" };

type HiddenFamily = EntryCommon & { kind: "hidden" | "visible" };

export type ReviewEntry = OneOf<[RenameFamily, DeleteEntry, HiddenFamily]>;

/** 給 ReviewImpact / ReviewListItem 共用，不用各自手刻一份字面量聯集 */
export type ReviewEntryKind = ReviewEntry["kind"];
```

`hidden`/`visible` 兩者欄位完全相同（純粹同一個布林的兩種標籤），沒有必要拆成兩支——拆成兩支對「消費端不用猜欄位」這個目標沒有任何額外貢獻，只是讓 `kind` 的字面量變多。真正需要型別擋下來的是「delete/hidden 不該有 `.to`/`.mergedCount`」，3 支已經完整涵蓋。

`ReviewImpact.svelte`/`ReviewListItem.svelte` 的 `kind` prop 型別改成 `import type { ReviewEntryKind } from "./reviewEntry";`，不用再各自手寫一份 5 字面量聯集；`ReviewList.svelte` 組裝 `<ReviewImpact>` 時直接 `kind={entry.kind}`（不再呼叫 `entryKind(entry)`）、`mergedTo={entry.kind === "rename" || entry.kind === "merge" ? entry.to : undefined}` —— 這裡如果想更乾淨，`ReviewImpact` 的 props 也可以考慮改吃「narrow 過的 entry 子集」而不是一堆手動摘出來的散裝欄位，但這會動到 `ReviewImpact`/`ReviewListItem` 的介面設計，不是這次的必要範圍，先不展開，列進第五節的收斂清單。

補充：`key`（`rename:foo`／`delete:bar`／`hidden:baz`）跟這裡的展示用 `kind`是兩套獨立系統——`key` 是操作層級的識別碼（3 種前綴，對齊 `tags-batch` 的 wire 格式跟 `discardBoardKey` 的 parse 邏輯），`kind` 是展示層級的分類（含 merge/visible 的細分）。`renameKey`/`deleteKey`/`hiddenKey` 不受這次改動影響。

### 4. 不再有 eager `changeset` derived

現況：

```ts
const changeset = $derived(changesetFromBoard(groups, deleteList, toggleList));
const pendingCount = $derived(changesetSize(changeset));
```

`changeset` 除了餵給 `pendingCount`，唯一其他用途是 `handleSubmit` 裡的 `submitChangeset(changeset, keys)`。既然 `pendingCount` 整個不需要了（見上），`changeset` 這個 derived 也沒有存在理由——它的計算成本雖然不高，但「每次畫布任何變動都重算一份完整變更集，只為了在使用者真的按下送出的那一刻用一次」本身就是不必要的常駐開銷，改成 `handleSubmit` 內才呼叫：

```ts
const handleSubmit = async () => {
  const keys = reviewEntries.filter((e) => e.checked).map((e) => e.key);
  if (keys.length === 0 || pending) return;

  pending = true;
  try {
    const cs = changesetFromBoard([...groups.values()], deleteList, toggleList);
    const result = await submitChangeset(cs, keys);
    ...
```

### 6. `groups` 改 `SvelteMap<string, MergeGroup>`

除了第一節解掉的 bug，額外好處：

- `dissolveGroup`/`detachFromBoard` 清空的堆現在可以直接 `groups.delete(g.id)`，不用再 `groups = groups.filter(...)` 整包重新賦值。
- `addToGroup` 從 `groups.find((x) => x.id === groupId)`（O(n)）變成 `groups.get(groupId)`（O(1)）。
- `dissolveGroup(groupId: string)` 對齊 uuid key，`handleDrop` 裡 `target.startsWith("group:")` 分支的 `Number(target.slice(6))` 要拿掉（改吃字串本身）。
- 離開頁面重置畫布：`groups = []` 改 `groups.clear()`。
- 模板 `{#each groups as group (group.id)}` 改 `{#each groups.values() as group (group.id)}`。

`groupSeq`（目前的遞增數字計數器）整個刪掉，改 `crypto.randomUUID()`。`groupTimers: Map<number, ...>` 的 key 型別也要跟著改成 `string`（這個 Map 純粹是內部記帳用，不需要是 `SvelteMap`）。

### 7.（原第 5 點）`tags/logic` 消散範圍

盤點下來，`logic/changeset.ts` 幾乎全部留下：

| 匯出 | 去留 | 原因 |
| --- | --- | --- |
| `MergeGroup` | 留 | 畫布狀態的型別，`reviewEntry.ts` 也要用 |
| `TagChangeset` | 留 | `submitChangeset` 的參數型別 |
| `changesetFromBoard` | 留，呼叫時機搬到 `handleSubmit` | 見上 |
| `changesetSize` | **刪** | 唯一用途 `pendingCount` 已經整個不需要 |
| `renameKey`/`deleteKey`/`hiddenKey` | 留 | `reviewEntry.ts` 組 `key`、`api.ts` 的 `toPayload` 篩選都要用 |

`logic/api.ts` 不受影響（`submitChangeset` 本來就是「呼叫時才帶完整變更集進來」的介面，呼叫時機從 `+page.svelte` 的角度搬動，介面本身不用改）。

`MergeGroup`/`buildReviewEntries` 的參數型別建議從 `MergeGroup[]` 放寬成 `Iterable<MergeGroup>`，呼叫端不管是陣列還是 `SvelteMap.values()` 都不用先手動 `[...groups.values()]` 才能傳（`changesetFromBoard`/`buildReviewEntries` 內部本來就是單純 `for...of`，不依賴陣列方法）。

---

## 三、受影響檔案清單

| 檔案 | 改動 |
| --- | --- |
| `tags/review/reviewEntry.ts` | `ReviewEntry` 改 `OneOf`（3 支）；`buildReviewEntries` 加 `pending` 參數、輸出 `checkable`、直接算 5 值 `kind`；`toggleAllEntries` 改讀 `checkable` |
| `tags/review/ReviewList.svelte` | 刪 `entryKind()`；`checkableCount`/`checkedCount` 改吃 prop；`checkable` 改讀 `entry.checkable` |
| `tags/review/ReviewModal.svelte` | 新增 `checkableCount` 本地 `$derived`，連同既有 `checkedCount` 往下傳 |
| `tags/review/ReviewListItem.svelte`、`ReviewImpact.svelte` | `kind` prop 型別改 import `ReviewEntryKind` |
| `tags/logic/changeset.ts` | 刪 `changesetSize`；`MergeGroup`（型別本身不變，但用途說明可以更新）；`changesetFromBoard`/`buildReviewEntries` 參數放寬為 `Iterable<MergeGroup>` |
| `tags/+page.svelte` | `groups` 改 `SvelteMap<string, MergeGroup>`；`createGroup` 內 `$state()` 化再 `set`；刪 `groupSeq`／`changeset`／`pendingCount`；`handleSubmit` 內才呼叫 `changesetFromBoard`；`Toolbar touchedCount={reviewEntries.length}`；`beforeNavigate`/`beforeunload` 改讀 `reviewEntries.length`；`handleDrop` 拿掉 `Number()` 轉換；模板 `{#each groups.values() ...}` |

不受影響：`logic/api.ts`、`ReviewHeader.svelte`、`ReviewFooter.svelte`、`zone/*`（除了 `+page.svelte` 傳入的 id 型別從 number 變 string，`ZoneContainer`/`ZoneHeader`/`ZoneBodyGroup` 本身不關心 id 型別，只是原樣透傳字串插值）。

---

## 四、待收斂問題清單（已收斂）

1. `ReviewImpact.svelte`/`ReviewListItem.svelte` 改成直接吃 `entry: ReviewEntry`（不再是散裝欄位）。**已採用**：`ReviewListItem` 內部直接渲染 `<ReviewImpact {entry} />` 與 `entry.problem`，`children`/`problem` 兩個 snippet prop 整個移除，`ReviewList.svelte` 只需要 `<ReviewListItem {entry} discardable={!pending} ontoggle={...} ondiscard={...} />`。
2. `ReviewFooter.svelte` 的 `checked` prop 命名。**維持原樣**，不改。
3. `crypto.randomUUID()` 直接用瀏覽器原生 API。**確認可用**，非收斂問題。

---

## 五、實作完成

`npm run check`（0 errors / 0 warnings）、`npm run test`（514 passed，本次改動不涉及後端/測試涵蓋範圍）、`npm run build` 全部通過。

- `reviewEntry.ts`：`ReviewEntry` 改成 `OneOf<[RenameFamily, DeleteEntry, HiddenFamily]>`（3 支，依欄位形狀切分，`hidden`/`visible` 共用同一形狀）；`buildReviewEntries` 新增 `pending` 參數，直接算出 5 值展示用 `kind` 與 `checkable`；`toggleAllEntries` 改讀 `checkable`。
- `ReviewImpact.svelte`／`ReviewListItem.svelte`：改吃 `entry: ReviewEntry`，`ReviewListItem` 內部自行渲染 `ReviewImpact` 與 problem 訊息，不再靠 `entryKind()` 或散裝欄位猜形狀。
- `ReviewList.svelte`：`checkableCount`/`checkedCount` 改吃 prop（`ReviewModal.svelte` 新增本地 `checkableCount` derived，比照 `checkedCount` 的既有作法）。
- `logic/changeset.ts`：刪 `changesetSize`；`MergeGroup.id` 型別改 `string`；`changesetFromBoard` 參數放寬為 `Iterable<MergeGroup>`。
- `+page.svelte`：
  - `groups` 改 `SvelteMap<string, MergeGroup>`；`createGroup` 建立時先 `$state<MergeGroup>({...})` 化再 `.set()`，解掉 TODO 那個 proxy identity bug；`groupSeq` 刪除，改 `crypto.randomUUID()`。
  - 刪 `changeset`/`pendingCount` 兩個 page-level derived；`handleSubmit` 內才呼叫一次 `changesetFromBoard`。
  - `Toolbar touchedCount={reviewEntries.length}`（修正原本誤餵 `pendingCount` 的 TODO）；`beforeNavigate`/`beforeunload` 守衛同樣改讀 `reviewEntries.length`；離開時重置畫布改 `groups.clear()`。
  - `handleDrop` 拿掉 `Number()` 轉換（group id 現在是字串）；模板 `{#each groups.values() as group (group.id)}`。
- 最後跑過 grep 排查，確認沒有殘留 `changesetSize`/`pendingCount`/`entryKind`/`groupSeq` 等已移除識別碼的引用。
