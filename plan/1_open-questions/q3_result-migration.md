# Q3 — Result 型別遷移的範圍與形狀

> 這題波及面真實但有界(~4 個 route 檔)。要先確認你願意一起改,以及 Result 的確切形狀。

## 一句話問題

mutation 從「throw 帶 `status`」改成「回傳 `{ success: false, reason }`」領域 Result 後,
**哪些 mutation 改 Result、哪些維持 throw**?驗證搬進 mutation 後,route 的 pre-check 怎麼退場?

## 現況:兩個問題糾纏在一起

### 問題一:錯誤靠 throw + `status` 傳遞

route 端到處是這段「讀 `e.status`」的樣板([committed/[filename]](../../src/routes/api/committed/[filename]/+server.ts)):

```ts
try {
  const updated = database.updateImage(filename, { expectedUpdatedAt, tags, rating, name });
  return json({ ok: true, data: updated });
} catch (e) {
  if (e instanceof Error && "status" in e && typeof e.status === "number") {
    return json({ ok: false, error: e.message }, { status: e.status });   // ← HTTP 洩漏來源
  }
  // …未知錯誤 → 500
}
```

mutation 內部則直接 throw HTTP 碼:

```ts
// mutation.ts
throw Object.assign(new Error("找不到圖片"), { status: 404 });   // updateRecord / removeRecord
throw Object.assign(new Error("併發衝突"), { status: 409 });     // updateRecord
throw Object.assign(new Error("conflict"), { status: 409 });     // deleteTag
```

### 問題二:驗證住在 route,靠呼叫端記得 pre-check

同一個 route 在呼叫 mutation **之前**先手動驗證:

```ts
if (tags !== undefined && !database.isValidTags(tags)) return json({...}, { status: 400 });
if (rating !== undefined && !database.isValidRating(rating)) return json({...}, { status: 400 });
if (name !== undefined && !database.isValidName(name)) return json({...}, { status: 400 });
```

計畫 §5 說這是**漂移的溫床**:公開的 validator 讓每個 route 各自 pre-check,漏一個就破真相。
所以驗證要**搬進 mutation、變成內部不公開**,mutation 無論如何都驗。

## 計畫要的終點(§5)

```ts
type MutationResult<T> =
  | { success: true; data: T }
  | { success: false; reason: "VALIDATION_ERROR" | "CONFLICT" | "NOT_FOUND"; details?: unknown };
```

- **預期失敗**(驗證 / 併發衝突 / 找不到)→ 回 Result,reason 是**領域列舉、不帶 HTTP status**。
- **非預期**(尚未 load[見 Q2]、I/O、bug)→ 仍 throw。
- route 負責把 reason 映射成 HTTP:`VALIDATION_ERROR→400`、`CONFLICT→409`、`NOT_FOUND→404`。

遷移後 route 會變成(對照上面):

```ts
const r = mutation.updateRecord(db, filename, { expectedUpdatedAt, tags, rating, name });
if (!r.success) return json({ ok: false, error: r.reason }, { status: reasonToHttp(r.reason) });
return json({ ok: true, data: r.data });
// route 不再有 isValidTags/isValidRating/isValidName 這三段 pre-check —— mutation 內部驗了
```

## 需要你拍板的三個子問題

### 3a. 哪些 mutation 回 Result,哪些維持 throw?

逐一盤點現有 mutation 的失敗模式:

| mutation | 目前失敗 | 建議 |
|---|---|---|
| `commitRecord`(提交/匯入) | 目前不驗、不 throw 領域錯 | 驗證搬入 → 可能 `VALIDATION_ERROR` |
| `updateRecord`(更新單張) | 404 / 409 | `NOT_FOUND` / `CONFLICT`(+ 驗證 `VALIDATION_ERROR`) |
| `removeRecord`(刪除單張) | 404 | `NOT_FOUND` |
| `renameTag`(全域改名) | 無(回 affected 數) | 驗證 → `VALIDATION_ERROR`;其餘維持直接回數字? |
| `deleteTag`(全域刪除) | 409(掉最後一個標籤) | `CONFLICT` |
| `setTagMeta` | 無 | 維持 void? |
| `updateRecordFileMeta`(維護用) | 404 | `NOT_FOUND` 還是維持 throw?(維護情境,呼叫端是掃描迴圈) |

**要決定的**:像 `renameTag`/`setTagMeta` 這種「幾乎不會預期失敗、只回個數字」的,
要不要也一律包成 `MutationResult`(一致性)?還是「有預期失敗的才包,沒有的維持原樣」(§5 說『不要什麼都包成 Result』)?
`updateRecordFileMeta` 是維護迴圈用的,404 對它其實是「這張掃描時剛好沒了」,包 Result 還是 throw?

### 3b. 驗證搬進 mutation 後,`isValidTags` / `isValidRating` / `isValidName` 還公開嗎?

計畫說「改為內部、不公開」。但注意目前有**非圖片紀錄**的呼叫端也在用它們:

- [api/tags](../../src/routes/api/tags/+server.ts) 用 `isValidTags([oldName, newName])` 驗「兩個標籤名是有效且不同的字串」——這其實是借用 tags 驗證器來驗 rename 的輸入,**不是**在驗一筆圖片紀錄。

**要決定的**:這種「借用」怎麼辦?
- (i) rename 有自己的輸入驗證(在 `renameTag` 內部),不再借 `isValidTags`;或
- (ii) 保留一個小的、共用的字串驗證原語給這種情境。

### 3c. reason→HTTP 的映射住哪?

- (i) 每個 route 各自寫 `reasonToHttp`(重複但顯式);
- (ii) 一個共用 helper `reasonToHttp(reason)`(集中,建議);
- (iii) 更進一步:一個 `respond(result)` helper 直接把 `MutationResult` 轉成 `Response`,route 一行搞定。

## 我的建議

- **3a**:有預期失敗的(`updateRecord`/`removeRecord`/`deleteTag`/`commitRecord`)回 `MutationResult`;
  純粹「回數字、無預期失敗」的(`renameTag` 成功路徑、`setTagMeta`)**維持直接回值**,只在有驗證失敗時回 Result —— 遵從 §5「不要什麼都包」。
  `updateRecordFileMeta` 維護用,維持 throw(它的 404 是「掃描時剛好沒了」的非預期,呼叫端本來就在 try 裡)。
- **3b**:採 (i)。rename 的輸入驗證內化到 `renameTag`,不再借 `isValidTags` 驗標籤名。三個 `isValidXX` 全部變 mutation 內部私有。
- **3c**:採 (ii),一個共用 `reasonToHttp`。先不做 (iii) 的 `respond()`,因為各 route 的成功 payload 形狀不同(`{ affected }` vs `{ ...record }`),抽太早會綁手。

## 你的回答

<!-- 3a: -->

<!-- 3b: -->

<!-- 3c: -->
