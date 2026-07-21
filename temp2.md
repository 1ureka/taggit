# `/committed` 頁面設計計畫

> 本檔案是**設計計畫**，尚未動手實作。目的是先把資料流、controller 職責、元件樹與 API 異動定案，收斂到使用者確認後再開工。

## 0. 這個頁面要做什麼

現有 `routes/committed/+page.svelte` 只是一個「開發中」佔位頁。根據 [config.ts](src/routes/(layout)/config.ts) 的導覽項目定義：

> 管理圖片・編輯已提交圖片的名稱、標籤或評分

同時已有兩個既存連結點指向這頁並預期帶 `currentId` 查詢參數：

- [compare/cards/CardInfo.svelte:16-21](src/routes/compare/cards/CardInfo.svelte#L16-L21)：從 compare 頁的「編輯」按鈕連過來，並保留 compare 當下的篩選/排序參數。
- [(home)/logic/detail.svelte.ts:22-28](src/routes/(home)/logic/detail.svelte.ts#L22-L28)：從首頁詳情彈窗的「編輯」按鈕連過來，同樣保留 home 當下的篩選/排序參數。**但這裡寫的是 `/editor`，路由並不存在，是遺留的錯字，必須順手修正為 `/committed`。**

三個已確認的方向（使用者已回答）：

1. Toolbar 左側篩選/排序＝完整比照 `/compare`。
2. 整體版面骨架＝比照 `/staged`（卡片牆 + 可收合 Inspector + 審查清單 Modal），而不是 compare 的「左側清單 + 右側內容區」。
3. 「取消提交」（退回暫存區）併入本頁，且走**草稿 + 審查清單**流程，不像 compare 那樣立即生效。
4. 審查清單裡標籤、評分、名稱的異動都要做「異動前 → 異動後」的視覺化。

---

## 1. 參考來源總覽

| 來源 | 拿走什麼 |
|---|---|
| [`/staged`](src/routes/staged) | 整體骨架：卡片牆＋Inspector＋ReviewModal；草稿本地暫存、離頁守衛、審查清單勾選送出的完整流程 |
| [`/compare`](src/routes/compare) | Toolbar 左側篩選/排序（`Filters.svelte`／`FilterButton.svelte`／`FilterPopover.svelte`）；`ImageQuery` 驅動的 `+page.server.ts`；`operations.svelte.ts` 的 `handleRevert` 是「取消提交」API 呼叫的既有先例 |
| [`/tags/cleanup`](src/routes/tags/cleanup) | `ReviewEntry` 用 `kind` 做 discriminated union 呈現多種操作類型（merge/delete/hidden）的既有先例；`<del>`／`<ins>` 的異動前後文字呈現手法 |
| `temp.md`（使用者提供） | 標籤新增／移除的 `+`／`−` Chip 視覺設計，用於審查清單的標籤 diff |
| [`(home)`](src/routes/(home)) | `currentId` 查詢參數的既有慣例（`DetailController` 用 `replaceState` 淺路由同步）；`ImageQuery` 在跨頁連結間的相容性 |

---

## 2. 路由與資料流

### `+page.server.ts`

幾乎照搬 compare 的版本，差別只在預設排序（管理情境下，新提交的圖片更可能需要處理，預設用 `committedAt desc`；`ImageQuery` 建構子不傳 `list` 時預設是 `rating desc`，這裡要顯式傳入）：

```ts
export const load: PageServerLoad = ({ url }) => {
  if (!Database.isLoaded()) throw redirect(303, "/settings?alert=error");
  const query = new Query(Database.requireLoaded());

  const base = ImageQuery.fromSearchParams(url.searchParams);
  const list = base.list.sort === "rating" && !url.searchParams.has("sort")
    ? base.list.with({ sort: "committedAt" })
    : base.list;
  const { items, total } = query.images(base.with({ list: list.with({ limit: 0 }) }));

  return { items, total };
};
```

跟 staged 不同的地方：**不**在這裡預先撈 `existingTagNames`（staged 的 `+page.server.ts` 有這行，見 [`staged/+page.server.ts:14-15`](src/routes/staged/+page.server.ts#L14-L15)）。committed 頁改成審查清單開啟時才按需查詢實際觸及到的標籤（見第 5 節「ReviewImpact」），理由是 staged 那種「一次撈全部標籤名稱」的成本會隨標籤庫總量增長，而 committed 頁每次打開都要付這個成本，不划算；改成只查這次批次真正碰到的少數標籤，用量體小很多。

預設排序改 `committedAt`（已確認）。

`limit: 0`＝不分頁，跟 compare／staged 一致（本專案是個人本地圖庫，量體上直接吃全量＋前端虛擬化捲動，不做伺服器分頁）。

### URL 查詢參數

沿用 `ImageQuery`（`search`／`includedTags`／`excludedTags`／`rating`／`ratingOp`／`sort`／`order`），與 compare、home 完全共用同一組解析／序列化邏輯，這也是兩個既有連結點（見第 0 節）能夠直接把自己的篩選條件帶過來的原因。

新增一個本頁專屬的 `currentId`：目前正在 Inspector 中編輯的圖片檔名。設計為**淺路由同步**（`replaceState`，不觸發 `load` 重跑），比照 [`(home)/logic/detail.svelte.ts`](src/routes/(home)/logic/detail.svelte.ts) 與 [`compare/logic/pinned.svelte.ts`](src/routes/compare/logic/pinned.svelte.ts) 的既有模式：

- 掛載時從 `page.url.searchParams.get("currentId")` 讀初始值（`untrack`）。
- 使用者點卡片切換編輯目標＝本地立即反應＋`replaceState`，不必等一次完整導航。
- `$effect` 監聽外部造成的 URL 變動（上一頁/下一頁、外部連結）回灌本地狀態。

> ⚠️ 已知限制（不在本次範圍內解）：[`(layout)/ModalTrigger.svelte:21-29`](src/routes/(layout)/ModalTrigger.svelte#L21-L29) 已經有一個 TODO，承認 `page.url`（用於全域狀態列文字）在淺路由後會過期、讀不到最新的 `currentId`。這是全站共通的 `page.url` vs `location` 落差（見 [`docs/svelte_kit_routes.md`](docs/svelte_kit_routes.md) 的「淺路由與 goto」一節），不是 committed 頁自己的問題，這裡選擇跟現有兩個先例（home／compare）一致的做法，不額外發明新解法。

---

## 3. 檔案樹

```
routes/committed/
├── +page.server.ts
├── +page.svelte
├── header/
│   ├── Toolbar.svelte          # <Filters /> + <Actions />，版面比照 compare
│   ├── Filters.svelte          # 搬 compare 版本（搜尋 + 排序 + 篩選彈出視窗）
│   ├── FilterButton.svelte     # 搬 compare 版本
│   ├── FilterPopover.svelte    # 搬 compare 版本
│   └── Actions.svelte          # 重新整理 + 「批次選取」切換鈕 + 「檢視待提交的變更 (N)」
├── cards/
│   ├── Cards.svelte            # 沿用 staged 的 masonry virtualizer，資料源改 pageData.value.items
│   ├── Card.svelte             # 四態外觀：未編輯／已編輯／標記退回／選取中；點擊行為依 selection.isActive 分支
│   ├── CardInfo.svelte         # 概要列（檔名/評等/標籤數），依 draft 狀態切換顯示內容
│   ├── SelectionBar.svelte     # 選取中的浮動批次動作列（比照 staged 的 StampBadge 版面）
│   └── config.ts               # 沿用 staged（breakpoints / CARD_SIZE / INSPECTOR_WIDTH）
├── inspector/
│   ├── Inspector.svelte        # 沿用 staged 版面
│   ├── InspectorHeader.svelte  # 沿用（檔名 + X/Y 指標 + 關閉鈕）
│   ├── InspectorFields.svelte  # 編輯模式：名稱/評等/標籤欄位；退回模式：唯讀摘要
│   ├── InspectorFooter.svelte  # 「還原草稿」+「退回暫存區／復原」切換（移除 staged 的圖章相關按鈕）
│   └── Lightbox.svelte         # 沿用 staged，前後張導覽改用 pageData.value.items
├── review/
│   ├── ReviewModal.svelte      # 沿用 staged
│   ├── ReviewHeader.svelte     # 沿用
│   ├── ReviewList.svelte       # 沿用（全選/勾選邏輯不變）
│   ├── ReviewListItem.svelte   # 依 entry.kind 分支：edit 用 diff 呈現；revert 用 kind pill（比照 tags/cleanup）
│   ├── ReviewImpact.svelte     # 開啟時顯示 loading，200ms 後查詢標籤影響（新增/移除），詳見第 5 節
│   └── ReviewFooter.svelte     # 沿用
└── logic/
    ├── page-data.svelte.ts     # 沿用（context 包 load 的 data）
    ├── filter.svelte.ts        # 幾乎照搬 compare 版本
    ├── operations.svelte.ts    # 沿用 staged 版本（pending 鎖 + 重新整理）
    ├── editor.svelte.ts        # 草稿本地狀態（含批次寫入方法）；currentId 淺路由同步；離頁守衛
    ├── draft.ts                # Draft 型別、problemOf/isTouched/tagDiff、commitDrafts
    ├── selection.svelte.ts     # 批次選取模式：選取集合、全選、委派批次動作給 editor
    ├── review.svelte.ts        # 沿用 staged 骨架，entries 改叫新版 buildReviewEntry
    ├── review-entry.ts         # ReviewEntry 改 discriminated union（edit/revert）
    └── lightbox.svelte.ts      # 沿用 staged，files 來源改 pageData.value.items 的 id
```

不搬 staged 的圖章模式（`stamp.svelte.ts`／`StampBadge.svelte`，釘選一張當範本、點擊/拖曳塗抹到其他卡片）：改用「篩選 + 多選 + 批次動作列」（見第 7 節），更適合 committed 頁常見的「符合某條件的一大批圖片都要加/去某個標籤」情境，且直接長在既有的篩選與草稿架構上。

---

## 4. 草稿資料模型（`logic/draft.ts`）

這是跟 staged 最關鍵的差異點：**staged 的草稿是「從空白填到有值」，committed 的草稿是「從既有值改成新值」**，因此每份草稿都要挾帶一份 baseline（建立草稿當下的原始快照），理由有三：

1. **審查清單要顯示「異動前 → 異動後」的 diff**（第 0 節第 4 點確認事項），diff 的「異動前」不能每次都去現場的 `pageData.value.items` 現查——因為使用者可能在編輯途中又改了篩選/排序（真的導覽、會重跑 `load`），甚至把該圖片篩出目前的可視範圍外，這時候手上已經沒有它的原始 record 可比對了。把 baseline 釘進草稿本身，diff 呈現就不受篩選狀態影響。
2. **樂觀併發檢查**：`PATCH /api/committed/[filename]` 與 `/api/proto/committed-batch` 都要求 `expectedUpdatedAt`（見 [`mutation/image.ts:58-67`](src/lib/mutation/image.ts#L58-L67)），這個值必須是「使用者開始編輯當下」讀到的 `updatedAt`，同樣得釘住不能事後現查。
3. **「已編輯」判定**：staged 的 `isTouched` 只看草稿是否非空；committed 的「已編輯」要看**草稿是否偏離 baseline**，沒有 baseline 就無從比較。

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

沒有草稿的卡片直接顯示伺服器回傳的 `ImageWithId`，不像 staged 需要一份共用 `EMPTY_DRAFT` 佔位——委託頁面的資料本來就有值可顯示，這點比 staged 單純。

### `editor.svelte.ts` 與 staged 的關鍵行為差異

- `touchedFiles`／`readyCount` 不能用「目前篩選可見的檔名列表」去derive（這是 staged 原本的寫法：`this.files.filter(f => this.drafts[f] && isTouched(...))`）。委託頁的 `this.files` 只代表「這次篩選/排序下可見的圖片」，使用者換一次篩選條件（真的導覽）就可能讓已編輯的圖片暫時消失於可見清單，若沿用 staged 寫法，這些「看不見但仍有未送出草稿」的圖片會從審查清單裡憑空消失。改成直接對 `Object.keys(this.drafts)` 做 `isTouched` 過濈，跟目前可見清單脫鉤。
- `activeFile`／`activeIndex`／`total` 這幾個「目前選取指標」則維持跟 staged 一樣，用目前篩選可見清單（`pageData.value.items`）去 derive——這些是給 Inspector 的「上一張/下一張」導覽用的，選取的圖片被篩出可視範圍時自動回落成 `null`（同 staged 現有邏輯），這裡沒有理由跟 staged 不同。
- `active` 多一層跟 URL `currentId` 的雙向同步（見第 2 節），staged 沒有這層，因為 staged 沒有外部深連結需求。

---

## 5. 審查清單（`review-entry.ts` / `ReviewListItem.svelte`）

### `ReviewEntry` 改為 discriminated union

比照 [`tags/cleanup/logic/review-entry.ts`](src/routes/tags/cleanup/logic/review-entry.ts) 已經在用的 `kind` 模式：

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

- **`kind: "edit"`**：
  - 名稱／評等只在跟 baseline 不同時才顯示 diff 行，比照 tags/cleanup 的 `<del>`／`<ins>`：`<del>{nameBefore}</del> → <ins>{nameAfter}</ins>`、`★<del>{ratingBefore}</del> → ★<ins>{ratingAfter}</ins>`。沒變動的欄位不顯示，避免每列都塞滿三行雜訊。
  - 標籤直接搬 `temp.md` 的 `+`／`−` Chip 設計：`addedTags` 用綠色 `+` chip，`removedTags` 用紅色 `−` chip。單一方向超過 5 個時，第 6 個起收斂成 `+N`／`−N` 溢出 chip（`temp.md` 原文的附註）。
- **`kind: "revert"`**：比照 tags/cleanup 的 `span.kind` 圓角徽章（這裡標「退回」，用 `--color-warning` 或 `--color-error` 色調），本體用 `<del>` 呈現即將被清空的 name/rating/tags 摘要，不需要「異動後」（異動後就是這筆紀錄整個消失、檔案回到暫存區）。

### `ReviewImpact.svelte`：新增 + 移除都要顯示，不能只有 staged 那種「將建立 N 個新標籤」

staged 現有的 `ReviewImpact` 只回答得出「新增」，因為 staged 全部都是從空白建立、沒有「移除」這個方向。committed 有 `removedTags`，這個 footer 理應完整回答：這次提交會新增幾個標籤、讓幾個標籤變成完全沒有圖片在用、還是兩者皆無。

**這個判斷沒辦法只靠本地既有資料算**：判斷「移除某張圖的標籤 X 後，X 是否在全庫變成 0 張圖片在用」，需要 X 目前的**全域**使用數，而審查清單裡的 `addedTags`／`removedTags` 只知道「這批選取的圖片對 X 做了什麼」，不知道 X 在批次之外還被多少張圖片用著。這個全域計數无法從頁面已載入的資料（`pageData.value.items` 只是目前篩選/排序下的子集）推得，需要另外查。

做法比照使用者提出的互動：**開啟審查清單當下 footer 立刻顯示 loading，debounce 200ms 後才真正發查詢**，勾選狀態改變（進而改變「這批到底碰了哪些標籤」）也會重新觸發同一個 debounce，避免每次勾一個 checkbox 就打一次 API：

1. **新增一個輕量 proto 端點**，只回傳「指定的一組標籤名稱，各自目前的全域使用數」，直接比照現有 [`GET /api/proto/tags-union-count`](src/routes/api/proto/tags-union-count/+server.ts)（`/tags` 合併區即時預估張數已經在用同款「小型只讀 proto 端點」模式）：

   ```ts
   // src/routes/api/proto/tags-impact/+server.ts
   /**
    * `GET /api/proto/tags-impact`
    * 原型專用：查詢一組指定標籤名稱目前個別的全域使用數（純讀取，不受篩選/遮蔽影響）。
    * Query：`names=<逗號分隔的標籤名稱>`，找不到的標籤 count 為 0。
    * 供 /committed 審查清單即時評估「新增/移除標籤」對標籤庫整體的影響。
    */
   export const GET: RequestHandler = ({ url }) => {
     if (!Database.isLoaded()) return json({ ok: false, error: "尚未載入資料庫" }, { status: 503 });
     const names = (url.searchParams.get("names") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
     const query = new Query(Database.requireLoaded());
     return json({ ok: true, data: { counts: query.tagCounts(names) } });
   };
   ```

   `Query` 類別（[`$lib/query/index.ts`](src/lib/query/index.ts)）新增一個對應方法，直接用 `Database.tagCount(name)`（已經是 O(1) 的 Map 查找，見 [`facet-index.ts:89`](src/lib/database/facet-index.ts#L89)，不需要掃全部標籤）：

   ```ts
   /** 查詢一組指定標籤名稱目前個別的全域使用數（未篩選、未遮蔽），找不到的標籤視為 0 */
   tagCounts(names: string[]): { name: string; count: number }[] {
     return [...new Set(names)].map((name) => ({ name, count: this.db.tagCount(name) }));
   }
   ```

2. **`review.svelte.ts`** 新增 debounce + 序號防過期回應的邏輯，寫法比照 [`TagInput.svelte:46-81`](src/lib/components/widgets/TagInput.svelte#L46-L81) 既有的 `requestSeq`／`debounceTimer` 模式：

   ```ts
   /** 目前勾選的 edit 項目觸及到的標籤（新增+移除聯集），決定要查詢誰的全域使用數 */
   private touchedTagNames = $derived.by(() => {
     const set = new Set<string>();
     for (const e of this.entries) {
       if (!e.checked || e.kind !== "edit") continue;
       for (const t of e.addedTags) set.add(t);
       for (const t of e.removedTags) set.add(t);
     }
     return [...set];
   });

   /** 指定標籤在這批勾選項目裡的淨變化（+1 新增 / -1 移除，可正可負） */
   private netDelta(tag: string): number {
     let delta = 0;
     for (const e of this.entries) {
       if (!e.checked || e.kind !== "edit") continue;
       if (e.addedTags.includes(tag)) delta++;
       if (e.removedTags.includes(tag)) delta--;
     }
     return delta;
   }

   private impactPending = $state(false);
   private impactCounts = $state(new Map<string, number>());
   private impactSeq = 0;
   private impactTimer: ReturnType<typeof setTimeout> | undefined;

   /** 影響評估查詢中（供 footer 顯示 loading） */
   impactLoading = $derived(this.impactPending);
   /** 此次提交將變成全新（目前 0 張圖片在用）的標籤 */
   newTags = $derived(this.touchedTagNames.filter((t) => {
     const before = this.impactCounts.get(t) ?? 0;
     return before === 0 && before + this.netDelta(t) > 0;
   }));
   /** 此次提交後將變成完全沒有圖片在用的標籤 */
   orphanedTags = $derived(this.touchedTagNames.filter((t) => {
     const before = this.impactCounts.get(t) ?? 0;
     return before > 0 && before + this.netDelta(t) <= 0;
   }));

   // 建構子內：
   $effect(() => {
     const names = this.touchedTagNames;
     const open = this.open;
     clearTimeout(this.impactTimer);

     if (!open || names.length === 0) {
       this.impactPending = false;
       this.impactCounts = new Map();
       return;
     }

     this.impactPending = true;
     const seq = ++this.impactSeq;
     this.impactTimer = setTimeout(async () => {
       const res = await api.get<{ counts: { name: string; count: number }[] }>(
         `/api/proto/tags-impact?names=${encodeURIComponent(names.join(","))}`,
       );
       if (seq !== this.impactSeq) return; // 已有更新的查詢在路上，這次回應作廢
       this.impactPending = false;
       if (res.ok && res.data) this.impactCounts = new Map(res.data.counts.map((c) => [c.name, c.count]));
     }, 200);
   });
   ```

3. **`ReviewImpact.svelte`** 呈現四種互斥狀態，不再是 staged 那種「只可能講新增」的單一句型：

   ```svelte
   {#if review.impactLoading}
     <CircularProgress size="0.875rem" />
     <span>正在評估標籤影響…</span>
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

   `plusTag`／`minusTag` 兩個 snippet 直接沿用 `temp.md` 的 `+`／`−` Chip 視覺（跟第 5 節 `ReviewListItem` 每列用的是同一組樣式），聚合層級一樣適用「超過 5 個收斂成 `+N`／`−N`」的規則。

   > 這個專案目前沒有 skeleton／shimmer 佔位元件的先例，loading 狀態沿用 [`TagInput.svelte`](src/lib/components/widgets/TagInput.svelte) 既有的 `CircularProgress` + 文字寫法，而不是另外新造一個 skeleton 元件。如果你想要的是實體的灰色骨架佔位而不是 spinner，跟我說一聲，這裡可以再調整。

---

## 6. Inspector 的編輯／退回雙態

`InspectorFooter.svelte` 用兩個互斥 snippet 切換（沿用 staged 用 `stampEntry`／`stampControl` 做模式切換的既有手法，只是這裡切的是編輯／退回）：

- **一般模式**：「清空草稿」（草稿還原成 baseline，等同 staged 的 `handleClear`，但目標值換成 baseline 而不是空白）＋「退回暫存區」按鈕（`IconArrowBackUpDouble`，跟 [`compare/list/ListItem.svelte:33-40`](src/routes/compare/list/ListItem.svelte#L33-L40) 現有的「取消提交」用同一顆圖示，維持全站一致）。
- **已標記退回模式**：欄位唯讀或直接隱藏，顯示「此圖片將於送出後退回暫存區」提示 + 「復原」按鈕清掉 `kind: "revert"` 草稿。

點「退回暫存區」**不需要**跳 `requestConfirm()` 二次確認對話框——這是跟 staged 的 `handleDelete`（立即刪檔，需要二次確認）以及 compare 的 `handleRevert`（立即生效，也需要二次確認）刻意不同的地方：因為現在退回是草稿的一種，真正的破壞性動作被推遲到審查清單的「提交」，審查清單本身（逐筆可勾選/可反悔）已經扮演了確認的角色，這裡再加一層確認對話框反而是重複的摩擦。

---

## 7. 批次選取與批次編輯

`logic/selection.svelte.ts` 是一個獨立於 `editor.svelte.ts` 的 controller（依相依順序在它之後建立），管理「批次選取模式」的開關與選取集合，實際寫入草稿的動作委派回 `editor`——批次編輯跟單張編輯共用同一份 Draft 模型與同一條審查/送出流程，不另開資料流。

```ts
class SelectionController {
  private editor = getEditorContext();
  private pageData = getPageDataContext();

  /** 批次選取模式是否開啟 */
  active = $state(false);
  private ids = new SvelteSet<string>();

  selectedFiles = $derived([...this.ids]);
  count = $derived(this.ids.size);
  isSelected = (filename: string) => this.ids.has(filename);

  /** 目前篩選結果是否已全選（供全選 checkbox 的三態判斷） */
  allSelectedState = $derived.by(() => { /* 同 ReviewList 的 bulkSelectionState 三態邏輯 */ });

  /** 開關批次選取模式；關閉時清空選取集合（同 stamp.handleExit 的既有慣例） */
  handleToggleMode = () => {
    this.active = !this.active;
    if (!this.active) this.ids.clear();
  };

  handleToggle = (filename: string) => { /* 加入/移出 ids */ };
  handleToggleAllVisible = () => { /* 對 pageData.value.items 全選/取消全選 */ };
  handleClearSelection = () => { this.ids.clear(); };

  /** 以下委派給 editor，實際寫入 Draft */
  handleAddTag = (tag: string) => this.editor.handleBulkAddTag(this.selectedFiles, tag);
  handleRemoveTag = (tag: string) => this.editor.handleBulkRemoveTag(this.selectedFiles, tag);
  handleSetRating = (rating: number) => this.editor.handleBulkSetRating(this.selectedFiles, rating);
  handleRevert = () => this.editor.handleBulkRevert(this.selectedFiles);
}
```

`editor.svelte.ts` 新增對應的批次寫入方法，內部就是把單張編輯已經有的邏輯（`ensureDraft` / merge tags / overwrite rating / 標記 revert）套進一個迴圈，沒有新的驗證規則——加標籤恆合法；去標籤若把某張圖的標籤清空，那張圖的 `problemOf` 會回傳「至少需要一個標籤」，在審查清單裡自然變成不可勾選並顯示原因，逼使用者回 Inspector 個別處理，不需要額外的批次專用驗證邏輯：

```ts
handleBulkAddTag = (filenames: string[], tag: string) => {
  const t = tag.trim();
  if (!t) return;
  for (const f of filenames) {
    const d = this.ensureDraft(f);
    if (d.kind === "revert") continue; // 已標記退回的略過
    if (!d.tags.includes(t)) this.writeDraft(f, { ...d, tags: [...d.tags, t] });
  }
};

handleBulkRemoveTag = (filenames: string[], tag: string) => {
  for (const f of filenames) {
    const d = this.drafts[f];
    if (!d || d.kind === "revert") continue; // 沒草稿代表沒這個標籤可去，直接跳過
    this.writeDraft(f, { ...d, tags: d.tags.filter((t) => t !== tag) });
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
    const baseline = this.drafts[f]?.baseline ?? this.baselineOf(f); // 沒草稿時從目前 record 建立
    this.writeDraft(f, { kind: "revert", baseline });
  }
};
```

`ensureDraft(filename)` 是新增的私有方法：草稿已存在就回傳現有的，不存在就用目前 `pageData.value.items` 裡對應的 record 建立一份 `kind: "edit"` 的新草稿（`baseline` 與初始欄位皆取自 record）。

### UI

- **`Actions.svelte`**：新增一顆「批次選取」切換鈕（`Button` + 適當圖示），開啟時 `Card.svelte` 的點擊行為從「開啟 Inspector」改成「勾選」（跟 staged `Card.svelte` 依 `stamp.isActive` 分支點擊行為是同一種結構，換成 `selection.active`）；同時建議在切換鈕旁加一顆全選 checkbox（沿用 `Checkbox` 元件的三態），對應「篩選出一批 → 一鍵全選」的核心情境。
- **`Card.svelte`**：選取模式中，卡片角落顯示一個 checkbox 疊層反映 `selection.isSelected(filename)`，樣式上比照現有「未編輯／已編輯／標記退回」三態再疊加一種「選取中」外觀（邊框/背景反白，沿用 `button.active` 現有的 accent 色調即可，不需要新色階）。
- **`SelectionBar.svelte`**：`selection.count > 0` 時顯示的浮動動作列，版面比照 [`staged/cards/StampBadge.svelte`](src/routes/staged/cards/StampBadge.svelte)（`Popover` 錨定在卡片牆上緣置中）。內容：「已選取 N 張」+ 四個快速動作：
  - 「＋ 標籤」：彈出一個輸入框（可直接用 `Combo`／簡化版 `TagInput` 的候選查詢部分，不需要完整雙向綁定的標籤清單），輸入後呼叫 `selection.handleAddTag`。
  - 「－ 標籤」：同樣是輸入框（自由輸入，不限定於選取項目目前共有的標籤），呼叫 `selection.handleRemoveTag`。
  - 「設定評等」：一個 `Rating` 選擇器，呼叫 `selection.handleSetRating`。
  - 「退回選取」：呼叫 `selection.handleRevert`（同單張退回，不需要二次確認，草稿本身可在送出前復原）。
  - 「取消選取」：呼叫 `selection.handleToggleMode` 結束整個批次選取模式。

批次動作套用後，卡片牆與 Inspector 立即反映最新草稿狀態（跟單張編輯完全共用 derived 狀態），使用者可以個別點進某張卡片微調批次套用後的結果，最後照樣統一走「檢視待提交的變更」審查清單送出。

---

## 8. 提交流程與 API 異動

### 為什麼要擴充 `/api/proto/committed-batch`

送出審查清單時，勾選項目裡混著兩種操作：`kind: "edit"` 要走 `updateRecord`（PATCH 語意），`kind: "revert"` 要走 `removeRecord`（DELETE 語意）。現有 `/api/proto/committed-batch`（[`api/proto/committed-batch/+server.ts`](src/routes/api/proto/committed-batch/+server.ts)）只支援前者，`removeRecord` 目前只有單筆的 `DELETE /api/committed/[filename]`。

兩個選項：
1. **前端自己發兩批請求**（一次 batch POST 給 edit、N 次個別 DELETE 給 revert），再手動合併兩種不同形狀的回應成統一的失敗清單。
2. **擴充 proto 端點，讓它一次吃兩種操作**，回應維持原本 `{ results: [{ id, ok, error? }] }` 的單一形狀。

選 2。這正是 [[proto-api-debt-boundary]] 這條記憶要提醒的情況：`/api/proto/*` 本來就是標了「原型」的技術債，該讓它自己背負「支援兩種操作」的複雜度、寫 TODO 留給日後轉正，而不是讓 `committed/logic/review.svelte.ts` 這種本該乾淨的頁面邏輯去遷就它、手動縫合兩種 API 回應形狀。

### 擴充後的 payload

```ts
type CommittedBatchItem =
  | { id: string; op?: "update"; name?: string; tags?: string[]; rating?: number; expectedUpdatedAt: number }
  | { id: string; op: "revert" };
```

伺服器端 `op === "revert"` 呼叫 `mutation.removeRecord(id)`，其餘沿用現有的 `mutation.updateRecord(...)` 分支。比照這個檔案現有的 TODO 風格（`tags/cleanup/logic/changeset.ts` 開頭已經有一句 `TODO: 重新思考職責與正確位置`），在擴充處加註：

```ts
// TODO: 原型端點，混雜 update/revert 兩種操作；正式轉正時應拆成語意更清楚的端點或改走真正的批次 command 模式
```

> 更正：先前這裡誤把 [`errorMessage()`](src/routes/api/proto/committed-batch/+server.ts#L13-L24) 裡的 `case "last_tag"` 分支說成死碼，這是錯的，不要清掉。`last_tag` 是很重要的業務規則——「一張已提交圖片不可以沒有標籤」——只是這條規則在兩種操作路徑上分屬不同層級的守門：
> - **單張圖片編輯**（`ImageCommands.update`／本頁的 `updateRecord`）：規則落在 `Validator.tags()` 這一層，本來就會擋掉 `tags: []` 的 patch，回傳的是 `Validation` 而不是 `LastTag`，所以這裡確實不會走到 `last_tag` 分支。
> - **整個標籤被刪除**（`TagCommands.delete`，即 [`mutation/tag.ts:74-95`](src/lib/mutation/tag.ts#L74-L95)）：這時候是從標籤那一端出發、砍掉所有圖片身上的這個標籤，`Validator` 管不到「這會不會讓某張圖從此變成沒有任何標籤」這件事，所以另外用 `LastTag` 擋下來並回報受影響的圖片 id。這條路徑目前由 `/tags`、`/tags/cleanup`（透過 `tags-batch`）在用，是活著的業務邏輯，不是廢棄分支。
>
> 也就是說 `committed-batch` 這個檔案裡的 `errorMessage()` 的確不會被 `last_tag` 分支命中（因為它只呼叫 `updateRecord`／`removeRecord`），但那是「這個端點目前的呼叫方式用不到」，不是「這個 case 沒用」——維持原樣即可，不需要清理。

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

跟 staged 的 `commitDrafts` 一樣的失敗匯總形狀，`review.svelte.ts` 的 `handleSubmit` 幾乎可以整段照抄 staged 版本，不必為了 edit/revert 混合而多寫分支。

---

## 9. Toolbar 細節

`Toolbar.svelte`：`<Filters />`（左）+ `<Actions />`（右），版面直接照抄 [`compare/header/Toolbar.svelte`](src/routes/compare/header/Toolbar.svelte)。

`Filters.svelte`／`FilterButton.svelte`／`FilterPopover.svelte`：整份搬 compare 版本，`getFilterContext()` 換成本頁的 `filter.svelte.ts`（內容幾乎一致，見下方 `logic/filter.svelte.ts`）。

`Actions.svelte`（右側），比照 [`staged/header/Toolbar.svelte`](src/routes/staged/header/Toolbar.svelte) 的按鈕群，不放額外的統計卡，但多一顆批次選取切換鈕（見第 7 節）：

```svelte
<div>
  <Button variant="ghost" padding="icon" aria-label="重新整理" onclick={operations.handleRefresh} ... >
    <IconReload size={16} />
  </Button>
  <Button
    variant={selection.active ? "primary" : "outlined"}
    aria-pressed={selection.active}
    onclick={selection.handleToggleMode}
  >
    批次選取{#if selection.count > 0}（{selection.count}）{/if}
  </Button>
  <Button variant="primary" status={...} onclick={review.handleOpen}>
    檢視待提交的變更 ({touchedCount})
  </Button>
</div>
```

不需要 staged 的「匯入紀錄」按鈕（那是暫存區專屬流程）。已編輯張數就直接顯示在「檢視待提交的變更 (N)」按鈕文字上，不另外做 staged 那種 `SessionProgress` 統計卡。

---

## 10. 需要同步修正的既有程式碼

- [`(home)/logic/detail.svelte.ts:24,27`](src/routes/(home)/logic/detail.svelte.ts#L24-L27)：`/editor` → `/committed`。這是死連結，不管 committed 頁最終長什麼樣都需要修。

---

## 11. 明確排除在本次範圍外

- staged 原本的圖章（釘選＋拖曳塗抹）模式——改用第 7 節的篩選＋多選＋批次動作列取代，不兩者並存。
- `(layout)/ModalTrigger.svelte` 對淺路由 `currentId` 的過期讀取問題（全站共通的既有 TODO，不是本頁引入的新問題）。
- 開發伺服器啟動、瀏覽器手動測試（依專案規範由使用者驗收，不自動執行）。

---

## 12. 待使用者確認的剩餘小節點

1. 批次動作列的「＋ 標籤」「－ 標籤」一次只能操作一個標籤，還是要比照 `TagInput` 支援一次輸入多個（逗號分隔）？
2. 第 5 節 `ReviewImpact` 的 loading 狀態，用現有 `CircularProgress` + 文字（沿用 `TagInput` 既有寫法），還是要做成實體的灰色骨架佔位（本專案目前沒有這種元件的先例，會是新增）？

其餘設計已經比照使用者確認過的方向（骨架仿 staged、退回併入草稿流程、標籤/評分/名稱都做 diff、預設排序改 `committedAt`、Toolbar 不放統計卡、批次編輯採篩選＋多選＋批次動作列、審查清單標籤影響評估改成開啟時 debounce 查詢且新增/移除都要呈現）收斂完畢，可以進入實作階段。
