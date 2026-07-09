# Q3 — mutation 遷移範圍 + `errorToHttp` 映射

> 錯誤模型已在 [Q2](./q2_not-loaded-error.md) 定案(`Result<T, E>`,E 為純物件可辨識聯集)。
> 本題只處理:哪個 mutation 產生哪些 E、驗證怎麼內化、映射住哪。

## 1. 每個 mutation 的 E(逐方法可能失敗)

| mutation | 成功 `data` | 可能的 E | 備註 |
|---|---|---|---|
| `commitRecord`(提交/匯入) | `ImageWithId` | `Validation` | 覆寫既有 id 是正常行為,非失敗 |
| `updateRecord`(更新單張) | `ImageWithId` | `NotFound \| Conflict \| Validation` | 樂觀併發 → `Conflict`(帶 expected/actual updatedAt) |
| `removeRecord`(刪除單張) | `ImageRecord` | `NotFound` | |
| `updateRecordFileMeta`(維護補算) | `ImageWithId` | `NotFound` | 掃描迴圈用;「掃描時剛好沒了」→ `NotFound` 讓呼叫端略過該筆 |
| `renameTag`(全域改名) | `{ affected: number }` | `Validation` | 名稱驗證內化(見 §2) |
| `deleteTag`(全域刪除) | `{ affected: number }` | `Conflict \| Validation` | 掉最後一個標籤 → `Conflict`(payload 可省或帶受影響 id) |
| `setTagMeta`(寫入標籤元資料) | `void`(或回合併後 meta) | `Validation` | |

- 統一信封:全部回 `{ ok:true, data } | { ok:false, error }`,即使 `data` 各異(`ImageWithId` / `{ affected }` / `void`)。
- `not_load` **不在**任何一列(見 Q2 Part B)。
- `Conflict` 的 payload 依情境:更新併發帶 `expectedUpdatedAt/actualUpdatedAt`;deleteTag 的「最後一個標籤」是另一種 conflict —— **待決**:是否用同一個 `Conflict` 變體(payload 不同)還是細分兩種 kind。傾向:同一個 `kind:"conflict"`,payload 為選填,route 只需知道「是 conflict → 409」。

## 2. 驗證內化(§5 的核心)

現在驗證散在 route,靠呼叫端記得 pre-check(會漂移):

```ts
// 現況:api/committed/[filename] —— route 先手動驗證
if (tags   !== undefined && !database.isValidTags(tags))    return json(…, { status: 400 });
if (rating !== undefined && !database.isValidRating(rating)) return json(…, { status: 400 });
if (name   !== undefined && !database.isValidName(name))     return json(…, { status: 400 });
```

改為:**`isValidTags` / `isValidRating` / `isValidName` 變 mutation 內部私有**,mutation 無論如何都驗,
失敗回 `invalid(fields, message)`。route 不再 pre-check。

```ts
// mutation 內部
if (patch.tags !== undefined && !isValidTags(patch.tags))
  return invalid(["tags"], "標籤必須是非空、唯一、修剪後非空的字串陣列");
```

**借用問題**:[api/tags](../../src/routes/api/tags/+server.ts) 現在用 `isValidTags([oldName, newName])` 驗「兩個標籤名有效且不同」——
這不是驗一筆圖片紀錄,是借用。**定案**:`renameTag` 內化自己的輸入驗證,不再借 `isValidTags`;三個 `isValidXX` 全部下沉為 mutation 私有,不對外公開。

## 3. `errorToHttp` 映射(住哪、長怎樣)

一個共用、對 `kind` 窮盡檢查的映射器,route 用它把 E 轉 HTTP:

```ts
// 共用 helper(route 層,或 utils/server)
function errorToHttp(e: MutationError): number {
  switch (e.kind) {
    case "not_found":  return 404;
    case "conflict":   return 409;
    case "validation": return 400;
    // 少一種 kind → 編譯期報錯(窮盡檢查)
  }
}
```

route 遷移前後對照:

```ts
// 舊
try {
  const updated = database.updateImage(filename, { expectedUpdatedAt, tags, rating, name });
  return json({ ok: true, data: updated });
} catch (e) {
  if (e instanceof Error && "status" in e) return json({ ok:false, error:e.message }, { status:e.status });
  return json({ ok:false, error:"未知的錯誤" }, { status:500 });
}

// 新
const db = database.requireLoaded();
const r = mutation.updateRecord(db, filename, { expectedUpdatedAt, tags, rating, name });
if (!r.ok) {
  const status = errorToHttp(r.error);
  const body = r.error.kind === "validation"
    ? { ok:false, error: r.error.message, fields: r.error.fields }   // 400 帶欄位
    : { ok:false, error: r.error.kind };
  return json(body, { status });
}
return json({ ok:true, data: r.data });
// route 不再有 isValidTags/isValidRating/isValidName 三段 pre-check、不再 try/catch 讀 e.status
```

- `not_load` 的 503 仍由 route 頂端 `isLoaded()` 守衛(Q2 Part B),不經 `errorToHttp`。
- 真正的 bug 仍會 throw → SvelteKit `handleError` → 500,不進 `errorToHttp`。

## 待你確認

- **3a**:§1 的逐方法 E 表對嗎?尤其 `deleteTag` 的「最後一個標籤」要不要獨立 kind,或併入 `conflict`(我傾向併入)。
- **3b**:`renameTag` 內化自己的輸入驗證、三個 `isValidXX` 全下沉私有 —— 同意?
- **3c**:`errorToHttp` 放哪(route 共用 helper vs `utils/server`)?validation 回應要不要一律帶 `fields`?

## 你的回答

<!-- 3a: -->

<!-- 3b: -->

<!-- 3c: -->
