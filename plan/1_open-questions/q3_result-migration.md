# Q3 — mutation 遷移範圍 + `errorToHttp` 映射

> 錯誤模型已在 [Q2](./q2_not-loaded-error.md) 定案(`Result<T, E>`,E 為純物件可辨識聯集)。
> 本題只處理:哪個 mutation 產生哪些 E、驗證怎麼內化、映射住哪。

## 1. 每個 mutation 的 E(逐方法可能失敗)

| mutation | 成功 `data` | 可能的 E | 備註 |
|---|---|---|---|
| `commitRecord`(提交/匯入) | `ImageWithId` | `Validation` | 覆寫既有 id 是正常行為,非失敗 |
| `updateRecord`(更新單張) | `ImageWithId` | `NotFound \| StaleUpdate \| Validation` | 樂觀併發 → `stale_update`(帶 expected/actual updatedAt) |
| `removeRecord`(刪除單張) | `ImageRecord` | `NotFound` | |
| `updateRecordFileMeta`(維護補算) | `ImageWithId` | `NotFound` | **單筆**;批次迴圈在 route(見 §4)。掃描時剛好沒了 → `NotFound`,迴圈略過該筆 |
| `renameTag`(全域改名) | `{ affected: number }` | `Validation` | 名稱驗證內化(見 §2) |
| `deleteTag`(全域刪除) | `{ affected: number }` | `LastTag \| Validation` | 掉最後一個標籤 → `last_tag`(帶會被清空的 image id[]) |
| `setTagMeta`(寫入標籤元資料) | `void`(或回合併後 meta) | `Validation` | |

- 統一信封:全部回 `{ ok:true, data } | { ok:false, error }`,即使 `data` 各異(`ImageWithId` / `{ affected }` / `void`)。
- `not_load` **不在**任何一列(Q2 Part B:完全 route 守衛)。
- **兩種衝突已拆成明確 kind**(Q2 定案):`stale_update`(更新併發)與 `last_tag`(刪標籤致零標籤),不共用模糊的 `conflict`。

## 2. 驗證內化(§5 的核心)—— 原則已定,內部組織屬實作細節

**原則(定案):輸入驗證封裝在 mutation 內。** mutation 是真相守門人,無論呼叫端有沒有先檢查都必須驗;
失敗回 `invalid(fields, message)`。route 端**移除**所有 `isValidXX` 的 pre-check。

```ts
// 現況(要移除):api/committed/[filename] —— route 先手動驗證
if (tags !== undefined && !database.isValidTags(tags)) return json(…, { status: 400 });
// 之後:route 不驗,直接呼叫 mutation;不合法時 mutation 回 { ok:false, error:{ kind:"validation", … } }
```

- 三個 `isValidXX` 不再對外公開,變 mutation 內部。
- [api/tags](../../src/routes/api/tags/+server.ts) 目前借 `isValidTags([oldName,newName])` 驗標籤名 → `renameTag` 內化自己的輸入驗證,不再借。
- **mutation 內部怎麼組織這些驗證(共用 helper、擺哪個檔)= 實作細節**,不在計畫層敲定。核心就一句:驗證住在 mutation 內、不外流。

## 3. `errorToHttp` 映射(住 `utils/server`)

住 **`$lib/utils/server`**,對 `kind` 窮盡檢查:

```ts
// $lib/utils/server
function errorToHttp(e: MutationError): number {
  switch (e.kind) {
    case "not_found":    return 404;
    case "stale_update": return 409;
    case "last_tag":     return 409;
    case "validation":   return 400;
    // 少一種 kind → 編譯期報錯(窮盡檢查)
  }
}
```

- `validation` 的 route 回應**一律帶 `fields: string[]`**(無特定欄位就 `[]`),前端拿得到就顯示、拿到空陣列就當一般錯誤。

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

## 已定案彙整

- 逐方法 E 表(§1),兩種衝突拆成明確 kind(`stale_update` / `last_tag`)。
- 驗證封裝在 mutation 內(§2),三個 `isValidXX` 下沉私有;內部組織屬實作細節。
- `errorToHttp` 住 `$lib/utils/server`(§3);validation 回應一律帶 `fields: string[]`(可為 `[]`)。
- not-load 完全 route 守衛(Q2 Part B)。

---

## 4. 批次:一律在呼叫端,引擎只認單筆(已釐清,非開放)

rewrite2 舊 §7 的「#12 吃 id[] 的批次 mutation」是沙箱推測,與現況不符。實際上**批次從不進 database/mutation**,一律在呼叫端逐筆組合單筆 mutation:

| 業務 | 批次在哪 | 逐筆呼叫 | 部分成功怎麼歸類 |
|---|---|---|---|
| 提交/匯入 | **路由層** `POST /api/committed` | route `for` 迴圈 `commitImage`(單筆) | 每筆累計 `errors[]`;SSE `progress` 逐筆回、`done` 帶 `{ imported, skipped, errors }` |
| 編輯(批次改標籤/評分) | **前端** `batchRun(patches, 5, …)` | 並發呼叫 `PATCH /api/committed/[id]`(單筆) | 每個單筆 API 回自己的 `{ ok, error }`,`batchRun` tally 成 `[ok, fail]` 計數 → toast |
| 刪除(批次取消提交) | **前端** `batchRun(ids, 5, …)` | 並發呼叫 `DELETE /api/committed/[id]`(單筆) | 同上 |
| 維護掃描(補元資料/清缺失) | **路由層** for 迴圈 | route 迴圈 `updateImageFileMeta` / `removeImage`(單筆) | route 自己累計 `updated++`;遇 `NotFound` 略過 |

因此:
- **`Result<T, E>` 單筆模型已足夠,不需要任何批次變體。** 部分成功是**呼叫端聚合**單筆 Result 的事(前端數 ok/fail;匯入路由累計 `errors[]` + SSE),不是 mutation 的事。
- 新設計不變:route 取一次 `db = requireLoaded()` 再迴圈 `mutation.commit(db, …)`;前端批次則每個單筆 API 各自 `requireLoaded()` + 單筆 mutation。
- 匯入路由的 `validateEntry` 目前混了**檔案系統檢查**(isImageFile / 檔案存在,屬 route/image 職責)與**紀錄驗證**(name/tags/rating,屬 database)。驗證內化後(§2),route 保留自己的 fs 檢查,db 驗證改由 `commitRecord` 回 `validation` Result,route 把它格式化進 SSE 錯誤字串 —— 純實作細節。

**結論:Q3 無剩餘開放問題。**

## 你的回答

已無開放問題。批次一律呼叫端逐筆,單筆 `Result<T, E>` 足夠。
