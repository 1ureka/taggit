# Q2 — mutation 錯誤模型(已定案)+ not-load 的層級(開放)

## Part A — mutation 錯誤模型(已定案)

### 原則

**HTTP status 不是 mutation 的職責。** mutation 回傳**領域**結果,由最外層 route/hook 映射成 HTTP。
所有 mutation 走**單一機制**:回傳 `Result`,不 throw 預期失敗(真正的 bug 仍可 throw 到框架邊界)。

### 形狀:`Result<T, E>`,E 用純物件可辨識聯集(不用 Error class)

```ts
// 領域錯誤:純物件變體,以 kind 辨識
type NotFound   = { kind: "not_found" };
type Conflict   = { kind: "conflict"; expectedUpdatedAt: number; actualUpdatedAt: number };
type Validation = { kind: "validation"; fields: string[]; message: string };
type MutationError = NotFound | Conflict | Validation;

// 統一信封:成功帶 method-unique 的 data,失敗帶 E
type Result<T, E = MutationError> =
  | { ok: true;  data: T }
  | { ok: false; error: E };
```

**per-method 收窄 E** —— 型別本身文件化「這個方法可能怎麼失敗」:

```ts
removeRecord(...): Result<ImageRecord, NotFound>
updateRecord(...): Result<ImageWithId, NotFound | Conflict | Validation>
setTagMeta(...):   Result<void,        Validation>
```

**極小工廠**把樣板壓到與 `new XxxError()` 一樣短、零 class 包袱:

```ts
const ok       = <T>(data: T): Result<T, never>            => ({ ok: true,  data });
const notFound = (): Result<never, NotFound>              => ({ ok: false, error: { kind: "not_found" } });
const conflict = (e: number, a: number): Result<never, Conflict>
  => ({ ok: false, error: { kind: "conflict", expectedUpdatedAt: e, actualUpdatedAt: a } });
const invalid  = (fields: string[], message: string): Result<never, Validation>
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

## Part B — not-load 的層級(開放)

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

關鍵:**not-load 的期望回應依 route 類型而異**(redirect vs 503),只有 route 知道要哪一種。

### 開放選項(先不定)

1. **route 頂端顯式守衛**(現況):各 route 開頭 `if (!isLoaded()) …` 自行決定 redirect / 503。
   - 優點:回應形狀歸 route(它才知道要 redirect 還是 503);query/mutation 完全不碰 not-load。
   - 缺點:每個 route 要記得守;一行重複。
2. **存取器回 Result**:`requireLoaded(): Result<Db, NotLoaded>`,route `if (!r.ok) …` 映射。
   - 優點:與 mutation 的 Result 同一套機制、一個 mapper。
   - 缺點:每個 db 存取點都要 unwrap,為一個幾乎不會 false 的守衛加儀式。
3. **存取器 throw 具名錯誤**:`requireLoaded()` throw `DatabaseNotLoadedError`,hook 集中映射。
   - 優點:route 零儀式。
   - 缺點:是個 throw(與 no-throw 純度相衝);且 hook 難把它變成「頁面要的 redirect」。

> 待決:先保持開放。分析見本目錄外的討論總結(route 守衛 vs mutation 守衛)。

## 你的回答

<!-- Part A 已定案。Part B(not-load 層級)待你決定: -->
