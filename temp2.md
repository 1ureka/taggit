# `/tags`：消融 `logic/`、抽離 `+page.svelte` 邏輯 規劃

> 目標：`tags/logic/api.ts`、`tags/logic/changeset.ts` 兩個檔案消融進既有的 domain 模組（`zone/zone.ts`、`review/reviewEntry.ts`），`logic/` 資料夾整個消失；`+page.svelte` 目前直接手寫的畫布資料操作（detach/create/add/dissolve、chipStatus）搬進 `zone/zone.ts`，頁面只留 UI wiring 與薄 wrapper。
>
> 現況確認：`zone/zone.ts` 已存在但是空檔（`git status` 顯示新建未 commit），`zone/group.ts`（本來也是 0 bytes）已被刪除——這份規劃就是把內容填進 `zone.ts` 這個既定目標。
>
> 已與使用者收斂的三個邊界決策：
> 1. **zone.ts 只收「核心資料操作」**（detachTag / createGroup / addToGroup / dissolveGroup / addToZone / dissolveZone / chipStatus 計算）。組 props 給 `Zone*.svelte` 的 `createZoneHandlers`／`createZoneHeaderHandlers`／`createZoneBodyHandlers` 這類 UI wiring 留在 `+page.svelte`——比照 `review/reviewEntry.ts` 現有慣例：domain 模組只管資料，頁面管視圖繫結。
> 2. **`queryMergeCount` 的 debounce `timers` 由 `+page.svelte` 繼續持有並傳參**，不做成 `chips/previews.ts` 那種模組層級常駐快取——因為目前有 `$effect` 在卸載時清 timer，這個生命週期綁定值得保留在頁面層。
> 3. **`changesetFromBoard` 內化**：搬進 `review/reviewEntry.ts` 後不再對外匯出，`TagChangeset`／`toPayload`／`changesetFromBoard` 全部變成模組內部細節，對外只留一個 `submitReviewEntries(...)` 一次做完「算 changeset + 送出」。

---

## 一、檔案異動總覽

| 檔案 | 異動 |
|---|---|
| `tags/logic/api.ts` | 刪除；`submitChangeset` 邏輯併入 `review/reviewEntry.ts` |
| `tags/logic/changeset.ts` | 刪除；`MergeGroup` 型別搬到 `zone/zone.ts`；`TagChangeset`／`changesetFromBoard` 搬到 `review/reviewEntry.ts`（內化不匯出） |
| `tags/logic/`（資料夾） | 兩個檔案搬空後整個刪除 |
| `tags/zone/zone.ts` | 從空檔案填入：`MergeGroup` 型別、`computeChipStatus`、`detachTag`、`createGroup`、`addToGroup`、`dissolveGroup`、`addToZone`、`dissolveZone`、`queryMergeCount` |
| `tags/review/reviewEntry.ts` | 新增 `submitReviewEntries`；`MergeGroup` 改從 `../zone/zone` import；新增內部私有的 `TagChangeset`／`toPayload`／`changesetFromBoard`／`OpResult` |
| `tags/+page.svelte` | import 改指；畫布操作函式改為呼叫 `zone.ts` 的薄 wrapper；`handleReviewSubmit` 改呼叫 `submitReviewEntries` |

---

## 二、`zone/zone.ts` 詳細設計

```ts
/**
 * @file zone.ts
 * /tags 畫布（合併堆／刪除區／顯隱切換區）的資料模型與核心操作。
 */

import type { Tag } from "$lib/database";
import { api } from "$lib/utils/request";

/** 合併堆：members 全部改名為 canonical（canonical 自身除外） */
export type MergeGroup = {
  id: string;
  canonical: string;
  members: Tag[];
  mergeCount: number | null;
};

export type ChipStatus = "idle" | "group" | "delete" | "hidden";

// --- 純衍生計算 ---

/** 每個標籤目前落在畫布的哪個區域（供 Pool/Chip 顯示狀態用） */
export function computeChipStatus(
  groups: Iterable<MergeGroup>,
  deleteList: Tag[],
  hiddenList: Tag[],
): Map<string, ChipStatus> {
  const m = new Map<string, ChipStatus>();
  for (const g of groups) for (const member of g.members) m.set(member.name, "group");
  for (const t of deleteList) m.set(t.name, "delete");
  for (const t of hiddenList) m.set(t.name, "hidden");
  return m;
}

// --- 核心資料操作 ---
// 注意：groups（SvelteMap）與 deleteList/hiddenList（$state 陣列）都用「原地變動」
// 而非回傳新陣列，呼叫端不需要重新賦值。deleteList/hiddenList 用 splice，
// groups 用 Map 的 set/delete，跟現有 `groups` 的用法一致。

/** 把標籤自所有區域移除。回傳「成員數變動但未解散」的群組，供呼叫端決定要不要 requery mergeCount */
export function detachTag(
  groups: Map<string, MergeGroup>,
  deleteList: Tag[],
  hiddenList: Tag[],
  name: string,
): MergeGroup[] {
  const affected: MergeGroup[] = [];
  for (const group of groups.values()) {
    if (!group.members.some((m) => m.name === name)) continue;
    group.members = group.members.filter((m) => m.name !== name);
    if (group.members.length > 0) affected.push(group);
    else groups.delete(group.id);
  }

  const di = deleteList.findIndex((t) => t.name === name);
  if (di !== -1) deleteList.splice(di, 1);

  const hi = hiddenList.findIndex((t) => t.name === name);
  if (hi !== -1) hiddenList.splice(hi, 1);

  return affected;
}

/** 建立新合併堆（會先把 tags 從原本所在區域摘除）。回傳新群組與被摘除而受影響的群組 */
export function createGroup(
  groups: Map<string, MergeGroup>,
  deleteList: Tag[],
  hiddenList: Tag[],
  tags: Tag[],
): { group: MergeGroup; affected: MergeGroup[] } | null {
  if (tags.length === 0) return null;

  const affected: MergeGroup[] = [];
  for (const t of tags) affected.push(...detachTag(groups, deleteList, hiddenList, t.name));

  const canonical = tags.toSorted((a, b) => b.count - a.count)[0].name;
  const group: MergeGroup = { id: crypto.randomUUID(), canonical, members: [...tags], mergeCount: null };
  groups.set(group.id, group);

  return { group, affected };
}

/** 加入既有合併堆。回傳目標群組本身＋被摘除而受影響的群組（都要 requery） */
export function addToGroup(
  groups: Map<string, MergeGroup>,
  deleteList: Tag[],
  hiddenList: Tag[],
  groupId: string,
  tags: Tag[],
): MergeGroup[] {
  const group = groups.get(groupId);
  if (!group) return [];

  const affected: MergeGroup[] = [];
  for (const t of tags) {
    if (group.members.some((m) => m.name === t.name)) continue;
    affected.push(...detachTag(groups, deleteList, hiddenList, t.name));
    group.members.push(t);
  }

  return [group, ...affected];
}

export function dissolveGroup(groups: Map<string, MergeGroup>, groupId: string): void {
  groups.delete(groupId);
}

/** 加入刪除區／隱藏切換區（會先從原本所在區域摘除）。回傳受影響的群組供 requery */
export function addToZone(
  zone: "delete" | "hidden",
  groups: Map<string, MergeGroup>,
  deleteList: Tag[],
  hiddenList: Tag[],
  tags: Tag[],
): MergeGroup[] {
  const affected: MergeGroup[] = [];
  for (const t of tags) {
    affected.push(...detachTag(groups, deleteList, hiddenList, t.name));
    if (zone === "delete") deleteList.push(t);
    else hiddenList.push(t);
  }
  return affected;
}

export function dissolveZone(zone: "delete" | "hidden", deleteList: Tag[], hiddenList: Tag[]): void {
  const target = zone === "delete" ? deleteList : hiddenList;
  target.splice(0, target.length);
}

// --- 合併堆張數查詢（debounce，timers 由呼叫端持有並傳入） ---

type Timers = Map<string, { timer: ReturnType<typeof setTimeout>; seq: number }>;

/** 查詢合併或重命名後的目標標籤數量預期 */
export function queryMergeCount(group: MergeGroup, timers: Timers): void {
  group.mergeCount = null;

  const prev = timers.get(group.id);
  if (prev) clearTimeout(prev.timer);
  const seq = (prev?.seq ?? 0) + 1;

  const query = async (tags: string[]) => {
    const params = new URLSearchParams({ tags: tags.join(",") });
    const res = await api.get<{ count: number }>(`/api/proto/tags-union-count?${params}`);
    if (!res.ok || !res.data) throw new Error(res.error || "查詢失敗");
    return res.data.count;
  };

  const timer = setTimeout(async () => {
    const tags = [group.canonical.trim(), ...group.members.map((m) => m.name)];
    try {
      const count = await query(tags);
      if (timers.get(group.id)?.seq !== seq) return; // 在途回應已過期
      group.mergeCount = count;
    } catch {
      // 查詢失敗不打擾操作，下次變動再試
    }
  }, 200);

  timers.set(group.id, { timer, seq });
}
```

**注意 `checkedTags.clear()` 沒有跟著搬進來**：目前 `detachTag`／`dissolveGroup`／`dissolveZone` 在 `+page.svelte` 裡都會順手清空審查勾選（`checkedTags` 是 review 領域的狀態，不屬於 zone 畫布）。這屬於跨領域的副作用，不該讓 `zone.ts` 認識 `checkedTags`。搬移後行為不變，只是清空動作移到 `+page.svelte` 的呼叫端（見下一節），效果與現在完全相同。

---

## 三、`review/reviewEntry.ts` 新增部分

在既有的 `buildReviewEntries`／`toggleEntry`／`toggleAllEntries` 之外，新增：

```ts
import { api } from "$lib/utils/request";
import type { MergeGroup } from "../zone/zone"; // 型別來源改這裡

// --- 以下搬自 logic/changeset.ts + logic/api.ts，內化為私有實作細節 ---

type TagChangeset = {
  renames: Record<string, string>;
  deletes: string[];
  hidden: Record<string, boolean>;
};

/** 由畫布狀態推導變更集。只在送出當下呼叫一次 */
function changesetFromBoard(groups: Iterable<MergeGroup>, deleteList: Tag[], hiddenList: Tag[]): TagChangeset {
  const cs: TagChangeset = { renames: {}, deletes: [], hidden: {} };
  for (const g of groups) {
    const canonical = g.canonical.trim();
    for (const m of g.members) if (m.name !== canonical) cs.renames[m.name] = canonical;
  }
  cs.deletes = deleteList.map((t) => t.name);
  for (const t of hiddenList) cs.hidden[t.name] = !t.meta.hidden;
  return cs;
}

type ChangesetPayload = {
  deletes: string[];
  renames: { from: string; to: string }[];
  hidden: { name: string; hidden: boolean }[];
};

/** included 用操作對象的標籤名稱篩選子集合；name 本身是唯一識別碼 */
function toPayload(cs: TagChangeset, included: Set<string>): ChangesetPayload {
  const want = (name: string) => included.has(name);
  return {
    deletes: cs.deletes.filter(want),
    renames: Object.entries(cs.renames).filter(([from]) => want(from)).map(([from, to]) => ({ from, to })),
    hidden: Object.entries(cs.hidden).filter(([name]) => want(name)).map(([name, hidden]) => ({ name, hidden })),
  };
}

/** key 是操作對象的標籤名稱（見 `api/proto/tags-batch/+server.ts` 的 OpResult 註解） */
type OpResult = { key: string; ok: boolean; error?: string };

/**
 * 送出畫布中 names 指定的子集合（審查階段的送出行為，故收在這個檔案而非 zone.ts）。
 * 回傳失敗操作的 `name -> 錯誤訊息` 對映（全部成功時為空）。傳輸層錯誤直接 throw。
 */
export async function submitReviewEntries(
  groups: Iterable<MergeGroup>,
  deleteList: Tag[],
  hiddenList: Tag[],
  names: string[],
): Promise<Map<string, string>> {
  const cs = changesetFromBoard(groups, deleteList, hiddenList);
  const payload = toPayload(cs, new Set(names));
  const res = await api.post<{ results: OpResult[] }>("/api/proto/tags-batch", payload);
  if (!res.ok || !res.data) throw new Error(res.error || "送出失敗");

  const failures = new Map<string, string>();
  for (const r of res.data.results) if (!r.ok) failures.set(r.key, r.error ?? "未知錯誤");
  return failures;
}
```

`toPayload` 原本的 `included?: Set<string>`（可選、undefined 代表全選）在 `submitReviewEntries` 這個唯一呼叫點永遠會傳 `names`，所以內化後可以把參數改成必填 `Set<string>`，順手拿掉一個永遠用不到的分支——這是搬移過程中可以做的小簡化，不影響外部行為（原本 `submitChangeset` 也是永遠帶 `names` 呼叫）。

檔案開頭那句「審查清單的組裝（拼接伺服器預估、頁面旗標）屬於 `../review/reviewEntry.ts`」的檔頭註解（目前寫在 `changeset.ts`）可以順勢改寫成一句話說明 `reviewEntry.ts` 現在同時管「組裝清單」與「送出清單」，呼應使用者這次的分類依據（審查階段後的行為）。

---

## 四、`+page.svelte` 異動重點

**import 區塊**：

```ts
import { clearPreviews } from "./chips/previews";
import * as zone from "./zone/zone";
import { buildReviewEntries, toggleEntry, toggleAllEntries, submitReviewEntries } from "./review/reviewEntry";
import type { MergeGroup } from "./zone/zone";
```

用 `import * as zone` 是因為 `+page.svelte` 裡的薄 wrapper 函式（`detachTag`、`createGroup`、`addToGroup`、`dissolveGroup`、`addToZone`、`dissolveZone`）跟 `zone.ts` 匯出的同名函式會撞名，用命名空間匯入避免逐一取別名（比 `detachTag as zoneDetachTag` 這種六個都要重新命名更乾淨）。

**`chipStatus`**：

```ts
const chipStatus = $derived(zone.computeChipStatus(groups.values(), deleteList, hiddenList));
```

**畫布操作 wrapper**（把 `checkedTags.clear()` 這類 review 領域副作用、以及 `queryMergeCount` 呼叫留在頁面層）：

```ts
const detachTag = (name: string) => {
  checkedTags.clear();
  const affected = zone.detachTag(groups, deleteList, hiddenList, name);
  for (const g of affected) zone.queryMergeCount(g, timers);
};

const createGroup = (tags: Tag[]) => {
  const result = zone.createGroup(groups, deleteList, hiddenList, tags);
  if (!result) return;
  zone.queryMergeCount(result.group, timers);
  for (const g of result.affected) zone.queryMergeCount(g, timers);
};

const addToGroup = (groupId: string, tags: Tag[]) => {
  const affected = zone.addToGroup(groups, deleteList, hiddenList, groupId, tags);
  for (const g of affected) zone.queryMergeCount(g, timers);
};

const dissolveGroup = (groupId: string) => {
  checkedTags.clear();
  zone.dissolveGroup(groups, groupId);
};

const addToZone = (targetZone: "delete" | "hidden", tags: Tag[]) => {
  const affected = zone.addToZone(targetZone, groups, deleteList, hiddenList, tags);
  for (const g of affected) zone.queryMergeCount(g, timers);
};

const dissolveZone = (targetZone: "delete" | "hidden") => {
  checkedTags.clear();
  zone.dissolveZone(targetZone, deleteList, hiddenList);
};
```

`createZoneHandlers`／`createZoneHeaderHandlers`／`createZoneBodyHandlers`（組 props 給 `Zone*.svelte` 的 factory）**不動**，繼續呼叫上面這些同名 wrapper，只是 wrapper 內部實作從「直接操作 state」變成「呼叫 `zone.ts` + 處理 requery/清勾選」。

`ZoneBodyGroup` 的 `onchange`（目前是 `checkedTags.clear(); queryMergeCount(group);`）也改呼叫 `zone.queryMergeCount(group, timers)`。

**送出**：

```ts
const handleReviewSubmit = async () => {
  const names = reviewEntries.filter((e) => e.checked).map((e) => e.name);
  if (names.length === 0 || pending) return;

  pending = true;
  try {
    const result = await submitReviewEntries(groups.values(), deleteList, hiddenList, names);
    failures = Object.fromEntries(result);

    const okNames = names.filter((n) => !result.has(n));
    for (const n of okNames) detachTag(n);

    if (okNames.length > 0) addToast({ message: `已套用 ${okNames.length} 筆標籤操作`, variant: "success" });
    if (result.size > 0) addToast({ message: `${result.size} 筆操作失敗`, variant: "error" });
    if (result.size === 0) reviewOpen = false;

    clearPreviews();
    await invalidateAll();
  } catch (e) {
    addToast({ message: formatError(e), variant: "error" });
  } finally {
    pending = false;
  }
};
```

（跟原本幾乎一樣，差別只在少了本地組 `cs` 這一步。）

**不動的部分**：`timers` Map 的宣告與卸載時 `$effect` 清除、`handleToggleSelect`／`handleClearSelected`／`handleDragStart`／`handleDragEnd`（選取與拖曳是頁面層的互動狀態，不是畫布資料模型）、`handleRefresh`、`handleBeforeUnload`、`beforeNavigate`（SvelteKit 導航生命週期，不是 domain 邏輯）。

---

## 五、實作順序建議

1. 先寫 `zone/zone.ts`（型別＋六個核心操作＋`computeChipStatus`＋`queryMergeCount`），不改動任何呼叫端，跑一次 `svelte-check` 確認新檔案本身型別正確。
2. 改 `review/reviewEntry.ts`：加 `submitReviewEntries` 與內化的三個私有函式/型別，`MergeGroup` import 來源改成 `../zone/zone`。
3. 改 `+page.svelte`：import 換掉、六個 wrapper 函式改寫、`chipStatus` 改呼叫、`handleReviewSubmit` 改呼叫 `submitReviewEntries`、`ZoneBodyGroup` 的 `onchange` 改呼叫。
4. 刪除 `tags/logic/api.ts`、`tags/logic/changeset.ts`，確認資料夾清空後刪除 `tags/logic/`。
5. 全域搜尋確認沒有殘留的 `from "./logic` / `from "../logic` import（目前只有三處引用，見下方驗收清單）。

---

## 六、驗收清單（手動走查，交給你執行）

- [ ] `npx svelte-check` 無新增錯誤（尤其確認 `zone.ts` 命名空間匯入沒有跟頁面內 wrapper 函式撞名報錯）。
- [ ] 全域搜尋 `logic/api`、`logic/changeset`、`tags/logic` 應該零匹配。
- [ ] `/tags`：拖拉建立合併堆 → 張數預估（debounce 查詢）正常出現與更新。
- [ ] 從合併堆把某個標籤拖回 Pool（`detachTag` 路徑）→ 剩餘成員的張數預估有重新查詢；若堆被拆到只剩一個成員，堆本身消失。
- [ ] 加入刪除區／隱藏切換區、再解散整區（`dissolveZone`）→ 區域清空、審查勾選同步清空。
- [ ] 開審查對話框、勾選部分項目送出（`submitReviewEntries`）→ 成功項目從畫布消失、失敗項目顯示錯誤原因且仍可重試。
- [ ] 送出失敗後重新調整草稿再送 → 之前失敗訊息正確被新結果覆蓋（`failures` 語意不變）。
- [ ] 離開頁面時有未送出操作 → 確認離開提示與清空邏輯不受影響。
