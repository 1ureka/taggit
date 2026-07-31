# `/tags` 拆分 board → 異動區 + 異動集

## 這份文件的定位

`temp1.md` 的重寫已完成。這份是後續的一次**純結構調整**：把 `board.svelte.ts` 拆成兩個 controller，並清掉「畫布 / board」這個造出來的比喻。

**預期行為變更：零。** 全部是改名、搬移、以及把一個投影下放回模板。

---

## 一、為什麼拆

`board` 目前同時是兩件事：

1. **異動區**——`delete` / `hidden` / 動態的 `group`，以及「一個標籤同時只能在一個區」這條不變式與五個 `handle*` 寫入口。
2. **異動集**——把上面那份資料**轉軸**，從「區 → 標籤[]」變成「標籤 → 異動」，再對它做驗證。

轉軸是真的換了形狀，不是同一形狀的衍生欄位（對照 `committed/logic/drafts.svelte.ts`：`drafts` 的 `viewOf` / `touchedFiles` / `problemOf` 全部仍是 per-file 的同一形狀，所以留在一起是對的）。這裡不是那個情況。

拆開後兩邊各自一句話說得完，且沒有循環——`board` 內部從來沒有呼叫過 `operationOf` / `problemOf`，整個異動集叢集只讀 zones。

## 二、命名

「畫布 / board / canvas」是我在 `temp1` 階段造的詞，程式碼原本只有「區」：型別 `Zone` / `ZoneTarget`、六個 `Zone*` 元件、以及所有中文註解裡的「刪除區 / 隱藏切換區 / 合併區」。全部刪除，不損失任何既有詞彙。

| 概念 | 檔案 | 類別 | 一句話 |
| --- | --- | --- | --- |
| 異動區 | `logic/zones.svelte.ts` | `ZonesController` | 管理每個標籤被排入哪一個異動區 |
| 異動集 | `logic/changeset.svelte.ts` | `ChangesetController` | 由異動區推導出每個標籤的異動，並判斷能不能送出 |

`changeset` 不是新詞——被刪掉的 `changeset.ts` 裡本來就有 `type TagChangeset = { renames, deletes, hidden }`，註解寫「變更集」。那個檔案同時扛了「變更集」與「組 API payload」，payload 那半已經正確地進了 `submit.toPayload`，這裡是把名字還給它原本該指的東西。

### 欄位一律不帶 `Zone` 結尾

controller 叫 `zones`，若欄位保留 `Zone` 後綴會得到 `zones.zones` / `zones.groupZones`；因此四個一起去掉後綴，維持對稱：

| 現在 | 改後 | 型別 |
| --- | --- | --- |
| `board.zones` | `zones.all` | `readonly Zone[]` |
| `board.groupZones` | `zones.groups` | `readonly Extract<Zone, { kind: "group" }>[]` |
| `board.deleteZone` | `zones.delete` | `Extract<Zone, { kind: "delete" }>` |
| `board.hiddenZone` | `zones.hidden` | `Extract<Zone, { kind: "hidden" }>` |

`groups` 是複數、`delete` / `hidden` 是單數，這個不對稱是**事實**——合併區有多個，刪除區與隱藏切換區各只有一個。

> **一個要留意的點**：`delete` 當屬性名在 JS/TS 完全合法（`class C { delete = … }`），但 `this.delete.tags = []` 讀起來像在呼叫方法。若你覺得礙眼，替代方案只有「四個都保留 `Zone` 後綴、controller 改名成別的」這一條，而那會把 `board` 那類比喻請回來。目前傾向接受。
>
> 附帶好處：`ZoneTarget` 的 `kind` 恰好就是 `"delete"` / `"hidden"`，所以 `this[target.kind]` 會通過型別檢查。**但實作仍寫成明確的 `case`**——這種耦合就算編譯器擋得住，讀的人還是得自己對照兩處。

### 單位詞跟著改

異動集由「異動」組成，型別不能還叫 operation：

| 現在 | 改後 |
| --- | --- |
| `TagOperation` | `TagChange` |
| `buildOperation(zone)` | `buildChanges(zone)` |
| `board.operations` | `changeset.changes` |
| `board.operationOf(name)` | `changeset.changeOf(name)` |
| `board.problemOf(name)` | `changeset.problemOf(name)` |
| `board.chipStatus` | 刪除，下放為投影（見第四節） |

`TagChange` 的欄位（`kind` / `name` / `count` / `to` / `groupId`）全部不變，所以 `ReviewBody` 與 `ReviewItemTag` 的對接不受影響。

---

## 三、兩個 controller 的介面

### `logic/zones.svelte.ts`

保留 `ZoneTarget`、`Zone` 兩個 export（`ZoneContainer` / `ZoneHeader` / `ZoneBodyGroup` 都在用）。

```ts
class ZonesController {
  /** 合併與重命名區映射，動態增減 */
  private groupMap = new SvelteMap<string, Extract<Zone, { kind: "group" }>>();

  /** 刪除區，永不刪除的單例 */
  delete: Extract<Zone, { kind: "delete" }> = $state({ kind: "delete", tags: [] });
  /** 隱藏切換區，永不刪除的單例 */
  hidden: Extract<Zone, { kind: "hidden" }> = $state({ kind: "hidden", tags: [] });
  /** 合併與重命名區 */
  groups: readonly Extract<Zone, { kind: "group" }>[] = $derived([...this.groupMap.values()]);
  /** 目前所有的異動區，順序與畫面呈現順序一致 */
  all: readonly Zone[] = $derived([...this.groupMap.values(), this.delete, this.hidden]);

  private detach(name: string) { /* 不變 */ }
  private createGroup(tags: Tag[]) { /* 不變 */ }
  private addTo(zone: Zone, tags: Tag[]) { /* 不變 */ }

  handleAssign = (target: ZoneTarget, tags: Tag[]) => { /* 不變 */ };
  handleDetach = (names: string[]) => { /* 不變 */ };
  handleRename = (groupId: string, canonical: string) => { /* 不變 */ };
  handleDissolve = (target: ZoneTarget) => { /* 不變 */ };
  handleClearAll = () => { /* 不變 */ };
}
```

**移出去的**：`TagOperation`、`buildOperation`、`operations`、`operationsByName`、`operationOf`、`problemOf`、`MAX_NAME_LENGTH`（全進 `changeset`），以及 `chipStatus`（下放為投影）。

移完之後 `zones` 只剩四個欄位加五個 `handle*`，沒有任何驗證邏輯、沒有任何轉軸。

### `logic/changeset.svelte.ts`（新增）

```ts
import { getZonesContext, type Zone } from "./zones.svelte";

/** 一個標籤的異動 */
export type TagChange =
  | { kind: "rename" | "merge"; name: string; count: number; to: string; groupId: string }
  | { kind: "delete"; name: string; count: number }
  | { kind: "hidden" | "visible"; name: string; count: number };

/** 合併後的名稱長度上限，與 `Mutation.renameTag` 的驗證一致 */
const MAX_NAME_LENGTH = 50;

/** 扁平化單個異動區至每個標籤的異動 */
function buildChanges(zone: Zone): TagChange[] { /* 原 buildOperation，不變 */ }

class ChangesetController {
  private zones = getZonesContext();

  /**
   * 全部的標籤異動，維持異動區的呈現順序，**不應加入任何過濾**。
   * 同時是離頁守衛與審查清單的唯一依據。
   *
   * `name` 在此陣列中唯一——同一標籤只會落在一個區，且合併區會跳過與主名稱同名的成員。
   * `/api/proto/tags-batch` 用裸標籤名當結果鍵能對得上，正是靠這條不變式。
   */
  changes = $derived(this.zones.all.flatMap(buildChanges));

  private byName = $derived(new Map(this.changes.map((c) => [c.name, c])));

  /** 指定標籤目前的異動，沒有排入任何異動區時為 `undefined` */
  changeOf(name: string): TagChange | undefined {
    return this.byName.get(name);
  }

  /** 指定標籤的異動是否有問題，以及在有問題時的描述；沒有異動時恆為 `null` */
  problemOf(name: string): string | null { /* 原 problemOf，內部改呼叫 changeOf */ }
}
```

---

## 四、`chipStatus` 下放為投影

它是投影，而且**名字就是證據**——一個 controller 欄位以元件命名。

依 `svelte_kit_routes_controller.md` 第二節的處理順序：「需要同一份投影的元件超過一個時，先問能不能由同一個父元件算好後往下傳」。這裡是一個元件 × N 個實例，父層 `Chips.svelte` 就在那裡，所以答案是往下傳。

```svelte
<!-- body/Chips.svelte -->
<script lang="ts">
  const zones = getZonesContext();

  /** 每個標籤目前所在的區域種類 */
  const statusOf = $derived.by(() => {
    const m = new Map<string, "group" | "delete" | "hidden">();
    for (const zone of zones.all) for (const t of zone.tags) m.set(t.name, zone.kind);
    return m;
  });
</script>

{#each items as tag (tag.name)}
  <Chip {tag} status={statusOf.get(tag.name) ?? "idle"} />
{/each}
```

```svelte
<!-- body/Chip.svelte -->
let { tag, status }: { tag: Tag; status: "idle" | "group" | "delete" | "hidden" } = $props();
```

`Chip.svelte` 不再需要 `getZonesContext()`。

這件事順帶確認了切法是對的：`chipStatus` 是從「標籤在哪一區」衍生的，跟異動清單無關——`zones` 那側的東西留在 `zones` 那側，`changeset` 完全不碰。

---

## 五、逐檔改動（18 個檔案）

### `logic/`（7）

| 檔案 | 改動 |
| --- | --- |
| `board.svelte.ts` → `zones.svelte.ts` | 類別 `BoardController` → `ZonesController`；Symbol `"board-controller"` → `"zones-controller"`；`create/getBoardContext` → `create/getZonesContext`；四個欄位改名；移出異動集叢集與 `chipStatus` |
| `changeset.svelte.ts` | **新增**，內容如第三節 |
| `merge-count.svelte.ts` | `getBoardContext` → `getZonesContext`；`private board` → `private zones`；`this.board.groupZones` → `this.zones.groups`；註解「把張數查詢與畫布分開」→「與異動區分開」 |
| `drag.svelte.ts` | import 來源改 `./zones.svelte`；`private board` → `private zones`；`this.board.handleAssign` → `this.zones.handleAssign` |
| `submit.svelte.ts` | 改依賴 `changeset` **與** `zones`（讀異動用前者、成功後 detach 用後者）；`toPayload(ops: TagOperation[])` → `toPayload(changes: TagChange[])`；`this.board.operations.filter` → `this.changeset.changes.filter`；`this.board.handleDetach` → `this.zones.handleDetach`；TODO 註解裡的 `board.operations` → `changeset.changes` |
| `review.svelte.ts` | `private board` → `private changeset`；`this.board.operations.map((op) => op.name)` → `this.changeset.changes.map((c) => c.name)`；`this.board.problemOf` → `this.changeset.problemOf`；**刪除 `handleDiscard`**（見下） |
| `guard.svelte.ts` | `getBoardContext` → `getZonesContext`；`this.board.handleClearAll()` → `this.zones.handleClearAll()` |

`submit` 同時讀 `changeset`（組 payload）與 `zones`（成功後把標籤移出所在區）。這是刻意的：讓 `changeset` 開一個 `handleDiscard` 去轉呼叫 `zones.handleDetach` 只會多一個單一呼叫端的空殼方法（原則 4）。controller 之間互相呼叫公開 `handle*` 是文件允許的。

**`review.handleDiscard` 一併刪除，同理。** 它原本是 `this.zones.handleDetach([name])` 的純轉呼叫——沒有狀態變更、沒有驗證、沒有協調，且只有 `ReviewBody` 一個呼叫端。標籤被 detach 後就離開 `changeset.changes` → `names` → `batchNames`，而 `submittableNames` 是從 `batchNames` 過濾的，所以殘留的 `checked[name]` 不影響任何結果，不需要清理；送出中也不必擋，`ReviewList` 已對整個 `<ul>` 下 `inert={pending}`。

改由 `ReviewBody` 直接 `ondiscard={() => zones.handleDetach([entry.name])}`，這正是文件說的「拿 A 上下文的狀態投影，但事件傳給 B 上下文」。**`review` 因此完全不再依賴 `zones`**，相依從三個降為兩個。

### `body/`（9）

| 檔案 | 改動 |
| --- | --- |
| `Chips.svelte` | 新增 `getZonesContext` 與 `statusOf` 投影，往下傳 `status` |
| `Chip.svelte` | 移除 `getZonesContext`，改收 `status` prop |
| `Panel.svelte` | `getBoardContext` → `getZonesContext`；`board.groupZones` → `zones.groups`；**移除 `deleteTags` / `hiddenTags` 兩個別名**（你標的 TODO：純欄位存取沒有任何計算，不存在「多種構成方式」的風險），直接傳 `zones.delete.tags` / `zones.hidden.tags` |
| `ZoneContainer.svelte` | 只有 `import type { ZoneTarget }` 的來源路徑 |
| `ZoneHeader.svelte` | `getBoardContext` → `getZonesContext`，區域變數 `board` → `zones` |
| `ZoneBodyCreate.svelte` | 同上 |
| `ZoneBodyDelete.svelte` | 同上 |
| `ZoneBodyHidden.svelte` | 同上 |
| `ZoneBodyGroup.svelte` | 同上；`import { …, type Zone }` 來源改 `../logic/zones.svelte` |

### `header/`（1）與 `+page.svelte`（1）

| 檔案 | 改動 |
| --- | --- |
| `ReviewBody.svelte` | `getBoardContext` → `getChangesetContext` **與** `getZonesContext`；`board.operationOf(name)!` → `changeset.changeOf(name)!`；`board.problemOf` → `changeset.problemOf`；區域變數 `op` → `change`、`boardProblem` → `changeProblem`；`ondiscard` 改直接呼叫 `zones.handleDetach([entry.name])` |
| `+page.svelte` | `createBoardContext()` → `createZonesContext()`，其後插入 `createChangesetContext()` |

---

## 六、依賴順序

```
zones           （無依賴）
  ├── changeset
  │     ├── submit ← zones
  │     └── review ← submit
  ├── merge-count
  ├── drag  ←──── selection
  └── guard ←──── submit, query, review
```

`+page.svelte` 的建立順序（11 個）：

```ts
createPageDataContext(() => data);
const query = createQueryContext();
createPreviewsContext();
createSelectionContext();
createZonesContext();
createChangesetContext();
createMergeCountContext();
createDragContext();
createSubmitContext();
createReviewContext();
const guard = createGuardContext();
```

每一行的依賴都在它之前，無循環。

---

## 七、行為變更

**應為零。** 全部是改名、搬檔、以及一個投影從 controller 下放到模板。

需要特別確認沒有漂移的三處：

1. `zones.all` 的順序仍是 `[groups…, delete, hidden]`，所以 `changeset.changes` 的順序、審查清單的項目順序與分批切點都不變。
2. `statusOf` 的計算與原 `chipStatus` 逐字相同（同樣掃 `all`、同樣後寫覆蓋前寫），chip 上色結果不變。
3. `problemOf` 的三條規則與訊息文案原樣搬移，只有內部呼叫的 `operationOf` 改名為 `changeOf`。

---

## 八、驗證（已完成）

- `npm run check` — 680 files, 0 errors, 0 warnings
- `npm run build` — 成功
- `npm test` — 576 passed, 0 failed
- `git grep -nE "board|Board|畫布|[Oo]peration|chipStatus" -- src/routes/tags ":!src/routes/tags/cleanup"` — 無殘留

`logic/` 最終 11 個檔案，全部是 controller：

```
changeset  drag  guard  merge-count  page-data
previews   query review  selection   submit  zones
```

`temp1.md` 第八節的驗收清單完全沿用，其中與本次相關的是這幾條：

- [ ] Chip 的顏色（合併=強調色／刪除=錯誤色／隱藏=警告色）與所在區一致 ← `chipStatus` 下放後最需要確認的一項
- [ ] 合併區成員被移光時，該區自動消失
- [ ] 審查清單上的「捨棄這筆操作」會把該標籤移回池
- [ ] 合併目標本身也被排入重新命名／刪除時，該筆顯示問題且不可勾選
- [ ] 部分失敗時，失敗項目留在清單上並顯示「送出失敗：…」，成功項目自畫布移除
