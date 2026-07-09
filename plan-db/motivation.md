# plan-db — 動機:為何重寫(舊架構 → 新架構)

> 這份給「沒帶著原始討論」的未來讀者(含 AI):快速理解 plan-db 為何存在、解決了什麼,
> 遇到實作細節時能自行**收斂到對的方向**。舊架構 = 重寫前的 `src/lib/database/`。

## 1. 舊架構速寫

```
src/lib/database/
  server.ts     ← 公開入口:一個把 查詢/異動/生命週期 全包起來的 god-facade(十多個公開函式)
  client.ts     ← isomorphic 入口:buildQueryString / parseQueryParams re-export
  internal/
    store.ts    ← Database class:單例、索引、flush/load、indexAdd/Remove、rebuildIndexes
    query.ts    ← queryImages / queryTags;私有 resolveScope、materialize、tagMetaOf
    mutation.ts ← commitRecord / updateRecord / removeRecord / renameTag / deleteTag / setTagMeta / getTagMeta
    schema.ts   ← parseDBData / DEFAULT_TAG_META / pruneTagMeta  ＋  isValidTags/Rating/Name(驗證與序列化混在一起)
    params.ts   ← parseQueryParams / buildQueryString(isomorphic,卻與 server code 同資料夾)
    types.ts    ← QueryOptions(全欄位可選)、TagQueryOptions…
```

每個 route 都經 `server.ts` 呼叫;`server.ts` 的每個函式 = `requireLoaded()` + 轉呼 internal。

## 2. 舊架構的問題(逐條,皆可在舊碼指認)

| # | 問題 | 症狀 |
|---|---|---|
| 1 | **god-facade** 把業務焊進固定函式 | 加一個新需求 = 加一個新特例 API,而非「組合既有介面」;facade 只會愈長愈大 |
| 2 | **`QueryOptions` 全可選 → 預設值散落** | `parseQueryParams` 補 `?? "rating"`、`queryImages` 又補一次、`toFilterParams` 補 `?? []`/`?? "gte"` —— 多個真相來源、易漂移;逼出 `opts = {}` 反模式與重複的 `FilterParams` 正規化層 |
| 3 | **HTTP status 洩漏進領域** | `mutation` 直接 `throw Object.assign(Error, { status: 404/409 })`,route 讀 `e.status` —— database 竟知道 HTTP |
| 4 | **驗證散落且公開** | `isValidXX` 被 export,每個 route 呼叫前自行 pre-check;漏一個就破真相;`api/tags` 還借 `isValidTags` 去驗標籤名(誤用) |
| 5 | **tagMeta 的讀重複** | `query.tagMetaOf` 與 `mutation.getTagMeta` 各寫一份 `{...DEFAULT, ...raw}`;一個「讀」住在寫模組 |
| 6 | **`schema.ts` 兩種哲學混住** | 序列化(load 寬容跳過壞紀錄)與驗證(寫入嚴格)是相反哲學,卻同檔 |
| 7 | **`buildQueryString` 一函式四職** | 轉換 + 合併既有 params + 省略預設 + 格式化字串 —— 其中兩件是業務不是轉換 |
| 8 | **isomorphic 邊界靠運氣** | `params.ts`(前端也 import)與 `store.ts`(import `fs`)同在 `internal/`;今天沒把 server code 拉進前端,只因 import graph 剛好沒連上,無結構保證 |

底層根因:**database 沒把「原語」與「政策」分開**,也沒把「真相/投影」「讀/寫」「序列化/驗證」「isomorphic/server」這幾條邊界劃清,於是每種新需求都變成「往某個大函式或大型別再焊一塊」。

## 3. 新架構如何各個擊破

| 舊問題 | 解法 | 落在哪 |
|---|---|---|
| 1 god-facade | facade 溶解成**每模組一個 class**(`Query` / `Mutation` 建構時注入 db);呼叫端組合實例方法,新需求 = 組合原語,非往大 facade 焊新函式 | index / query / mutation |
| 2 預設散落 | `query-spec` 值物件**建構時一次**定預設,引擎收到保證已填滿的欄位;刪掉 `FilterParams`/`toFilterParams` | query-spec |
| 3 HTTP 洩漏 | `mutation` 回 `Result<T, MutationError>`(領域 `kind`,不帶 status);`errorToHttp` 只在 route | mutation |
| 4 驗證散落 | 驗證**內化進 mutation、私有**,無論呼叫端有無 pre-check 都驗(單一守門人) | mutation |
| 5 tagMeta 讀重複 | database 補上缺的**讀取原語**:`getTagMeta` 完整型別 hydrate(`pruneTagMeta` 的孿生);query/mutation 都向它拿 | database |
| 6 兩哲學混住 | 序列化留 database(寬容)、驗證搬 mutation(嚴格) | database / mutation |
| 7 buildQueryString | 值物件只做純轉換(`toSearchParams` 只輸出自己的 key);overlay 由呼叫端組合 | query-spec |
| 8 isomorphic 靠運氣 | `query-spec` **實體隔離**成獨立模組 → 「不能有那條 edge」從慣例變結構強制 | query-spec |

## 4. 帶來的能力(為何「未來一段時間不用再重構」)

新需求都落在**既有 seam 上加一塊**,不動架構:

- 新查詢 = 在 `query` 組現有原語。
- 新異動 = 在 `mutation` 加一個命令 + 不變式。
- 新可篩欄位 = `ImageWhere` 加欄位 + database 加一個索引原語。
- 新標籤屬性(顏色/別名…)= `TagMeta` 加欄位,走同一條 hydrate/prune 路。
- CQRS:讀寫互不依賴、各吃 `db` 參數 → 可注入假 db 測試。

換句話說:**「下次要碰」從「重新分層」降級成「加一個 verb / 一個 index / 一個 TagMeta 欄位」。**

## 5. 給未來實作者的收斂原則(遇到細節時的指南針)

不確定某段程式該擺哪、該長怎樣時,回到這幾條:

1. **真相 vs 投影**:丟掉後能單從真相重建 → 它是投影,永不設為權威。投影只從 `images` 推導、可 `rebuild`。
2. **原語 vs 動詞(那條線是「儲存機制 vs 政策」,不是 index vs CRUD)**:
   - database = authority-free 儲存機制:**完整型別的真相 CRUD**、索引原子、投影查詢、`rebuild`、序列化、生命週期。
   - query / mutation = 用原語組合 + 疊政策(scope 解析、排序分頁 / 不變式、驗證)。
3. **真相 CRUD 一律完整型別 + 覆寫**;合併(patch)是動詞的事(`get` 完整基底 → 覆蓋 → `set`)。**永不把 partial / 稀疏 洩漏給呼叫端**(稀疏是 database 內部實作;`get` 缺席鍵回 hydrate 後的完整值)。
4. **錯誤**:預期失敗 → `Result` 帶領域 `kind`(不帶 HTTP);非預期(bug)→ throw 到框架邊界;**HTTP 映射只在 route**;not-load 只在 route 守衛。
5. **驗證住 mutation、私有、必跑**;序列化住 database、寬容。兩者哲學相反,不同家。
6. **批次一律呼叫端逐筆**(前端 `batchRun` / 匯入路由 SSE 迴圈),引擎只認單筆、只回單筆 `Result`。
7. **isomorphic 值物件(query-spec)絕不 import server code**;**query 與 mutation 絕不互相 import**(CQRS)。
8. **hidden 遮蔽**:image 側一律遮蔽(否則洩漏隱藏圖);tag 側由 `TagQuery.scope` 有無決定。
9. **模組對外只一個 class**(`Database` / `Query` / `Mutation`;query-spec 因是多值物件而豁免):`Query` / `Mutation` 實例持有 db;`Database` 以**靜態成員**扛單例生命週期(單一私有 `filePath`,無 getter)。內部按職責切扁平檔(無 `/internal`)、各自物件封裝;**禁止 grab-bag 匯出**(反例:舊 `schema.ts` 為了給別人 export 一堆局部東西 → 邊界糊掉)。內部檔只露 owner 真正需要的最小面。

> 這八條若與某個實作直覺衝突,**以這八條為準**;它們是本次重寫的不變式,細節都應收斂回它們。

各模組規格見同資料夾 [index.md](./index.md) 及 database / query-spec / query / mutation 四份;逐題推導見 [../plan/1_open-questions/](../plan/1_open-questions/)。
