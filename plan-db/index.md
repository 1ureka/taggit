# plan-db — database 模組重寫:總覽

本資料夾是 database 模組重寫的**前瞻設計規格**(方向性:含型別、class 開頭、方法簽名;**不含實作**)。
逐題的設計推導與定案見 [../plan/1_open-questions/](../plan/1_open-questions/)(Q0–Q5);本處是收斂後、依模組組織的規格。

## 心智模型

- **真相 vs 投影**:兩份以鍵定位的真相(權威)+ 只從真相單向推導、可 `rebuild` 無損重建的投影(衍生索引)。丟掉投影能單從真相重建 → 它就是投影。
- **原語 vs 動詞**:database 給 authority-free 的**儲存機制**(原語);query/mutation 用原語組合並疊上**政策**(動詞)。分界是「儲存機制 vs 政策」,不是「index vs CRUD」。
- **CQRS**:query 與 mutation **互不依賴**,都只依賴 database。

## 四個模組

| 模組 | 對外 class | 職責 | 執行環境 | 依賴 |
|---|---|---|---|---|
| `lib/database` | `Database` | 引擎:真相 CRUD + 索引 + `rebuild` + 生命週期(靜態) + 序列化 | server, authority-free | — |
| `lib/query-spec` | *(多值物件,豁免)* | 值物件:`ImageWhere` / `TagWhere` / `ListOptions` / `ImageQuery` / `TagQuery` | **isomorphic** | — |
| `lib/query` | `Query` | 執行器:值物件 × 引擎 → 結果 | server | database, query-spec |
| `lib/mutation` | `Mutation` | 命令 + 不變式 + 驗證 → `Result` | server | database |

```
                 query-spec (isomorphic, 前端也 import)
                    │
        ┌───────────┴────────────┐
     Query ───────► Database ◄─────── Mutation
     (讀)          (引擎)            (寫)
```

舊的 30 函式 `server.ts` god-facade **溶解**:呼叫端直接組合 `Query` / `Mutation` 實例,只從 `Database` 取生命週期。

## 模組內部結構慣例(本次重寫的硬規則)

god-facade 溶解**不是**換成一堆 `import * as query` 後裸呼 `images()` / `tags()`(那樣「誰在做什麼」看不出來)。改為:

1. **對外只一個 class**:`database`→`Database`、`query`→`Query`、`mutation`→`Mutation`,各自 `index.ts` 只匯出那一個 class(型別 re-export 除外)。「多少東西被匯出、依賴關係如何」一眼可追蹤。
   - **例外:query-spec**。它天生是多個值物件 class,每個都自我描述(`ImageQuery.fromSearchParams`),不是模糊的 free function → 豁免,維持多值物件匯出。
2. **`Query` / `Mutation` 實例持有 db**(建構時注入,Q1):`new Query(db)` / `new Mutation(db)`;方法只吃查詢值物件 / 命令。仍是 authority-free(可注入假 db 測試),但語意口收斂成建構子。
3. **扁平檔案、無 `/internal`**:每個模組是一疊平鋪檔案,慣例上只從該模組 `index.ts` 取用;子檔不對模組外匯出東西。
4. **內部也物件封裝,按「專心做一件事」切子模組**:大模組內部依職責切檔並各自封裝(如 `query` 內部 `ImageEngine` / `TagEngine` + 共用 `ScopeResolver`;`mutation` 內部 image / tag 兩組命令 + 私有 `Validator`)。
5. **可有非 class 的內部檔**:共用 `types.ts`、純函式 util(`parse.ts` / `pagination.ts`)不必是 class;其餘盡量物件封裝。
6. **禁止 grab-bag 匯出**(反例:舊 `schema.ts` —— 為了給別人而 export 一堆其實是局部的東西,看不出邊界):內部檔只 export「它的 owner 真正需要」的最小面,能私有就私有。

## 呼叫端形態

```ts
Database.ensureLoaded(dbPath);                             // hooks:每個 request 前(靜態)
if (!Database.isLoaded()) return json({ ok: false }, { status: 503 });  // route 頂端守衛
const db = Database.requireLoaded();                       // 生命週期取用口(Q1,靜態)

const query = new Query(db);                               // 實例持有 db
const mutation = new Mutation(db);

// 讀
const result = query.images(ImageQuery.fromSearchParams(url.searchParams));
const facets = query.tags(TagQuery.facet(ImageWhere.fromSearchParams(url.searchParams)));

// 寫
const r = mutation.updateRecord(id, patch);
if (!r.ok) return json({ ok: false, error: r.error }, { status: errorToHttp(r.error) });
return json({ ok: true, data: r.data });
```

## 先讀:為何重寫

- [motivation.md](./motivation.md) — 舊架構速寫、它的 8 個問題、新架構如何各個擊破、以及**給實作者的 8 條收斂原則**(不帶原始討論也能理解 plan-db 為何存在)。

## 各模組規格

- [database.md](./database.md) — `Database` class:靜態生命週期、真相 CRUD(對稱、完整型別)、索引、投影查詢、序列化;內部檔案結構。
- [query-spec.md](./query-spec.md) — 值物件(豁免):class 欄位 + 純轉換方法;isomorphic 隔離理由;扁平檔案結構。
- [query.md](./query.md) — `Query` class(持有 db):`ImageEngine` / `TagEngine` 內部切分、`QueryResult<T>` / `Tag`、`ScopeResolver` 角色。
- [mutation.md](./mutation.md) — `Mutation` class(持有 db):錯誤模型(`Result` / `MutationError`)、命令型別、動詞、私有 `Validator`、批次歸屬。

## 尚開放

- **Q4**:`TagQuery.scope` present/absent 推導遮蔽/計數 + 具名建構子。**限制在 query + query-spec 內**,不外溢其他模組。見 query-spec.md / query.md 的「尚開放」段與 [../plan/1_open-questions/q4_scope-present-absent.md](../plan/1_open-questions/q4_scope-present-absent.md)。
- **命名 bikeshed**:`lib/query-spec` 名稱(candidates:query-spec / criteria / query-model);`database` 是否改名(語意已比今天窄)。
