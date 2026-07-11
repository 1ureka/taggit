# 世代快取（Generation Cache）：讀取查詢的記憶化

> 以一個「隨每次寫入遞增的世代號（revision）」為地基，把 `Query` 的重查詢**記憶化**：相同查詢在兩次寫入之間只算一次，之後直接回傳快取結果。核心不變式——**任何一次寫入令 revision 前進，整個讀取快取立即失效**——所以「重複查詢近乎免費」與「寫入後立即新鮮」同時成立。

## 動機（有實測撐腰）

editor 切換圖片時，前端每次都重跑 `+page.server.ts` 的 `load`，而 load 的重查詢**產出的結果在切換之間位元一致**（只有 `currentId` 變，篩選條件不變）。實測一次 editor load 的伺服器成本約 50ms，其中「計算」佔大頭，而計算裡最貴的又是**確定性、可快取**的部分：

| load 組成 | 計算時間 | 說明 |
|---|---|---|
| `committedFiles`（全部） | ~4ms | materialize + 排序 2491 筆 |
| `facets`（全部） | ~15–19ms | 6574 標籤，**大半是 Intl 排序** |
| `authoringTags`（全部） | ~13ms | 6574 標籤，**~80% 是 Intl 排序** |

其中標籤查詢的 ~13ms **幾乎全是排序**（見 [報告 5](./5-tag-query-perf.md)），而排序結果只在寫入時才會變。**每次導航都把這個確定性的結果從頭算一遍，是純粹的浪費**——這正是記憶化的完美標的。

> 先前一度認為「查詢很便宜，快取沒用」。實測推翻了它：查詢不便宜，而且貴在一個**切換時完全不變**的地方。世代快取省的正是這最貴的一塊。

## Part A — 世代計數器（`Database.revision()`）

在 store 增加一個單調遞增計數器，作為「資料版本」的唯一真實來源。

```ts
// store.ts
private revisionCounter = 0;

/** 資料版本；任何寫入或（重）載入都會使其改變。快取以此為失效依據。 */
revision(): number {
  return this.revisionCounter;
}
```

**遞增時機**（掛在既有的兩個咽喉，無需新增）：

- `markDirty()` 內 `this.revisionCounter++`——涵蓋所有 commit / update / delete / tag 操作（已驗證所有 mutation 都經過 `markDirty`：[mutation/image.ts](../src/lib/mutation/image.ts)、[mutation/tag.ts](../src/lib/mutation/tag.ts)）。
- `load()` 內也 `++`——切換 collection = 換一整個世界，舊快取必須失效。

對外以 `Database.revision()` 暴露（照 `Database.isLoaded()` / `requireLoaded()` 的靜態單例慣例）。

> **不變式**：`revision()` 只增不減，且「值相同 ⟺ 資料自上次以來未變」。下面 Part B 的正確性全靠這一條。

## Part B — 記憶化查詢快取

### 放哪裡

`new Query(db)` 是**每個請求 new 一個**，快取不能放實例欄位——必須是**行程級單例**（照 `__db` / `__imageLibrary` 的 `globalThis` + HMR 護體慣例）。新增：

```
src/lib/query/cache.ts   # class QueryCache（行程單例，globalThis 護體）
```

`Query` 的 `.images / .facets / .tags` 改為：先問 cache，命中即回；否則跑引擎、寫入 cache、回傳。`getImage` 是 O(1) 物件查找，**不快取**。

### 失效策略：clear-on-revision-change（最簡且可證正確）

cache 自己記著「我是哪個 revision 的」；每次讀取前比對 `Database.revision()`：

```ts
class QueryCache {
  private revision = -1;
  private map = new Map<string, unknown>();   // 以 LRU 上限保護（見下）

  get<T>(rev: number, key: string, compute: () => T): T {
    if (rev !== this.revision) { this.map.clear(); this.revision = rev; }  // 一有寫入就整包失效
    const hit = this.map.get(key);
    if (hit !== undefined) return hit as T;
    const val = compute();
    this.map.set(key, val);
    return val;
  }
}
```

- **正確性**：cache 永遠只持有「當前 revision」的結果；任何寫入使 revision 前進 → 下一次讀取整包 `clear()` → 不可能回傳舊資料。比「把 revision 塞進 key」更簡單，且不會累積不可達的舊 key。
- **代價**：每次寫入後讀取快取全冷。可接受——風暴是**讀**、寫入相對稀少；冷啟後第一個請求算完即回暖。

### 快取鍵：查詢規格的正規化序列化

key = `方法名 : 查詢規格正規化字串`。查詢規格（`ImageQuery` / `TagFacetQuery` / `TagQuery`）已是由 searchParams 建構的結構化 value object（[query-spec/](../src/lib/query-spec/)），為它們加一個 canonical `toKey()`（欄位依固定順序序列化，含 where / sort / order / page / limit）。**不要**直接用原始 `url.search`——同義但字串不同的 params（順序、預設值）會造成假 miss。

### 必須排除的例外：`random` 排序

`ImageEngine.sort` 對 `sort === "random"` 做洗牌（[query/images.ts:44-48](../src/lib/query/images.ts#L44)）。快取會凍住亂序，違反語義。**`random` 一律繞過快取**（`toKey()` 對 random 回傳 `null` 或呼叫端判斷跳過）。compare / player 頁的隨機瀏覽因此行為不變。

### LRU 上限（次要安全網）

同一 revision 內不同 params 的組合有限，但為防呆給 `map` 一個條目上限（如 128），超過時淘汰最久未用。可沿用 [image/resources.ts:20](../src/lib/image/resources.ts#L20) 的 `LRUCache` 精神，或寫個條目導向的小 LRU。

### 不變式：結果視為唯讀

`materialize` 每次回傳新陣列與新物件，但快取後**多個呼叫端會共享同一份**。所有現有呼叫端都只把結果序列化成 JSON（唯讀），安全。**明訂契約：查詢結果不得被就地修改**；未來若有呼叫端要改，需先 clone。

## 效果與誠實的邊界

**能省的（計算）**：以 editor load 為例，重複呼叫時 `committedFiles`（~4ms）+ `facets`（~17ms）+ `authoringTags`（~13ms）≈ **34ms 的計算被打成接近 0**。

**不能省的（序列化 / 傳輸）**：SvelteKit 的 `load` 契約是「回傳 JS 物件，序列化交給框架」，所以**每次回應仍會重新序列化**那份結果（editor load 約 ~14ms 序列化），世代快取插不進手把去省它。傳輸量同理。

> 一句話：**世代快取省的是「重算」，不是「重新序列化 / 重傳」。** 在 `load` 這條路上，它把伺服器成本從 ~50ms 降到約 ~14ms（序列化殘量）；要再往下，屬於「降低傳遞量 / 前端別往返」的另一條軸，與本報告正交。而在你真正握有 `Response` 的地方（若日後某些讀取改走 GET 端點），快取的還能是「已序列化字串」，連序列化都省——但那是另一個決策，本報告不涉入。

## 呼叫端影響

| 檔案 | 改動 |
|---|---|
| [store.ts](../src/lib/database/store.ts) | 加 `revisionCounter` + `revision()`；`markDirty()` / `load()` 內 `++` |
| [database/index.ts](../src/lib/database/index.ts) | 導出 `Database.revision()`（若非自動） |
| `src/lib/query/cache.ts`（新增） | `QueryCache` 行程單例（globalThis + HMR 護體） |
| [query/index.ts](../src/lib/query/index.ts) | `.images/.facets/.tags` 包一層 cache；`random` 繞過；`getImage` 不動 |
| [query-spec/*](../src/lib/query-spec/) | 各查詢規格加 canonical `toKey()`（random → 跳過） |
| 各 `+page.server.ts` 讀取端 | **零改動**——透明受惠 |

## 已定案的決策

- 世代號掛在 `markDirty()` + `load()`，不新增咽喉；「值相同 ⟺ 未變」為唯一正確性依據。
- 失效用 clear-on-revision-change，不把 revision 塞進 key。
- `random` 排序永不快取；`getImage` 不快取。
- 查詢結果視為唯讀，共享安全；未來要改需先 clone。
- 只承諾省「重算」；序列化 / 傳輸不在本報告範圍。

## 風險 / 注意

- **HMR**：`QueryCache` 用 `globalThis.__queryCache` 護體，熱重載保留；因綁 revision，HMR 後若 revision 對得上仍可命中——語義正確。
- **`toKey()` 正規化不足 = 快取污染或假 miss**：務必對「同義 params」正規化（省略預設值、固定欄位順序），並與 `fromSearchParams` 對齊。建議補單元測試：同義 params → 同 key；不同 where/sort → 不同 key。
- **唯讀契約**：導入前掃一遍現有呼叫端，確認沒有人就地修改 `query.*` 的回傳（目前皆為 SSR 序列化，唯讀）。
- **切換 collection**：確認 `load()` 的 `++` 在新資料就緒後，使舊 collection 的快取項不可命中。

## 驗收

- 任一 commit / update / delete / tag 操作後 `Database.revision()` 遞增；切換 collection 後遞增。
- 連續相同 `query.images/facets/tags`（非 random）第 2 次起走快取（用計數器或 log 驗證），且一次寫入後立即 miss、回傳新資料（不過時）。
- `random` 的 compare / player 隨機瀏覽每次仍變。
- 既有 `test/` 綠燈；`svelte-check` / build 無型別錯誤。
