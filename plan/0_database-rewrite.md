# 0_ database 模組重寫：兩實體、兩引擎（已完成）

> 本文記錄「已實作」的底層重寫。修 bug 與前端重構屬後續，見
> [1_bugfixes-and-frontend-refactor.md](./1_bugfixes-and-frontend-refactor.md)。

## 動機

hidden 標籤上線後暴露的一連串 bug，本質都是同一件事：**database 模組沒有把「標籤」當成一等實體看待**。所有標籤讀取都是 faceted、遮蔽、count 導向、used-only，把「篩選述詞」與「被編寫／管理的實體」兩種角色混在同一條通道。此重寫先把底層地基補正，讓後續 bug 變成「呼叫端組合」而非「新增特例 API」。

## 新模型

### 兩個實體
- 圖片：`ImageWithId`（不變）。
- 標籤：**`Tag = { name, count, meta: TagMeta }`**，對標 `ImageWithId` —— `name` 為身份、`count` 為查詢衍生、`meta` 為標籤自身設定（補齊預設）。**擴展只加在 `TagMeta`**，不再往查詢型別焊欄位。

### 兩個引擎（database/server 對外只有這兩個 query）
- `queryImages(conditions) → { items, total, page, pages }`
- `queryTags(conditions?, opts?) → Tag[]`

兩者共用私有原語 **`resolveScope(db, filterParams) → { preHidden, visible, included }`**（`src/lib/database/internal/query.ts`）：把圖片篩選條件解析成位元圖 scope。`queryImages` 據此排序／分頁／materialize；`queryTags` 據此逐一計數標籤並附 meta。**兩者以「相同條件」各自取用，不互相傳遞結果** —— facet 查詢＝呼叫端以相同 `conditions` 同時呼叫兩者。

> 為何不把 `queryImages` 的輸出當 scope：facet 是對「篩選後、未分頁」的集合計數，而 `queryImages` 回傳的是排序＋分頁後的結果（compare 甚至只回 2 張）。所以正確 scope 本就不是它的輸出；由 `conditions` 各自解析才對，且保持兩引擎純粹、互不依賴。

### queryTags 的組合選項 `TagQueryOptions`
- `hidden`: `"mask"`（預設，篩選語境；含「hidden 且不在查詢內的標籤，count 以加入後可見數計」的 UI 語義）｜`"ignore"`（編寫／管理語境，不遮蔽）。
- `universe`: `"used"`（預設，只列 scope 內用到的）｜`"all"`（併入僅有 meta、未使用的 ghost 標籤，count 0）。

## 具體改動

| 檔案 | 改動 |
|------|------|
| `internal/types.ts` | 刪除 `TagFacet`／`TagInfo`／`TagWithSamples`／`TagImageSample`／`TagSortField`／`TagSampleMode`／舊 `TagQueryOptions`／`TagQueryResult`；新增 `Tag` 與新 `TagQueryOptions`；`QueryResult` 移除 `facets` 欄位。 |
| `internal/query.ts` | 抽出 `resolveScope`；`queryImages` 不再算 facets；新增 `queryTags(db, conditions, opts)`；刪除 `computeFacets`／`getAllTagFacets`／舊 sample 版 `queryTags` 及其全部 helper。 |
| `internal/params.ts` | 刪除死碼 `parseTagQueryParams`／`buildTagQueryString` 及相關 helper（無任何消費者）。 |
| `server.ts` | `queryTags(params?, opts?) → Tag[]`；刪除 `getAllTagFacets`；型別 re-export 收斂。 |
| `client.ts` | 移除 `buildTagQueryString`／`parseTagQueryParams` 與已刪型別的 re-export；新增 `Tag`。 |
| 呼叫端 `+page.server.ts`（home／player／compare／editor） | `facets` 改由 `database.queryTags(url.searchParams)` 取得（取代 `queryImages().facets`）。 |
| 呼叫端 `+page.server.ts`（tagger／settings） | `getAllTagFacets()` → `queryTags()`（無參數＝全庫）。 |
| `app.d.ts`／`Autocomplete(.svelte/.ts)`／`settingsHiddenTags.svelte.ts` | 型別 `TagFacet` → `Tag`；`f.hidden` → `f.meta.hidden`（純型別／存取路徑調整）。 |

## 刻意保留的行為（＝故意不修 bug）

- 所有呼叫端一律用 `queryTags` 的**預設** `{ hidden: "mask", universe: "used" }`，精確重現舊 `queryImages().facets` 與 `getAllTagFacets()` 的輸出。
- 因此先前發現的 hidden 相關 bug（互相共存的 hidden 標籤在清單消失、ghost 標籤看不到、編寫語境候選被遮蔽）**依舊存在**，留待 [1_](./1_bugfixes-and-frontend-refactor.md) 以「換組合選項」修復。
- `page.data.facets` 欄位名暫時沿用（呼叫端組合不變）；改名為雙通道屬前端重構範圍。

## 備註

- **命名**：`facets` 欄位名待前端重構時再處理；`Tag` 已取代語義誤導的 `TagFacet`。
- **效能**：query 頁現在對同一 `conditions` 各跑一次 `resolveScope`（images 一次、tags 一次）。皆為位元圖集合運算，相對 materialize＋排序可忽略；facet 不再是免費副產物是此正交化的已知、可接受成本。
- **驗證**：`svelte-check` 0 error / 0 warning；全庫無殘留對已刪符號的引用。行為對照舊實作為等價（同樣的 mask／used 預設）。
