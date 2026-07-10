# plan-db — database 模組重寫:總覽

本資料夾是 database 模組重寫的**前瞻設計規格**(方向性:含型別、class 開頭、方法簽名;**不含實作**)。
逐題的設計推導與定案見 [../plan/1_open-questions/](../plan/1_open-questions/)(Q0–Q5);本處是收斂後、依模組組織的規格。

## 心智模型

- **真相 vs 投影**:兩份以鍵定位的真相(權威)+ 只從真相單向推導、可 `rebuild` 無損重建的投影(衍生索引)。丟掉投影能單從真相重建 → 它就是投影。
- **原語 vs 動詞**:database 給 authority-free 的**儲存機制**(原語);query/mutation 用原語組合並疊上**政策**(動詞)。分界是「儲存機制 vs 政策」,不是「index vs CRUD」。
- **CQRS**:query 與 mutation **互不依賴**,都只依賴 database。

## 四個模組

| 模組 | 職責 | 執行環境 | 依賴 |
|---|---|---|---|
| `lib/database` | 引擎:真相 CRUD + 索引 + `rebuild` + 生命週期 + 序列化 | server, authority-free | — |
| `lib/query-spec` | 值物件:`ImageWhere` / `TagWhere` / `ListOptions` / `ImageQuery` / `TagQuery` | **isomorphic** | — |
| `lib/query` | 執行器:值物件 × 引擎 → 結果 | server | database, query-spec |
| `lib/mutation` | 命令 + 不變式 + 驗證 → `Result` | server | database |

```
                 query-spec (isomorphic, 前端也 import)
                    │
        ┌───────────┴────────────┐
     query ───────► database ◄─────── mutation
     (讀)          (引擎)            (寫)
```

舊的 30 函式 `server.ts` god-facade **溶解**:呼叫端直接組合 `query` / `mutation`,只從 database 取生命週期。

## 呼叫端形態

```ts
const db = database.requireLoaded();                       // 生命週期取用口(Q1)

// 讀
const result = query.images(db, ImageQuery.fromSearchParams(url.searchParams));
const facets = query.tags(db, TagQuery.facet(ImageWhere.fromSearchParams(url.searchParams)));

// 寫
const r = mutation.updateRecord(db, id, patch);
if (!r.ok) return json({ ok: false, error: r.error }, { status: errorToHttp(r.error) });
return json({ ok: true, data: r.data });
```

## 先讀:為何重寫

- [motivation.md](./motivation.md) — 舊架構速寫、它的 8 個問題、新架構如何各個擊破、以及**給實作者的 8 條收斂原則**(不帶原始討論也能理解 plan-db 為何存在)。

## 各模組規格

- [database.md](./database.md) — 引擎:真相 CRUD(對稱、完整型別)、索引、投影查詢、生命週期、序列化。
- [query-spec.md](./query-spec.md) — 值物件:class 欄位 + 純轉換方法;isomorphic 隔離理由。
- [query.md](./query.md) — 執行器:兩大引擎簽名、`QueryResult` / `Tag`、`resolveScope` 角色。
- [mutation.md](./mutation.md) — 錯誤模型(`Result` / `MutationError`)、命令型別、動詞簽名、批次歸屬。

## 尚開放

- **Q4**:`TagQuery.scope` present/absent 推導遮蔽/計數 + 具名建構子。**限制在 query + query-spec 內**,不外溢其他模組。見 query-spec.md / query.md 的「尚開放」段與 [../plan/1_open-questions/q4_scope-present-absent.md](../plan/1_open-questions/q4_scope-present-absent.md)。
- **命名 bikeshed**:`lib/query-spec` 名稱(candidates:query-spec / criteria / query-model);`database` 是否改名(語意已比今天窄)。
