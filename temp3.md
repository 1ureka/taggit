# `/tags`：消融 `logic/`、抽離 `+page.svelte` 邏輯 規劃（參數物件版）

> 與 `temp2.md` 目標相同（消融 `logic/`、`zone.ts` 收核心資料操作、`reviewEntry.ts` 內化送出邏輯），差別只在：把重複出現的 `groups` / `deleteList` / `hiddenList` 三個參數包成一個 `ZoneBoard` 物件，並且這個型別**不只給 `zone.ts` 用，`review/reviewEntry.ts` 現有的 `buildReviewEntries` 也一起改**——因為它本來就也吃同一組三個參數，是同一個資料團塊（data clump）的第二個受害者。
>
> 決策收斂沿用 `temp2.md` 的三點（`zone.ts` 只收核心資料操作／`timers` 留頁面傳參／`changesetFromBoard` 內化），這份文件只重寫「參數怎麼傳」的部分。

---

## 零、`ZoneBoard` 型別放哪裡、由誰持有

```ts
// zone/zone.ts
export type ZoneBoard = {
  groups: Map<string, MergeGroup>;
  deleteList: Tag[];
  hiddenList: Tag[];
};
```

放在 `zone.ts`（畫布資料的原生定義處），`review/reviewEntry.ts` 用 `import type { ZoneBoard } from "../zone/zone"` 取用——這也是為什麼要問「能不能讓其他 /tags 程式共用」：答案是能，而且 `reviewEntry.ts` 現在就在用同一組資料，值得直接共用型別，不要各自定義一份等價但不同名的 shape。

**`board` 這個值在 `+page.svelte` 怎麼生出來，有兩個選項：**

- **選項 A（建議）**：`groups`／`deleteList`／`hiddenList` 三個宣告完全不動（`groups` 還是 `SvelteMap`，`deleteList`/`hiddenList` 還是各自的 `$state<Tag[]>([])`），只是額外宣告一個**指向這三者的物件字面量**：
  ```ts
  const groups = new SvelteMap<string, MergeGroup>();
  let deleteList = $state<Tag[]>([]);
  let hiddenList = $state<Tag[]>([]);
  const board: ZoneBoard = { groups, deleteList, hiddenList };
  ```
  `board` 本身不需要是 `$state`——它只是個穩定的參照容器，三個欄位各自的響應性完全沒變。這能成立的前提是**這三個 binding 之後永遠不重新賦值，只做原地變動**（`splice`／`Map.set`/`delete`），下面會處理目前唯一違反這個前提的地方（`beforeNavigate` 的離開重置）。
  風險最低：不動任何既有響應性寫法，只是把三個參照包一層給函式簽章用。

- **選項 B（更徹底但沒完全展開）**：從一開始就宣告 `const board = $state<ZoneBoard>({ groups: new SvelteMap(), deleteList: [], hiddenList: [] })`，不再有三個獨立頂層宣告。理論上 Svelte 5 的 `$state` 對「已經是響應式的巢狀值」（如 `SvelteMap` 實例）不會重複包一層代理，陣列欄位一樣會被深層代理，所以應該可行；但這是這次會話還沒實測過的行為，且會把「一個 state」變成「巢狀在物件裡的 state」，跟現有 `chips/previews.ts`、`+page.svelte` 其他 `$state` 宣告的扁平風格不一致。**先照選項 A 做，若之後想進一步收斂再單獨驗證選項 B。**

**新增：`resetBoard`**——選項 A 帶來一個順手的額外收斂點。目前 `beforeNavigate` 離開確認裡有一段手動重置：
```ts
checkedTags.clear();
groups.clear();
deleteList = [];
hiddenList = [];
```
`deleteList = []` / `hiddenList = []` 是**重新賦值**，會讓 `board.deleteList`／`board.hiddenList` 的參照失效（`board` 物件本身沒被重建，還指著舊陣列）——這是選項 A 唯一需要主動修正的地方。改成 `zone.ts` 提供一個 `resetBoard`：
```ts
// zone.ts
export function resetBoard(board: ZoneBoard): void {
  board.groups.clear();
  board.deleteList.splice(0, board.deleteList.length);
  board.hiddenList.splice(0, board.hiddenList.length);
}
```
`beforeNavigate` 裡改成 `zone.resetBoard(board)`，順便比原本三行更明確地表達「清空整塊畫布」的意圖。

---

## 一、檔案異動總覽

| 檔案 | 異動 |
|---|---|
| `tags/logic/api.ts` | 刪除；併入 `review/reviewEntry.ts` |
| `tags/logic/changeset.ts` | 刪除；`MergeGroup`/`ZoneBoard` 型別搬到 `zone/zone.ts`；`changesetFromBoard` 搬到 `review/reviewEntry.ts`（內化不匯出） |
| `tags/logic/`（資料夾） | 整個刪除 |
| `tags/zone/zone.ts` | 填入：`MergeGroup`、`ZoneBoard`、`ChipStatus` 型別；`computeChipStatus`、`detachTag`、`createGroup`、`addToGroup`、`dissolveGroup`、`addToZone`、`dissolveZone`、`resetBoard`（都吃 `board: ZoneBoard`）；`queryMergeCount`（不吃 board，簽章與 `temp2.md` 相同） |
| `tags/review/reviewEntry.ts` | `buildReviewEntries` 簽章從 5 參數收成 3 個（`board`、`checkedTags`、`failures`）；新增 `submitReviewEntries(board, names)`；內部私有 `changesetFromBoard(board)`／`toPayload` |
| `tags/+page.svelte` | 新增 `board` 宣告；所有畫布操作 wrapper、`chipStatus`、`reviewEntries`、`beforeNavigate` 重置改吃/用 `board` |

---

## 二、`zone/zone.ts` 詳細設計

```ts
/**
 * @file zone.ts
 * /tags 畫布（合併堆／刪除區／顯隱切換區）的資料模型與核心操作。
 */

import type { Tag } from "$lib/database";
import { api } from "$lib/utils/request";

export type MergeGroup = {
  id: string;
  canonical: string;
  members: Tag[];
  mergeCount: number | null;
};

/** 畫布的完整狀態：合併堆、刪除區、隱藏切換區。`zone.ts` 與 `review/reviewEntry.ts` 共用這個 shape */
export type ZoneBoard = {
  groups: Map<string, MergeGroup>;
  deleteList: Tag[];
  hiddenList: Tag[];
};

export type ChipStatus = "idle" | "group" | "delete" | "hidden";

// --- 純衍生計算 ---

export function computeChipStatus(board: ZoneBoard): Map<string, ChipStatus> {
  const m = new Map<string, ChipStatus>();
  for (const g of board.groups.values()) for (const member of g.members) m.set(member.name, "group");
  for (const t of board.deleteList) m.set(t.name, "delete");
  for (const t of board.hiddenList) m.set(t.name, "hidden");
  return m;
}

// --- 核心資料操作（全部原地變動 board 內的容器，不重新賦值 board 本身或其欄位） ---

/** 把標籤自所有區域移除。回傳「成員數變動但未解散」的群組，供呼叫端決定要不要 requery mergeCount */
export function detachTag(board: ZoneBoard, name: string): MergeGroup[] {
  const affected: MergeGroup[] = [];
  for (const group of board.groups.values()) {
    if (!group.members.some((m) => m.name === name)) continue;
    group.members = group.members.filter((m) => m.name !== name);
    if (group.members.length > 0) affected.push(group);
    else board.groups.delete(group.id);
  }

  const di = board.deleteList.findIndex((t) => t.name === name);
  if (di !== -1) board.deleteList.splice(di, 1);

  const hi = board.hiddenList.findIndex((t) => t.name === name);
  if (hi !== -1) board.hiddenList.splice(hi, 1);

  return affected;
}

/** 建立新合併堆（會先把 tags 從原本所在區域摘除）。回傳新群組與被摘除而受影響的群組 */
export function createGroup(board: ZoneBoard, tags: Tag[]): { group: MergeGroup; affected: MergeGroup[] } | null {
  if (tags.length === 0) return null;

  const affected: MergeGroup[] = [];
  for (const t of tags) affected.push(...detachTag(board, t.name));

  const canonical = tags.toSorted((a, b) => b.count - a.count)[0].name;
  const group: MergeGroup = { id: crypto.randomUUID(), canonical, members: [...tags], mergeCount: null };
  board.groups.set(group.id, group);

  return { group, affected };
}

/** 加入既有合併堆。回傳目標群組本身＋被摘除而受影響的群組（都要 requery） */
export function addToGroup(board: ZoneBoard, groupId: string, tags: Tag[]): MergeGroup[] {
  const group = board.groups.get(groupId);
  if (!group) return [];

  const affected: MergeGroup[] = [];
  for (const t of tags) {
    if (group.members.some((m) => m.name === t.name)) continue;
    affected.push(...detachTag(board, t.name));
    group.members.push(t);
  }

  return [group, ...affected];
}

export function dissolveGroup(board: ZoneBoard, groupId: string): void {
  board.groups.delete(groupId);
}

/** 加入刪除區／隱藏切換區（會先從原本所在區域摘除）。回傳受影響的群組供 requery */
export function addToZone(zoneName: "delete" | "hidden", board: ZoneBoard, tags: Tag[]): MergeGroup[] {
  const affected: MergeGroup[] = [];
  for (const t of tags) {
    affected.push(...detachTag(board, t.name));
    if (zoneName === "delete") board.deleteList.push(t);
    else board.hiddenList.push(t);
  }
  return affected;
}

export function dissolveZone(zoneName: "delete" | "hidden", board: ZoneBoard): void {
  const target = zoneName === "delete" ? board.deleteList : board.hiddenList;
  target.splice(0, target.length);
}

/** 清空整塊畫布（離開頁面確認丟棄時用） */
export function resetBoard(board: ZoneBoard): void {
  board.groups.clear();
  board.deleteList.splice(0, board.deleteList.length);
  board.hiddenList.splice(0, board.hiddenList.length);
}

// --- 合併堆張數查詢（debounce，timers 由呼叫端持有並傳入；跟 board 無關，簽章不變） ---

type Timers = Map<string, { timer: ReturnType<typeof setTimeout>; seq: number }>;

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
      if (timers.get(group.id)?.seq !== seq) return;
      group.mergeCount = count;
    } catch {
      // 查詢失敗不打擾操作，下次變動再試
    }
  }, 200);

  timers.set(group.id, { timer, seq });
}
```

跟 `temp2.md` 一樣：`checkedTags.clear()` 不下放進這裡（review 領域狀態，不屬於 `ZoneBoard`），留在 `+page.svelte` 的呼叫端處理。

---

## 三、`review/reviewEntry.ts` 異動

`buildReviewEntries` 簽章瘦身（5 參數 → 3 參數），內部把 `groups`/`deleteList`/`hiddenList` 三處引用改成 `board.xxx`：

```ts
import type { ZoneBoard } from "../zone/zone";

export function buildReviewEntries(
  board: ZoneBoard,
  checkedTags: Set<string>,
  failures: Record<string, string>,
): ReviewEntry[] {
  const groupList = [...board.groups.values()];
  const deletes = new Set(board.deleteList.map((t) => t.name));
  const renamedFromNames = new Set(
    groupList.flatMap((g) => g.members.filter((m) => m.name !== g.canonical.trim()).map((m) => m.name)),
  );

  const finish = (name: string, problem: string | null) => {
    const failure = failures[name];
    const finalProblem = problem ?? (failure ? `送出失敗：${failure}` : null);
    const checkable = finalProblem === null;
    return { problem: finalProblem, checkable, checked: checkable && checkedTags.has(name) };
  };

  const entries: ReviewEntry[] = [];

  for (const g of groupList) {
    const canonical = g.canonical.trim();
    const isMerge = g.members.length > 1;
    for (const m of g.members) {
      if (m.name === canonical) continue;
      let problem: string | null = null;
      if (!isValidTagName(canonical)) problem = "新名稱不合法（1–50 字元、不可含逗號）";
      else if (renamedFromNames.has(canonical)) problem = `目標「${canonical}」本身也被排入重新命名`;
      else if (deletes.has(canonical)) problem = `目標「${canonical}」已被排入刪除`;

      entries.push({
        kind: isMerge ? "merge" : "rename",
        name: m.name,
        count: m.count,
        to: canonical,
        mergedCount: g.mergeCount ?? undefined,
        ...finish(m.name, problem),
      });
    }
  }

  for (const t of board.deleteList) {
    entries.push({ kind: "delete", name: t.name, count: t.count, ...finish(t.name, null) });
  }

  for (const t of board.hiddenList) {
    let problem: string | null = null;
    if (renamedFromNames.has(t.name)) problem = `「${t.name}」已被排入重新命名，請對新名稱設定顯隱`;
    entries.push({
      kind: t.meta.hidden ? "visible" : "hidden",
      name: t.name,
      count: t.count,
      ...finish(t.name, problem),
    });
  }

  return entries;
}
```

新增 `submitReviewEntries`（4 參數 → 2 參數）與內化的私有部分：

```ts
import { api } from "$lib/utils/request";

type TagChangeset = {
  renames: Record<string, string>;
  deletes: string[];
  hidden: Record<string, boolean>;
};

function changesetFromBoard(board: ZoneBoard): TagChangeset {
  const cs: TagChangeset = { renames: {}, deletes: [], hidden: {} };
  for (const g of board.groups.values()) {
    const canonical = g.canonical.trim();
    for (const m of g.members) if (m.name !== canonical) cs.renames[m.name] = canonical;
  }
  cs.deletes = board.deleteList.map((t) => t.name);
  for (const t of board.hiddenList) cs.hidden[t.name] = !t.meta.hidden;
  return cs;
}

type ChangesetPayload = {
  deletes: string[];
  renames: { from: string; to: string }[];
  hidden: { name: string; hidden: boolean }[];
};

function toPayload(cs: TagChangeset, included: Set<string>): ChangesetPayload {
  const want = (name: string) => included.has(name);
  return {
    deletes: cs.deletes.filter(want),
    renames: Object.entries(cs.renames).filter(([from]) => want(from)).map(([from, to]) => ({ from, to })),
    hidden: Object.entries(cs.hidden).filter(([name]) => want(name)).map(([name, hidden]) => ({ name, hidden })),
  };
}

type OpResult = { key: string; ok: boolean; error?: string };

/** 送出畫布中 names 指定的子集合（審查階段的送出行為，故收在這個檔案而非 zone.ts） */
export async function submitReviewEntries(board: ZoneBoard, names: string[]): Promise<Map<string, string>> {
  const cs = changesetFromBoard(board);
  const payload = toPayload(cs, new Set(names));
  const res = await api.post<{ results: OpResult[] }>("/api/proto/tags-batch", payload);
  if (!res.ok || !res.data) throw new Error(res.error || "送出失敗");

  const failures = new Map<string, string>();
  for (const r of res.data.results) if (!r.ok) failures.set(r.key, r.error ?? "未知錯誤");
  return failures;
}
```

---

## 四、`+page.svelte` 異動重點

**state 宣告**（選項 A：三個既有宣告不動，額外包一個 `board`）：

```ts
const groups = new SvelteMap<string, MergeGroup>();
let deleteList = $state<Tag[]>([]);
let hiddenList = $state<Tag[]>([]);
const board: ZoneBoard = { groups, deleteList, hiddenList };
```

**import**：

```ts
import * as zone from "./zone/zone";
import type { MergeGroup, ZoneBoard } from "./zone/zone";
import { buildReviewEntries, toggleEntry, toggleAllEntries, submitReviewEntries } from "./review/reviewEntry";
```

**`chipStatus` 與 `reviewEntries`**：

```ts
const chipStatus = $derived(zone.computeChipStatus(board));
const reviewEntries = $derived(buildReviewEntries(board, checkedTags, failures));
```

**畫布操作 wrapper**：

```ts
const detachTag = (name: string) => {
  checkedTags.clear();
  const affected = zone.detachTag(board, name);
  for (const g of affected) zone.queryMergeCount(g, timers);
};

const createGroup = (tags: Tag[]) => {
  const result = zone.createGroup(board, tags);
  if (!result) return;
  zone.queryMergeCount(result.group, timers);
  for (const g of result.affected) zone.queryMergeCount(g, timers);
};

const addToGroup = (groupId: string, tags: Tag[]) => {
  const affected = zone.addToGroup(board, groupId, tags);
  for (const g of affected) zone.queryMergeCount(g, timers);
};

const dissolveGroup = (groupId: string) => {
  checkedTags.clear();
  zone.dissolveGroup(board, groupId);
};

const addToZone = (targetZone: "delete" | "hidden", tags: Tag[]) => {
  const affected = zone.addToZone(targetZone, board, tags);
  for (const g of affected) zone.queryMergeCount(g, timers);
};

const dissolveZone = (targetZone: "delete" | "hidden") => {
  checkedTags.clear();
  zone.dissolveZone(targetZone, board);
};
```

`createZoneHandlers`／`createZoneHeaderHandlers`／`createZoneBodyHandlers` 內部原本直接讀 `groups`/`deleteList`/`hiddenList` 的地方（例如 `group.members`、`deleteList` 當 `tags` 回傳）改讀 `board.groups`/`board.deleteList`/`board.hiddenList`；`{#each groups.values() ...}` 模板也改成 `{#each board.groups.values() ...}`。`ZoneBodyGroup` 的 `onchange` 改呼叫 `zone.queryMergeCount(group, timers)`（不變）。

**送出**：

```ts
const handleReviewSubmit = async () => {
  const names = reviewEntries.filter((e) => e.checked).map((e) => e.name);
  if (names.length === 0 || pending) return;

  pending = true;
  try {
    const result = await submitReviewEntries(board, names);
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

**離開頁面重置**（`beforeNavigate`）：

```ts
requestConfirm(msg, { title: "尚未送出的標籤操作", action: "離開" }).then((confirmed) => {
  if (!confirmed) return;
  checkedTags.clear();
  zone.resetBoard(board);
  goto(to.url.href);
});
```

**不動的部分**：與 `temp2.md` 相同——`timers` 宣告與卸載清除、`selectedTags`/`dragging`/`draggingOver` 相關 handler、`handleRefresh`、`handleBeforeUnload`。

---

## 五、這個參數物件還能不能影響其他 /tags 程式？（現況核對）

用 `groups.values()` / `groups.get/set/delete` / `deleteList` / `hiddenList` 這幾個關鍵字搜過整個 `tags/` 路由，**只有 3 個檔案**碰這組資料：`+page.svelte`、`review/reviewEntry.ts`、以及正要被消融的 `logic/changeset.ts`。也就是說：

- `zone/*.svelte`（`ZoneBodyGroup`／`ZoneBodyDelete`／`ZoneBodyHidden`／`ZoneContainer`／`ZoneHeader`）都只拿自己那一區的 `tags: Tag[]` 切片與 handler，不需要整個 `ZoneBoard`，**不必改**。
- `chips/*`、`header/*` 也不碰這三個欄位，**不必改**。

所以 `ZoneBoard` 目前的共用範圍就是「`zone.ts` 的核心操作」＋「`review/reviewEntry.ts` 的 `buildReviewEntries`／`submitReviewEntries`」這兩處，沒有第三個消費者——不是因為共用得不夠，是因為 `/tags` 這個路由裡本來就只有這兩層邏輯會摸整塊畫布狀態，其餘元件本來就只吃切片，這點在參數物件版與 `temp2.md` 的多參數版之間沒有差異，純粹是搬移範圍的自然邊界。

---

## 六、實作順序建議

1. `zone/zone.ts`：先定義 `MergeGroup`/`ZoneBoard`/`ChipStatus`，寫七個核心操作＋`resetBoard`＋`queryMergeCount`，`svelte-check` 過。
2. `review/reviewEntry.ts`：`buildReviewEntries` 簽章改造＋新增 `submitReviewEntries`＋內化三個私有函式/型別，`MergeGroup`/`ZoneBoard` import 改 `../zone/zone`。
3. `+page.svelte`：加 `board` 宣告、import 換掉、六個 wrapper 改寫、`chipStatus`/`reviewEntries` 改呼叫、模板 `groups.values()` 改 `board.groups.values()`、`beforeNavigate` 重置改 `zone.resetBoard(board)`、`ZoneBodyGroup` 的 `onchange` 確認呼叫方式不變。
4. 刪除 `tags/logic/api.ts`、`tags/logic/changeset.ts`，資料夾清空後刪除。
5. 全域搜尋確認沒有殘留 `from "./logic` / `from "../logic`，也搜一次裸的 `deleteList`/`hiddenList`/`groups.` 確認都已經走 `board.` 前綴（避免漏改的地方悄悄用到已經不存在的頂層變數）。

---

## 七、驗收清單（手動走查，交給你執行）

- [ ] `npm run check` 無新增錯誤。
- [ ] 全域搜尋 `logic/api`、`logic/changeset`、`tags/logic` 應該零匹配；搜尋裸的 `deleteList =`／`hiddenList =`（重新賦值）應該零匹配（確認選項 A 的前提沒被破壞）。
- [ ] `/tags`：拖拉建立合併堆 → 張數預估正常出現與更新。
- [ ] 從合併堆把某個標籤拖回 Pool（`detachTag`）→ 剩餘成員重新查詢、堆只剩一人時消失。
- [ ] 加入刪除區／隱藏切換區、再解散整區（`dissolveZone`）→ 區域清空、審查勾選同步清空。
- [ ] 開審查對話框、勾選部分項目送出（`submitReviewEntries`）→ 成功項目消失、失敗項目顯示原因且可重試。
- [ ] 離開頁面時有未送出操作、確認離開 → 畫布（合併堆／刪除區／隱藏區）確實整個清空（驗證 `resetBoard` 正確接住原本三行重置邏輯）。
