# lib/mutation — 命令 + 不變式 + 驗證(server)

輸入純型別命令(各自獨立、不 parse URL、不組合)。**只認 id / name**,回領域 `Result`,**不 throw 預期失敗**。
每個函式第一參數吃 `db`,不碰單例。推導見 [../plan/1_open-questions/q2_not-loaded-error.md](../plan/1_open-questions/q2_not-loaded-error.md) 與 [q3](../plan/1_open-questions/q3_result-migration.md)。

## 錯誤模型(Q2)

```ts
type NotFound    = { kind: "not_found" };
type StaleUpdate = { kind: "stale_update"; expectedUpdatedAt: number; actualUpdatedAt: number };
type LastTag     = { kind: "last_tag"; images: string[] };
type Validation  = { kind: "validation"; fields: string[]; message: string };
type MutationError = NotFound | StaleUpdate | LastTag | Validation;

type Result<T, E = MutationError> =
  | { ok: true;  data: T }
  | { ok: false; error: E };
```

- **E 用純物件可辨識聯集,不用 `Error` class**:它們是被回傳的值、route 端 `switch (e.kind)` 可窮盡、可序列化(validation 的 `fields`/`message` 直接進 JSON)。
- 兩種「衝突」拆成**明確 kind**:`stale_update`(樂觀併發)、`last_tag`(刪標籤致零標籤),不共用模糊的 `conflict`。
- 工廠:`ok(data)` / `notFound()` / `staleUpdate(e, a)` / `lastTag(images)` / `invalid(fields, message)` —— mutation 內 `return notFound();` 一樣短、零 class 包袱。
- **真正非預期**(bug)→ throw 到 SvelteKit `handleError`(→500);**not-load 完全 route 守衛,不在 E**。

## 命令型別

```ts
interface ImportEntry { name: string; tags: string[]; rating?: number }
interface FileInfo    { fileSize: number; width: number; height: number; blurhash: string }
interface UpdatePatch { expectedUpdatedAt: number; tags?: string[]; rating?: number; name?: string }
type FileMetaPatch    = Partial<Pick<ImageRecord, "width" | "height" | "blurhash">>
```

型別編譯期抹除、跨前後端天然安全 → **不需**獨立 args 模組。

## 動詞(per-method 收窄 E)

```ts
commitRecord(db, id: string, entry: ImportEntry, file: FileInfo): Result<ImageWithId, Validation>;
updateRecord(db, id: string, patch: UpdatePatch):                 Result<ImageWithId, NotFound | StaleUpdate | Validation>;
updateRecordFileMeta(db, id: string, meta: FileMetaPatch):        Result<ImageWithId, NotFound>;
removeRecord(db, id: string):                                     Result<ImageRecord, NotFound>;
renameTag(db, oldName: string, newName: string):                 Result<{ affected: number }, Validation>;
deleteTag(db, name: string):                                     Result<{ affected: number }, LastTag | Validation>;
setTagMeta(db, name: string, meta: TagMeta):                     Result<void, Validation>;  // 驗證 + 委派 db.setTagMeta(覆寫);今天近乎 pass-through
```

per-method 的 E 讓型別**文件化「這個方法可能怎麼失敗」**,呼叫端不多不少。

## 寫入的組合(動詞如何坐在原語上)

```
updateRecord = db.getImage(拿完整基底)
             + 不變式(找不到→notFound;updatedAt 不符→staleUpdate)
             + 驗證(不合法→invalid)
             + 覆蓋 patch → 完整 ImageRecord
             + db.setImage(覆寫) + db.indexRemove/indexAdd + markDirty
             → ok(record)
```

- **合併語意住動詞**(read-overlay-write),原語只做覆寫。`setTagMeta` 動詞同理:要「只改一欄」就先 `db.getTagMeta`(缺席回 DEFAULT)→ 覆蓋 → `db.setTagMeta`。
- **驗證封裝在 mutation 內**:`isValidTags` / `isValidRating` / `isValidName` 下沉為**內部私有**,無論呼叫端有無 pre-check 都驗(mutation 是真相守門人)。內部如何組織驗證 = 實作細節。

## 錯誤 → HTTP(在 route,不在 mutation)

`$lib/utils/server` 的 `errorToHttp(e: MutationError): number`,對 `kind` 窮盡檢查:

```
not_found → 404 | stale_update → 409 | last_tag → 409 | validation → 400
```

`validation` 的 route 回應**一律帶 `fields: string[]`**(無特定欄位就 `[]`)。not-load 的 503 由 route 頂端守衛,不經此。

## 批次(不在引擎)

一律**呼叫端逐筆**組合單筆 mutation:提交/匯入在**路由層** `for` 迴圈 + SSE;編輯/刪除在**前端** `batchRun` 打單筆 API。
mutation 只認單筆、只回單筆 `Result`;部分成功由呼叫端聚合(前端數 ok/fail;匯入路由累計 `errors[]`)。詳見 [q3 §4](../plan/1_open-questions/q3_result-migration.md)。
