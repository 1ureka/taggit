# lib/query-spec — 值物件(isomorphic)

唯一前端也會 import 的一層。**純轉換 + 組合原語,不含業務**:預設值建構時內建、`fromSearchParams` / `toSearchParams` / `with`。

**為何獨立模組**:值物件是 class(帶 runtime code),且 isomorphic(前端組來導航、後端組來查詢)。
若與「會 import database 的 server 執行器」同資料夾,前端 import 易經相依鏈把 server code 拉進去 → SvelteKit build 失敗。
故需**實體隔離**成獨立模組,把「不能有那條 edge」從慣例升級成結構強制。

## 共用述詞

```ts
class ImageWhere {
  search: string;
  includedTags: string[];   // AND
  excludedTags: string[];   // NOT
  rating?: number;
  ratingOp: "gte" | "lte" | "eq";
}

class ListOptions<S extends string> {
  sort: S;
  order: "asc" | "desc";
  page: number;
  limit: number;            // 0 = 不分頁
}

type ImageSort = "committedAt" | "rating" | "name" | "random";  // random 忽略 order
type TagSort   = "name" | "count";
```

## 查詢值物件

```ts
class ImageQuery {
  where: ImageWhere;
  list: ListOptions<ImageSort>;
}

class TagWhere {
  name?: string;                    // 對標籤名的述詞(中性命名)
  hidden?: boolean;                 // 篩選:只列 hidden / 非 hidden(與 count 正交)
  universe: "used" | "all";         // 是否併入「只有 metadata、未使用」的標籤(count 0)
}

class TagQuery {
  scope?: ImageWhere;               // present=facet / absent=獨立列表 —— 見「尚開放(Q4)」
  where: TagWhere;
  list: ListOptions<TagSort>;
}
```

- `ImageQuery.where` 與 `TagQuery.scope` 都是 `ImageWhere`:faceted 頁 = 同一個 `ImageWhere` 各建一個 ImageQuery 與 TagQuery,分別執行(兩引擎不互傳結果)。
- `TagWhere` / 標籤分頁排序主要為未來「標籤為主」頁面預留;**先建對稱的形狀,述詞/分頁機器可延後**。

## 每個值物件的方法(純轉換)

```ts
static fromSearchParams(params: URLSearchParams): Self;  // 填預設 → 保證欄位已填滿
toSearchParams(): URLSearchParams;                       // 只輸出自己的 key,預設省略(利 round-trip)
with(patch: Partial<Fields>): Self;                      // 不可變覆寫(取代舊 {...opts, ...overrides})
```

- **建構時一次確立預設**,引擎收到保證已填滿的欄位;engine 內不再有任何 `??` 補空(消除舊碼散落多處的預設值填補、`FilterParams`/`toFilterParams` 那層重複)。
- **overlay**(改一個 facet、保留 URL 其餘參數、產出可 goto 的字串)由**呼叫端組合**;值物件只封裝「自己的 key 集」(合併時先清舊 key,免得落回預設被省略的欄位殘留舊值)。不重蹈舊 `buildQueryString` 一函式塞四件事的覆轍。

## 尚開放(Q4,限 query + query-spec)

`TagQuery` 的 **present vs absent**(帶 scope=facet+遮蔽 / 不帶=獨立列表+原始 count)是正確性關鍵:

- **傾向具名建構子**:`TagQuery.facet(where: ImageWhere)` / `TagQuery.standalone()`,讓語意軸變成呼叫端**顯式動詞**,`scope` 是否 `undefined` 變內部細節。
- **`fromSearchParams` 契約**:一律產出 **present**(存在的、可能為空的)`scope` → 凡從 URL 來的側欄一律遮蔽(全新空庫的空 `ImageWhere` 仍算 facet)。
- 判準是 **present vs absent,不是 empty vs non-empty**。詳見 [../plan/1_open-questions/q4_scope-present-absent.md](../plan/1_open-questions/q4_scope-present-absent.md)。
