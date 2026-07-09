# Q2 — 「尚未載入」的錯誤該長什麼樣?

> 這題是 Q1 的延伸,也是 §5「領域錯誤不帶 HTTP status」的最後一塊拼圖。

## 一句話問題

`requireLoaded()` 在資料庫還沒載入時要 throw。但 §5 說「拔掉最後一個 HTTP status 洩漏」——
那這個 throw 該不該繼續帶 `status: 503`?如果不帶,route 怎麼知道要回 503?

## 現況

[`server.ts`](../../src/lib/database/server.ts) 的守衛直接把 HTTP status 焊在錯誤上:

```ts
function requireLoaded(): Database {
  const db = getDB();
  if (!db.isLoaded()) throw Object.assign(new Error("尚未載入資料庫"), { status: 503 });
  return db;
}
```

route / hooks 端靠讀這個 `status` 決定回應碼。這就是計畫 §5 說的
「HTTP 邊界洩漏」—— database 這層不該知道 HTTP 是什麼。

## 計畫怎麼分類錯誤(§5)

計畫把失敗分成兩類,哲學相反:

| 類型 | 例子 | 傳遞方式 |
|---|---|---|
| **預期失敗**(領域內) | 驗證失敗、樂觀併發衝突、找不到 | 回傳 `{ success: false, reason }`,reason 是領域列舉,**不帶 status** |
| **非預期 / 前置條件錯誤** | **尚未 load**、I/O 失敗、bug | **仍然 throw**(不包成 Result) |

「尚未 load」明確被歸在**第二類 → throw**。所以問題不是「throw 還是 Result」(已定 throw),
而是 **throw 出來的東西帶不帶 `status: 503`**。

## 為什麼這需要一個決定

「尚未 load」很特別:它是**前置條件錯誤**(該 throw),但它**對應一個非常明確的 HTTP 語意**(503 Service Unavailable)。
其他前置條件錯誤(I/O、bug)對應的是 500,而且是「不該發生」的。503 卻是「正常的、預期使用者會遇到的暫時狀態」(還沒設定 collection root)。

所以它卡在中間:形狀上是 throw,語意上又像個該被乾淨映射的預期回應。決定它 = 決定「throw 出來的錯誤要不要攜帶足夠資訊讓 route 映射」。

## 選項

### 選項 A(建議):throw 一個具名的領域錯誤類別,不帶 HTTP status;由 hook / route 映射

```ts
// lib/database
export class DatabaseNotLoadedError extends Error {}

function requireLoaded(): DatabaseEngine {
  const db = getDB();
  if (!db.isLoaded()) throw new DatabaseNotLoadedError("尚未載入資料庫");
  return db;
}

// hooks.server.ts 或共用的錯誤處理:
try { ... } catch (e) {
  if (e instanceof DatabaseNotLoadedError) return new Response(null, { status: 503 });
  throw e;
}
```

- 優點:database 完全不知道 503;映射集中在一處(hook),語意誠實;`instanceof` 比讀 `.status` 型別安全。
- 代價:要有一個集中的 catch 點(hook 層或一個 route helper);每個 route 若各自 try/catch 會重複。

### 選項 B:保持現況,throw 帶 `status: 503`

```ts
throw Object.assign(new Error("尚未載入資料庫"), { status: 503 });
```

- 優點:零改動,route 端現有處理不動。
- 代價:§5 說的「最後一個 HTTP 洩漏」原封不動留著。如果這題選 B,等於承認 database 就是可以知道一個 HTTP 碼——那 §5 的原則就有個例外,要想清楚這個例外值不值得。

### 選項 C:呼叫端先 `isLoaded()` 判斷,requireLoaded 永不因 not-loaded 而 throw

route 在組 query 前自己 `if (!isLoaded()) return 503`,requireLoaded 退化成「一定拿得到」。

- 優點:route 顯式決定 503,database 不 throw 這種錯。
- 代價:**每個 call site 都要記得先判斷**,漏一個就 crash;跟「把守衛藏在原語裡、漏呼叫也安全」的精神相反(這正是 §5 對「驗證要住在 mutation、不能靠呼叫端 pre-check」的同一論證)。不建議。

## 我的建議

**選項 A。** 用一個具名錯誤類別(`DatabaseNotLoadedError`)取代 `{ status: 503 }`,
在 **hooks 層做一次集中映射**。這樣:
- database / query / mutation 三塊都不認識 HTTP —— §5 的原則零例外。
- 「尚未 load」仍是 throw(符合前置條件錯誤的分類),但攜帶的是**領域身份**而非 HTTP 碼。
- 與 Q3 的 Result reason 列舉是同一套哲學:**錯誤攜帶領域語意,HTTP 映射永遠在最外層 route/hook**。

## 你的回答

<!-- 在這裡寫下你的決定與理由 -->
