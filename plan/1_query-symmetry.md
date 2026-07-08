# 1_ 查詢層對稱化：型別、params、引擎三層一致

> 承接 [`0_database-rewrite.md`](./0_database-rewrite.md)。0_ 把「兩實體、兩引擎、共用 `resolveScope`」的地基補在**引擎層**；本計畫把同一份對稱**往上推到型別層與 params 層**，讓標籤成為與圖片完全平權的一等查詢主體。

## 動機

0_ 之後，引擎已對稱（`queryImages` / `queryTags` 共用 `resolveScope`），但**型別與 params 仍停在「圖片是一等公民、標籤是附屬」的舊世界**，有三處結構債：

1. **泛用名稱其實是圖片專用。** `QueryOptions`（`sort` 只含 `committedAt/rating/...`、`search` 指「圖片名稱」）、`SortField`、`QueryResult`、`parseQueryParams`/`buildQueryString` 全是圖片語義，卻用泛用名，讀者無從得知它們不適用於標籤。

2. **`FilterParams` 與 `QueryOptions` 重複。** 真相是 `FilterParams ⊂ QueryOptions`：前者是「述詞」，後者是「述詞 + 呈現（sort/order/page/limit）」。兩者該收斂成單一真相源。

3. **標籤側缺一整套查詢棧。** 圖片有 filter / query / sortField / result / params 全套；標籤只有 `TagQueryOptions = { hidden, universe }`（計數語義），**沒有自己的 sort（count/name）、沒有分頁、沒有 result 型別、沒有 params**。未來「以標籤為主角的頁面」（draft 項目 5）與「改善詳細排序」（項目 4）一旦動工，現有架構會被迫新增特例，重演 0_ 之前的困境。

本計畫先把命名與型別的對稱補齊，讓標籤頁變成「呼叫端組合既有引擎」而非「新增特例 API」。

## 目標對稱結構

每個實體都擁有平行且完整的查詢棧；唯一的**本質不對稱**是 Tag 的 `count` 定義在某個 image scope 之上，圖片不依賴標籤 —— 故 `queryTags` 的第一參數恆為 image scope 述詞。

| 面向 | Image 域 | Tag 域 |
|------|----------|--------|
| 述詞 / filter | **`ImageFilter`**（= 舊 `FilterParams` 升格為公開型別） | scope 直接**復用** `ImageFilter` |
| 查詢 | **`ImageQuery extends ImageFilter`**（+ sort/order/page/limit） | **`TagQuery`**（+ search/sort/order/page/limit/hidden/universe） |
| 排序欄位 | **`ImageSortField`** = `committedAt｜rating｜name｜random` | **`TagSortField`** = `count｜name` |
| 結果 | **`ImageQueryResult`**（items/total/page/pages） | **`TagQueryResult`**（items/total/page/pages） |
| params | **`parseImageQuery`** / **`buildImageQuery`** | **`parseTagQuery`** / **`buildTagQuery`** |
| 引擎 | `queryImages(db, query: ImageQuery)` | `queryTags(db, scope: ImageFilter, query: TagQuery)` |

- **`ImageFilter` 是唯一述詞真相源**，`ImageQuery extends ImageFilter`，兩引擎的 scope 參數都吃 `ImageFilter`；`resolveScope(db, ImageFilter)`。debt #2 消失。
- 引擎的「1 參數 vs 2 參數」不對稱是**刻意且正確**的：第一參數恆為「image scope 述詞」，第二參數為「你要的實體怎麼呈現」。
- **兩引擎仍不互傳結果。** 標籤頁分頁取得 `TagQueryResult` 後，呼叫端**自行**對每個 tag 呼叫 `queryImages({ includedTags: [tag.name], sort: "random", limit: N })` 取預覽 sample —— 維持 0_ 的純粹性原則。（N = 一頁的 tag 數，每次 queryImages 皆為位元圖廉價操作；若日後 profiling 顯示瓶頸再議批次原語，本計畫不引入。）

## 已定案的取捨

1. **命名去 `Options` 後綴**：`ImageQuery`/`ImageFilter`/`TagQuery`/`ImageQueryResult`/`TagQueryResult`/`ImageSortField`/`TagSortField`。代價是 `QueryOptions→ImageQuery` 的全庫替換，換取最高對稱度。
2. **`queryTags` 回傳 `TagQueryResult`**（`{ items, total, page, pages }`），與 `queryImages` 完全對稱，直接支援標籤頁分頁；既有 facet 呼叫端改用 `.items`。
3. **標籤頁為全庫、不疊 image scope**：tag 的 URL 直接用 `sort/order/page/search`（無 image filter 參數同存，不會撞名）。「scope 內的標籤」需求已由 facet 側欄（`queryTags(imageParams)`）覆蓋，兩者分工清楚。

## 具體改動

| 檔案 | 改動 |
|------|------|
| `internal/types.ts` | 新增 `ImageFilter`（`search?/includedTags?/excludedTags?/rating?/ratingOp?`）；`QueryOptions`→`ImageQuery extends ImageFilter`；`SortField`→`ImageSortField`；`QueryResult`→`ImageQueryResult`。`TagQueryOptions`→`TagQuery`，併入 `search?`、`sort?: TagSortField`、`order?`、`page?`、`limit?`（保留 `hidden?`、`universe?`）；新增 `TagSortField`；新增 `TagQueryResult`。 |
| `internal/query.ts` | `resolveScope` 參數型別對齊（內部正規化沿用，`FilterParams` 為 resolveScope 前的正規化中介，非公開）；`queryImages(db, query: ImageQuery): ImageQueryResult`（純改型別名）；`queryTags(db, scope: ImageFilter, query: TagQuery): TagQueryResult` —— 新增標籤層 `search`（name 子字串）過濾、`sort`（`count` 預設降冪／`name`）＋ `order`、分頁包裝為 result；計數與 hidden/universe 語義不變。 |
| `internal/params.ts` | `parseQueryParams`→`parseImageQuery`、`buildQueryString`→`buildImageQuery`、`queryOptionsKeys`→`imageQueryKeys`。新增 `parseTagQuery`/`buildTagQuery` 與 `tagQueryKeys`（`sort` 預設 `count`、`order` 預設 `desc`）。 |
| `server.ts` | 型別 re-export 換名，新增 `TagQuery`/`TagSortField`/`TagQueryResult`；`queryImages(...)` 回傳型別換名；`queryTags(scopeParams?, opts?: TagQuery): TagQueryResult`；re-export `parseTagQuery` 供標籤頁 route 由 `url` 解析 tag 查詢。 |
| `client.ts` | 型別 re-export 換名；`parseQueryParams`→`parseImageQuery`、`buildQueryString`→`buildImageQuery`；新增 `parseTagQuery`/`buildTagQuery`。 |
| facet 呼叫端 `+page.server.ts`（home／editor） | `queryTags(url.searchParams)` → `queryTags(url.searchParams).items`。 |
| authoring 呼叫端 `+page.server.ts`（tagger／settings） | `queryTags(undefined, { hidden:"ignore", universe:"all" })` → 同呼叫加 `.items`。 |
| 前端 params 消費端 | `filterFields.svelte.ts`（`SortField`→`ImageSortField`、`parseQueryParams`→`parseImageQuery`、`buildQueryString`→`buildImageQuery`）；`editorFilter.svelte.ts`、`Tags.svelte`（`buildQueryString`→`buildImageQuery`）。實作時以 grep 掃盡 `buildQueryString`/`parseQueryParams`/`SortField`/`QueryOptions`/`QueryResult` 全部引用點。 |

## 驗收：標籤頁成為純組合

改動完成後，未來的標籤頁（draft 項目 5）應能在**不新增任何 database API** 的前提下實作：

```ts
// tags/+page.server.ts（示意）
const { items, total, page, pages } = database.queryTags(undefined, parseTagQuery(url.searchParams));
const previews = items.map((t) => ({
  tag: t,
  samples: database.queryImages(new URLSearchParams(), { includedTags: [t.name], sort: "random", limit: 4 }).items,
}));
```

若這段能自然成立，即證明對稱到位。
