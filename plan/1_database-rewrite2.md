# database 模組重寫方向

> 本檔是設計方向筆記。停在「介面/分層」層級,不含實作細節。
> 目標:讓大部分業務都能由「組合公開介面」實現;呼叫端大改可接受,只要需求最終能被組出來。

## 1. 核心心智模型

### 真相 vs 投影(authority-free 引擎)
- **真相(write model / 權威)**:兩份以鍵定位的紀錄集合。
  - `images`:以 id 為鍵。
  - `tagMeta`:以 name 為鍵(`hidden` 只是它的一個欄位,未來可加顏色/別名等,走同一條路)。
- **投影(read model / 衍生)**:序號宇宙 + 位元圖(tag→bitset、rating→bitset)。
  - **只從 `images` 單向推導、可 `rebuild` 無損重建、永不是權威**。
  - 判斷「是不是投影」的試金石:丟掉後能否單從真相重建? 能 → 它就是投影。
- 「寫入時要更新索引」**不違反**這個分法——那正是 materialized view 的增量維護(如同 DB 對 B-tree index 的維護)。分的是**模型的形狀與權威**,不是「寫入碰不碰衍生結構」。引擎要的是 **authority-free**(不持有真相),不是 write-free。

### Scope 是組合的貨幣
幾乎所有業務都是 **`WHERE → Scope → 動詞`**:
- Scope = 一組 WHERE 條件,經投影解析成的圖片集合(即現在私有的 `resolveScope`)。
- 動詞 = 物化圖片、計數標籤、投影成標籤列表、定位鄰居、隨機抽樣、批次寫入……
- 「大部分應用靠組合實現」= WHERE/值物件造出 Scope,其餘全是作用在 Scope 上的動詞。

## 2. 模組分法(四塊,取代單一 `/internal` + 雙入口 facade)

| 模組 | 職責 | 執行環境 |
|---|---|---|
| `lib/database` | 原語(索引 + 真相紀錄存取)+ `rebuild` + 生命週期(load/flush)+ 序列化 | server, authority-free, **小** |
| `lib/query-spec` | 純值物件:`ImageWhere` / `TagWhere` / `ListOptions` / `ImageQuery` / `TagQuery`(純轉換:`fromSearchParams` / `toSearchParams` / `with`;預設值內建) | **isomorphic**(前端也 import) |
| `lib/query` | 執行器:值物件 × database 引擎 → 結果(`resolveScope`、materialize、計數、排序、分頁) | server |
| `lib/mutation` | 純型別命令 + 厚重不變式(含輸入驗證)+ 回傳領域 Result | server, 只認 id |

- `query` 與 `mutation` **互不依賴**,都只依賴 `database`。這是 CQRS 落到模組層級。
- 舊的 30 函式 `server.ts` god-facade **溶解**:呼叫端直接組合 `query` / `mutation`。
- `database` 只給**策劃過的原語**(如 `indexAdd/indexRemove`、`tagBits`、`live`、`getRecord/setRecord`),`resolveScope` 在 `query` 用原語組出、索引維護在 `mutation` 用原語組出——**database 不持有這兩個高階動作,故保持小**。類比:Postgres 的 access method 提供原語,planner(讀)與 executor(寫)各自組合。

## 3. 值物件層(`lib/query-spec`)——唯一前端也會碰的一層

```ts
// 共用述詞:界定「哪些圖片」
class ImageWhere {
  search: string;
  includedTags: string[];   // AND
  excludedTags: string[];   // NOT
  rating?: number;
  ratingOp: "gte" | "lte" | "eq";
}

// 泛型 List:排序 + 分頁(讓 Tag 也能分頁排序)
class ListOptions<S extends string> {
  sort: S;
  order: "asc" | "desc";
  page: number;
  limit: number;   // 0 = 不分頁
}

type ImageSort = "committedAt" | "rating" | "name" | "random"; // random 忽略 order
type TagSort   = "name" | "count";

// A. 圖片查詢
class ImageQuery {
  where: ImageWhere;
  list: ListOptions<ImageSort>;
  // 業務:某條件下,這一頁的圖片紀錄
}

// B. 標籤查詢(與 A 對稱)
class TagQuery {
  scope?: ImageWhere;              // 選填。帶入=facet(count 在此 scope + hidden 遮蔽後計算);
                                   //       不帶=獨立列表(count = 該標籤的原始總使用數)
  where: TagWhere;                 // 標籤自己的篩選(正交於 count)
  list: ListOptions<TagSort>;
  // 業務:標籤與計數;要不要遮蔽由 scope 有無推導,無獨立的計數模式欄位
}

// 標籤自己的述詞(主要為未來「標籤為主」的頁面預留)
class TagWhere {
  name?: string;                   // 對標籤名稱的述詞(中性命名,不暗指搜尋/前綴/精確等用途)
  hidden?: boolean;                // 篩選:只列 hidden / 只列非 hidden(一開始就排除,與 count 無關)
  universe: "used" | "all";        // 是否併入「只有 metadata、未被使用」的標籤(count 0)
}
```

**遮蔽/計數 = 由 `scope` 有無推導,不設獨立欄位(取代原本設想的 `hiddenCount`):**
- **帶 `scope` → facet 讀取**:count 在「該 scope 篩選 + hidden 遮蔽後」的圖片集內計算;hidden 且不在 `includedTags` 的標籤取「解鎖 N 張」投影數。
  - **判準是 present vs absent,不是 empty vs non-empty**:全新圖庫的側欄仍帶一個**空的 `ImageWhere`** → 算 facet → 仍遮蔽。帶空物件 ≠ 不帶。
- **不帶 `scope` → 獨立列表**:count = 該標籤的**原始總使用數**(不管圖片是否被隱藏),因為它不是 facet、沒必要跟任何圖片列表一致。
- 理由:count 語意與「要不要遮蔽」是**同一個軸**(「遮蔽圖片 × 原始 count」「不遮蔽 × 遮蔽 count」都是荒謬組合),而「要不要遮蔽」=「這讀取是不是 facet」= `scope` 有沒有帶入。故不需要獨立的計數模式欄位。
- **`TagWhere.hidden` 與此正交**:它只決定「哪些標籤出現在列表裡」(一開始就篩掉/保留),不影響任一標籤的 count 怎麼算。

**其他約定:**
- `ImageQuery.where` 與 `TagQuery.scope` 都是 `ImageWhere`——**faceted 頁 = 用同一個 `ImageWhere` 各建一個 ImageQuery 與 TagQuery,分別執行**(兩引擎不互傳結果)。
- hidden **遮蔽**的不對稱:image 側瀏覽**一律遮蔽**(由 `includedTags` 隱式驅動,因為不遮蔽會直接洩漏隱藏圖片);tag 側則**可遮蔽可不遮蔽**(原始標籤計數只是數字、不洩漏圖片,管理情境正當需要真實使用數),由 `TagQuery.scope` 有無決定。image 的「不遮蔽」只出現在維護動詞(全量 dump,連篩選都不套)。
- 值物件只做**純轉換 + 組合原語**,不內建業務:`fromSearchParams`(填預設)、`toSearchParams`(只輸出自己的 key、預設值省略以利 round-trip)、`with(patch)`(不可變覆寫,取代舊的 `{...opts, ...overrides}`,如 compare 塞 `sort:"random"`)。
- **不重蹈舊 `buildQueryString` 覆轍**:它一個函式塞了「轉換 + 合併既有 params + 省略預設 + 格式化字串」四件事,(2)(4) 是業務不是轉換。新設計裡「改一個 facet、保留 URL 其餘參數、產出可 goto 的字串」由呼叫端組合。唯一需值物件封裝的是「它自己的 key 集」(合併時要先清掉舊 key,否則落回預設被省略的欄位會殘留舊值);這個 overlay 點是純轉換、非業務,實作時再定放呼叫端或值物件。
- 兩個查詢的 result 對稱:`{ items, total, page, pages }`。

**為何用 class 值物件(取代舊的「全可選型別 + 到處補空」)——不只是風格,是消重複與封裝:**
- **消除重複的預設值填補**:舊 `QueryOptions` 全欄位可選,預設值散在 `params.ts`(parse 時 `sort ?? "rating"`)與 `query.ts`(`queryImages` 的 `?? "rating"`、`toFilterParams` 的 `?? []` / `?? "gte"`)多處 —— 多個真相來源、易漂移。值物件在**建構時一次**確立預設,引擎收到的是**保證已填滿**的欄位,engine 內不再有任何 `??` 補空。
- **`FilterParams` / `toFilterParams` 整個消失**:舊碼因 options 可選,引擎內部還得再正規化出一份非可選的 `FilterParams`。`ImageWhere` 本身就是那個正規化形態,這層重複直接刪。
- **除掉 `opts: QueryOptions = {}` 反模式**:型別無法攜帶「一個合法的預設實例」,才被迫用 `= {}`;class 可以(建構子 / 靜態預設),參數語意變乾淨。
- **更好的封裝**:驗證/正規化/預設與資料同住,不再抹在引擎各處。

## 4. `lib/database` 的邊界

- **原語**:真相紀錄 get/set/delete(images by id、tagMeta by name);索引 `indexAdd/indexRemove`、`tagBits`、`ratingRange`、`live`、`ordinalOf/idOf`。
- **一致性**:`rebuild()` —— 「索引純由紀錄推導」這個契約本身。
- **生命週期**:`load`(讀檔 → parse → rebuild,是一個不可分割的操作)、`flush`(debounce + atomic write)。
- **序列化**:`load` 的 parse 那半(v1/v2 相容、壞紀錄寬容跳過)是持久化的反序列化,與 `flush` 成對,住在 database 內部。
- **`schema.ts` 溶解**:原本混了兩件事——
  - 序列化/正規形狀(`parseDBData`、`emptyDBData`、`DB_VERSION`、`pruneTagMeta`、`DEFAULT_TAG_META`)→ 留在 database(檔名可續用 `schema.ts`,但只代表「儲存格式」)。
  - 驗證(`isValidXX`)→ 搬到 `mutation`(見下)。
- 注意 **load 是寬容的**(保住既有資料),與寫入的**嚴格**驗證是兩種相反哲學,故分屬兩地。

## 5. `lib/mutation` 的邊界

- **輸入**:純型別命令(interface),各自獨立、不組合、不 parse URL。型別會在編譯期抹除,跨前後端天然安全,故**不需要**獨立的 args 模組。
- **不變式(厚重)**:輸入驗證(原 `isValidXX`,改為**內部、不公開**)、tags trim+sort、pruneTagMeta、掉最後一個標籤 → 衝突、樂觀併發(`expectedUpdatedAt`)、寫後靠 `rebuild` 收斂。
- **驗證住在 mutation、不公開**:mutation 是真相的守門人,**無論呼叫端有沒有先檢查都必須驗證**;公開 validator 讓路由 pre-check 會漂移、會被漏呼叫。
- **失敗傳遞 = 領域 Result**:
  - 預期失敗 → 回傳 `{ success: false, reason, details }`,`reason` 是**領域列舉**(`VALIDATION_ERROR` / `CONFLICT` / `NOT_FOUND`),**不帶 HTTP status**(拔掉最後一個 HTTP 邊界洩漏,由路由把 reason 映射到 HTTP)。
  - 非預期 / 前置條件錯誤(尚未 load、I/O、bug)→ **仍 throw**。不要什麼都包成 Result。
  - 對稱:**讀取幾乎無預期失敗**(找不到回 null / 空),**寫入才有**(用 Result)。

## 6. 為何邊界這樣切(isomorphic 的硬理由)

- `query-spec` 的值物件是 **class(有 runtime code:`fromSearchParams`/`toSearchParams`/`with` 等純轉換)**,且必須 isomorphic(前端組來導航、後端組來查詢)。
- 帶 runtime code 的 class 若與「會 import database 的 server 執行器」放同一資料夾,前端 import 時易透過相依鏈把 server code 一起拉進去 → SvelteKit build 失敗。**故值物件需實體隔離成獨立模組。**
- `mutation` 的 args 是**純型別**,編譯期抹除、無 runtime code 可洩漏 → 跨邊界永遠安全 → 直接住 `lib/mutation` 即可。
- 「class vs 型別」與「要不要獨立模組」是**同一個根**:runtime code vs 會被抹除的型別,誰能安全穿過前後端邊界。

## 7. 業務清單(用來驗證組合面)

確定要 / 可能要(以此檢查介面能不能組出來):
1. **Faceted 瀏覽**:同一 `ImageWhere` → ImageQuery + TagQuery(masonry + 側欄標籤)。
2. 單張詳情:by id。
3. 鄰居導航:Scope(有序)→ 定位 id → ±1(fullscreen 翻頁)。← 需要 Scope「有序」
4. 隨機取樣:Scope → 抽樣 n(compare)。
5. 標籤列表:TagQuery 分頁 + 依 name/count 排序(標籤中心頁)。
6. 標籤 autocomplete:實際在前端即時篩選(limit 0 + scope 全拿),**非**後端 TagWhere 查詢;`TagWhere` 主要為 #5「標籤為主」頁面預留。
7. 統計摘要:總數、各評分直方圖、標籤數(導航徽章)。
8. 維護掃描:全部圖片(不遮蔽),補元資料。
9. 提交/匯入(可能批次)。
10. 更新單張(樂觀併發)。
11. 刪除單張的對應紀錄。
12. **批次編輯**:`query 解析 scope → id 集合 → 餵給吃 id[] 的批次 mutation`。← 讓 mutation 只認 id、WHERE 安心留在 query
13. 標籤管理:全域改名 / 刪除 / 設定對應標籤名稱的 metadata 紀錄。

## 8. 待定 / 開放問題

- `lib/query-spec` 名稱待定(candidates:`query-spec` / `criteria` / `query-model`);「該獨立」的理由是硬的,名稱是 bikeshed。
- Scope 是否需要「有序」由 #3 鄰居導航是否要做決定;#12 批次編輯確認採「query→id→mutation」組合。
- 「帶 scope → 遮蔽」假設沒有「帶 scope 卻要原始 count」的情境(目前不存在)。未來標籤主角頁若需要「某範圍內、但含隱藏圖的真實計數」,再引入顯式 flag;在那之前不先燒這個軸(YAGNI)。
- `database` 的名稱:現在它只是引擎/儲存,語意比今天窄,是否改名待定。
