# Q1 — god-facade 溶解後,singleton 住哪?(已定案)

## 決定

**`lib/database` 持有 singleton,呼叫端經一個 accessor 取得。**

- 單例仍在(`globalThis.__db`,為了扛 HMR),但它的擁有權明確落在 `lib/database`。
- `lib/database` 對外露出**生命週期 + 一個取用口**:`ensureLoaded(path)`、`isLoaded()`、`flush()`、以及 **`requireLoaded(): Database`**。
- `query` / `mutation` **不碰單例**,只認傳進來的 `db`(維持 authority-free、可注入假 db 測試)。由呼叫端把 accessor 與 query/mutation 接起來:

```ts
const db = database.requireLoaded();   // 拿到「當前已載入的 collection」
query.images(db, imageQuery);
mutation.commit(db, cmd);
```

## 為什麼需要這個 accessor

`query` / `mutation` 的簽章第一參數就是 `db`(`query.images(db, spec)`、`mutation.commit(db, cmd)`)。
今天這個 `db` 被 facade 藏起來(每個業務函式第一行都 `requireLoaded()`),呼叫端從不碰實例。
facade 溶解後,取得 `db` 這件事必須有個明確的家 —— 就是 `database.requireLoaded()`。

## 從舊 facade 搬出來的東西

今天集中在 [`database/server.ts`](../../src/lib/database/server.ts) 的這幾樣,原封搬進 `lib/database` 的公開面:

| 項目 | 角色 |
|---|---|
| `globalThis.__db` + `getDB()` | 單例 + HMR 保護(內部) |
| `requireLoaded(): Database` | 取用口:回傳已載入實例,未載入時報錯(錯誤形狀見 [Q2](./q2_not-loaded-error.md)) |
| `ensureLoaded(path)` | 生命週期:hooks 每個 request 前呼叫 |
| `isLoaded()` | 生命週期:狀態查詢 |
| `flush()` | 生命週期:hooks 關閉訊號 / 備份前呼叫 |

這些**純生命週期**函式跟查詢/異動無關,`lib/database` 繼續對 hooks / settings 直接露出,不受 CQRS 拆分影響。

### 一併收掉:`currentDbPath` 降為私有 `filePath`

舊 facade 有一個公開的 `currentDbPath()` —— 查過**外部零呼叫端**,唯一的讀取都在模組內(`flush` 的寫入目標、`ensureLoaded` 的「reload-or-noop」比對)。「當前 collection 的硬碟路徑」本就是 `collection` 模組的職責(`getActiveRoot()` / `getCollectionPaths()`),外部要問路徑該問 collection,不是 database。

因此:
- 移除公開的 `currentDbPath()`。
- store 實例上的欄位由 `currentDbPath` **改名為 `filePath`** 並降為**私有內部欄位**(此 store 綁定的 db.json 絕對路徑 —— flush 寫入目標、load 來源)。`current` 是多餘的(一個實例只綁一條),`Db` 也多餘(class 本就是 Database)。

## 呼叫端變化

facade 的 30 個業務函式**不再存在**;呼叫端改成「取 db → 組 query/mutation」。以 home 頁為例:

```ts
// 舊
const result = database.queryImages(url.searchParams);
const facets = database.queryTags(url.searchParams);

// 新
const db = database.requireLoaded();
const result = query.images(db, ImageQuery.fromSearchParams(url.searchParams));
const facets = query.tags(db, TagQuery.facet(ImageWhere.fromSearchParams(url.searchParams)));
```

每個 call site 多一行 `const db = database.requireLoaded()` 與對應 import —— 這是預期內、機械式、語意誠實(這個 request 需要一個已載入的庫)的呼叫端改動。

## 你的回答

已定案(見上)。
