# Q1 — god-facade 溶解後,singleton 住哪?

> 這是全案最大的留白。其餘四題都可以在實作中微調,這一題不先定會讓遷移做到一半卡住。

## 一句話問題

`server.ts` 的 30 函式 facade 溶解、呼叫端改成直接組合 `query` / `mutation` 之後,
那個「已載入的 Database 實例」由誰持有、呼叫端從哪裡拿到它?

## 現況(今天怎麼運作)

單例與生命週期全部集中在 [`database/server.ts`](../../src/lib/database/server.ts):

```ts
declare global {
  var __db: Database | undefined;   // HMR 保護:熱重載間重用實例
}

function getDB(): Database {          // 首次存取時建立
  if (!globalThis.__db) globalThis.__db = new Database();
  return globalThis.__db;
}

function requireLoaded(): Database {  // 取得已載入實例,否則 throw 503
  const db = getDB();
  if (!db.isLoaded()) throw Object.assign(new Error("尚未載入資料庫"), { status: 503 });
  return db;
}

// 對外的生命週期 API
export function ensureLoaded(dbPath: string): void { ... }  // hooks 在每個 request 前呼叫
export function isLoaded(): boolean { ... }
export function currentDbPath(): string | null { ... }
export function flush(): void { ... }                       // hooks 的關閉訊號 / 備份前呼叫
```

**關鍵觀察**:每一個業務函式(`queryImages`、`commitImage`…)第一行都是 `requireLoaded()`,
把「拿到已載入的 db」這件事**藏在 facade 裡**,呼叫端從來不碰 `db` 實例。

現在的呼叫端因此非常乾淨:

```ts
// src/routes/(home)/+page.server.ts
const result = database.queryImages(url.searchParams);
const facets = database.queryTags(url.searchParams);
```

## 溶解後會發生什麼

`query` / `mutation` 的函式簽章是 `queryImages(db, spec)`、`commitRecord(db, id, ...)` ——
**第一參數就是 `db`**。facade 一旦拿掉,那個 `db` 就得由呼叫端自己先取得:

```ts
// 溶解後,home 頁大概會變成:
const db = /* ??? 從哪裡拿 ??? */;
const result = query.queryImages(db, ImageQuery.fromSearchParams(url.searchParams));
const facets = query.queryTags(db, TagQuery.fromSearchParams(url.searchParams));
```

那個 `???` 就是這一題。它牽涉三件今天被 facade 藏起來的事:
1. **單例**(`getDB` + `globalThis.__db` 的 HMR 保護)
2. **已載入守衛**(`requireLoaded`,牽涉 Q2)
3. **生命週期 API**(`ensureLoaded` / `isLoaded` / `flush` —— 這些是 hooks 與 settings 在用,跟查詢/異動無關)

## 選項

### 選項 A(建議):`lib/database` 的公開面提供 `requireLoaded()`,呼叫端從它拿 db

`lib/database` 除了原語,還對外露出「單例 + 守衛 + 生命週期」這一小組東西。
query / mutation **不碰單例**(它們只認傳進來的 db,維持純粹好測試);由呼叫端把兩者接起來。

```ts
// lib/database 的公開面(index.ts 或 lifecycle.ts)
export function requireLoaded(): DatabaseEngine   // 單例 + 已載入守衛
export function ensureLoaded(dbPath: string): void
export function isLoaded(): boolean
export function flush(): void

// home 頁
import { requireLoaded } from "$lib/database";
import * as query from "$lib/query";
const db = requireLoaded();
const result = query.queryImages(db, ImageQuery.fromSearchParams(url.searchParams));
const facets = query.queryTags(db, TagQuery.fromSearchParams(url.searchParams));
```

- 優點:query/mutation 保持 authority-free、無單例耦合、可注入假 db 測試;單例只有一個家。
- 代價:每個 call site 多一行 `const db = requireLoaded()` 與一個 import。這正是你接受的「呼叫端大改」。

### 選項 B:保留一層「極薄」facade,只做 requireLoaded + 轉呼

facade 不死,但只剩「拿 db → 轉呼 query/mutation」這層,不再有 30 個業務函式的組合邏輯。

```ts
export function queryImages(spec: ImageQuery) { return query.queryImages(requireLoaded(), spec); }
```

- 優點:呼叫端幾乎不用改(還是 `database.queryImages(spec)`)。
- 代價:**跟計畫的精神衝突** —— 「god-facade 溶解、呼叫端直接組合」這條就沒做到,facade 會慢慢又長回 30 個函式。等於沒重構。

### 選項 C:query/mutation 內部自己呼叫 requireLoaded(不傳 db)

```ts
export function queryImages(spec: ImageQuery) { const db = requireLoaded(); ... }
```

- 優點:呼叫端最乾淨。
- 代價:query/mutation **反向依賴 database 的單例**,失去「吃 db 參數」的可測試性(今天特地設計成吃 db 就是為了測試),CQRS 兩塊也被單例綁死。不建議。

## 我的建議

**選項 A。** 它是唯一同時滿足「god-facade 真的溶解」+「query/mutation 保持 authority-free 可測試」的解。
多出來的 `const db = requireLoaded()` 是一次性、機械式的呼叫端改動,而且語意誠實(這個 request 需要一個已載入的庫)。
`ensureLoaded` / `flush` 這些**純生命週期**函式繼續由 `lib/database` 對 hooks / settings 露出,跟查詢異動無關,不受影響。

## 你的回答

<!-- 在這裡寫下你的決定與理由 -->
