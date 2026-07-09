# Q2 — mutation 錯誤模型 + not-load 層級(完全定案)

## Part A — mutation 錯誤模型(已定案)

### 原則

**HTTP status 不是 mutation 的職責。** mutation 回傳**領域**結果,由最外層 route/hook 映射成 HTTP。
所有 mutation 走**單一機制**:回傳 `Result`,不 throw 預期失敗(真正的 bug 仍可 throw 到框架邊界)。

### 形狀:`Result<T, E>`,E 用純物件可辨識聯集(不用 Error class)

```ts
// 領域錯誤:純物件變體,以 kind 辨識。kind 名稱一律「明確」,不用模糊的 "conflict"。
type NotFound    = { kind: "not_found" };
type StaleUpdate = { kind: "stale_update"; expectedUpdatedAt: number; actualUpdatedAt: number }; // 樂觀併發:更新基於過期版本
type LastTag     = { kind: "last_tag"; images: string[] };                                       // 刪標籤會讓這些圖片失去最後一個標籤
type Validation  = { kind: "validation"; fields: string[]; message: string };                    // fields 一律 string[](無特定欄位就 [])
type MutationError = NotFound | StaleUpdate | LastTag | Validation;

// 統一信封:成功帶 method-unique 的 data,失敗帶 E
type Result<T, E = MutationError> =
  | { ok: true;  data: T }
  | { ok: false; error: E };
```

> **兩種「衝突」拆成兩個明確 kind**(你的決定):`stale_update`(樂觀併發,更新時版本已被別人改)與 `last_tag`(刪標籤會讓某些圖片變成零標籤)是**不同的領域事件**,雖然都映射到 409,但名稱必須說清楚是哪一種,不共用一個含糊的 `conflict`。

**per-method 收窄 E** —— 型別本身文件化「這個方法可能怎麼失敗」:

```ts
removeRecord(...): Result<ImageRecord, NotFound>
updateRecord(...): Result<ImageWithId, NotFound | StaleUpdate | Validation>
deleteTag(...):    Result<{ affected: number }, LastTag | Validation>
setTagMeta(...):   Result<void,        Validation>
```

**極小工廠**把樣板壓到與 `new XxxError()` 一樣短、零 class 包袱:

```ts
const ok          = <T>(data: T): Result<T, never>          => ({ ok: true,  data });
const notFound    = (): Result<never, NotFound>            => ({ ok: false, error: { kind: "not_found" } });
const staleUpdate = (e: number, a: number): Result<never, StaleUpdate>
  => ({ ok: false, error: { kind: "stale_update", expectedUpdatedAt: e, actualUpdatedAt: a } });
const lastTag     = (images: string[]): Result<never, LastTag>
  => ({ ok: false, error: { kind: "last_tag", images } });
const invalid     = (fields: string[], message: string): Result<never, Validation>
  => ({ ok: false, error: { kind: "validation", fields, message } });

// mutation 內部:乾淨
if (!rec) return notFound();
return ok(record);
```

### 為什麼 E 用物件聯集而非 Error class

1. **這些是「被回傳的值」,不是「被丟的例外」**:`class … extends Error` 會扛 stack 捕捉、語意暗示「該被 throw」,與 no-throw、當資料回傳的設計相衝。
2. **route 端要窮盡映射**:`switch (error.kind)` 對可辨識聯集有**編譯期窮盡檢查**;`instanceof` 鏈給不了。
3. **無邊界脆弱、可序列化**:validation 的 `fields`/`message` 遲早要進 JSON 回前端顯示,純物件直接 spread;class 會掉原型;`instanceof` 跨 bundle 偶爾失效。
4. **仍完全預先定義、規範化**:滿足「明確型別、不靠 inference」的訴求,還更輕。

### 邊界

- **預期失敗**(not_found / conflict / validation)→ 回 `Result`,`kind` 是領域字串,**絕不帶 HTTP status**。
- **真正非預期**(bug、不變式被破壞)→ 讓它 throw 到 SvelteKit `handleError`(→500 + log stack),**不**硬包 try/catch 塞成一個 `unexpected` 變體(那會吞掉該大聲的 bug)。
- 遷移範圍、驗證內化、`errorToHttp` 映射見 [Q3](./q3_result-migration.md)。

---

## Part B — not-load 的層級(已定案:完全 route)

**定案:not-load 完全由 route 守衛。** `query` 與 `mutation` 都**假設呼叫端帶入的是已載入的 db** ——
它們是 `(db, …) → 結果` 的純函式,不認識「載入狀態」,not-load 永遠不進它們的世界(也不在 mutation 的 E 裡)。

- 頁面 load:route 頂端 `if (!isLoaded()) throw redirect(303, "/settings")`。
- API endpoint:route 頂端 `if (!isLoaded()) return json(…, { status: 503 })`。
- 回應形狀歸 route(它才知道要 redirect 還是 503);`requireLoaded()` 取得已載入實例,理論上拿不到只發生在 route 沒守好的 bug 情境,屬「真正非預期」→ 可 throw 到框架邊界。

### 為什麼 not-load **不在** mutation 的 E 裡

`not_load` 是**存取器/前置條件**的事,不是 mutation 的領域失敗:
- mutation 跑起來時 db 一定已載入 —— [Q1](./q1_singleton-lifecycle.md) 的 `requireLoaded()` 在呼叫端先取得已載入實例。
- 它由 **query 與 mutation 共用**(查詢也需要已載入的 db),塞進 mutation 的 E 會污染「純領域失敗」的聯集,也讓 query 不對稱。

所以 mutation 的 E 收斂成 `NotFound | Conflict | Validation`;not-load 另一層處理。

### 現況(兩種 route 對 not-load 的回應不同)

| route 類型 | 現在怎麼做 | 期望回應 |
|---|---|---|
| **頁面 load**(home/player/…) | `if (!isLoaded()) throw redirect(303, "/settings")` | 導去設定頁(比 503 錯誤頁友善) |
| **API endpoint**(mutation) | `if (!isLoaded()) return json(…, { status: 503 })` | 503 JSON |

關鍵:**not-load 的期望回應依 route 類型而異**(redirect vs 503),只有 route 知道要哪一種 ——
這正是「完全 route 守衛」勝出的核心理由:回應形狀是路由層才知道的知識,下沉到 mutation 只會逼 route 再翻譯一次,還弄髒 mutation 的領域 E、破壞與 query 的對稱。

## 你的回答

Part A、Part B 皆已定案。not-load 完全由 route 守衛;query / mutation 一律假設呼叫端帶入已載入的 db。
