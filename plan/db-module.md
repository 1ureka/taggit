# database / query-spec / query / mutation 模組

現況（對照 `src/lib/poc`）。舊 `src/lib/database/` 的單一 `server.ts` facade 拆成四個模組，
各自一個對外 class（query-spec 例外，見下）。query 與 mutation 互不 import，都只依賴 database。

| 模組 | class | 環境 | 依賴 |
|---|---|---|---|
| `database` | `Database` | server | — |
| `query-spec` | `ImageWhere` / `TagWhere` / `ListOptions` / `ImageQuery` / `TagQuery` / `TagFacetQuery` | isomorphic | — |
| `query` | `Query` | server | database, query-spec |
| `mutation` | `Mutation` | server | database |

`Query` / `Mutation` 建構時注入 `db`（`new Query(db)`），不碰單例，可餵假 db 測試。
每個模組 `index.ts` 只匯出對外要用的東西，子檔不對模組外露出。

```ts
Database.ensureLoaded(dbPath);       // hooks，每個 request 前
if (!Database.isLoaded()) return json({ ok: false }, { status: 503 });
const db = Database.requireLoaded();

const query = new Query(db);
const mutation = new Mutation(db);

const result = query.images(ImageQuery.fromSearchParams(url.searchParams));
const facets = query.facets(TagFacetQuery.fromSearchParams(url.searchParams));

const r = mutation.updateRecord(id, patch);
if (!r.ok) return json({ ok: false, error: r.error }, { status: errorToHttp(r.error) });
```

## database

真相（權威，鍵值儲存）：
- `images: Record<id, ImageRecord>` — 完整
- `tags: Record<name, Partial<TagMeta>>` — 稀疏儲存，讀寫介面一律是完整 `TagMeta`

投影（衍生，只從 `images` 推導，可 `rebuild`，不持久化）：序號（`OrdinalRegistry`）+ 位元圖（`FacetIndex`：tag→bitset、rating→bitset）。

`Database` 一個 class 同時放：

- **靜態：單例生命週期**（唯一碰 `globalThis` 處，HMR 用）
  `requireLoaded()` / `ensureLoaded(dbPath)` / `isLoaded()` / `flush()`
- **實例：真相 CRUD**（對稱、完整型別、覆寫語意，不收 partial）
  `getImage/setImage/deleteImage/hasImage/imageCount/imageEntries`
  `getTagMeta/setTagMeta/deleteTagMeta/tagMetaNames/hiddenTagNames`
  （`getTagMeta` 缺席鍵回 hydrate 後的預設值；`setTagMeta` 內部 prune，全預設會移除表項）
- **實例：索引維護**
  `replaceIndex(id, oldRec)` — 出舊 + 依當前真相進新，墓碑數超門檻時整體 `rebuild`
  `rebuild()` — 全量重建
  規則：動詞一律先寫真相（`setImage`/`deleteImage`），再呼叫 `replaceIndex` 同步投影。
  用單一 `replaceIndex` 而不拆 `indexAdd`/`indexRemove`，是為了避免「出舊 → 寫真相 → 進新」三步之間，`rebuild` 在半更新狀態讀到舊真相、殘留舊 bit 的問題。
- **實例：投影查詢（唯讀）**
  `tagBits/tagBitsEntries/ratingRange/live/idOf/ordinalOf`

檔案：`store.ts`（Database 本體）、`bitmap.ts`（`BitSet`）、`ordinal.ts`（`OrdinalRegistry`）、
`facet-index.ts`（`FacetIndex`）、`serialization.ts`（`parseDBData`/`emptyDBData`/`TagMetaCodec`）、
`types.ts`（`DBData`/`ImageRecord`/`ImageWithId`/`TagMeta`）。

序列化寬容（壞紀錄跳過並記 log，v1/v2 相容），驗證嚴格且住在 mutation——兩者刻意分開，不同檔。

## query-spec

isomorphic 值物件層，前端也會 import，因此獨立成模組，避免不小心把 server code（`fs` 等）牽進前端 build。
每個值物件都是 `fromSearchParams(params)` / `toSearchParams()` / `with(patch)` 的純轉換，預設值在建構時就定好。

```ts
class ImageWhere { search; includedTags; excludedTags; rating?; ratingOp; }
class TagWhere   { name?; hidden?; universe: "used" | "all"; }
class ListOptions<S> { sort: S; order; page; limit; }  // limit=0 不分頁

class ImageQuery { where: ImageWhere; list: ListOptions<ImageSort>; }
class TagQuery   { where: TagWhere;   list: ListOptions<TagSort>; }        // 獨立標籤列表，不帶 scope
class TagFacetQuery { scope: ImageWhere; tags: TagQuery; }                 // facet：scope 必填
```

`TagQuery` 沒有 `scope` 欄位——「facet 還是獨立列表」不是同一個 class 上一個 optional 欄位有沒有填，
而是**兩個不同的 class**：`TagQuery`（無 scope，一律當獨立列表）與 `TagFacetQuery`（scope 是必填欄位）。
呼叫端用哪個 class 本身就是顯式選擇，不會有「空 scope 還是沒 scope」混淆的問題。

檔案：`image-where.ts` / `tag-where.ts` / `list-options.ts` / `image-query.ts` / `tag-query.ts` /
`tag-facet-query.ts` / `parse.ts`（`parseTags`/`safeInt`/`parseEnum`/`parseBool`，純函式）/ `types.ts`（`ImageSort`/`TagSort`）。

`QueryResult<T>` / `Tag` 不在這裡，是 query 模組的結果型別。

## query

只讀，`Query` 建構時注入 `db`，內部另建一個共用 `ScopeResolver` 給兩個引擎用。

```ts
class Query {
  images(q: ImageQuery): QueryResult<ImageWithId>;   // 篩選 + hidden 遮蔽 + 排序 + 分頁
  tags(q: TagQuery): QueryResult<Tag>;                // 獨立列表：count=原始總使用數，不遮蔽
  facets(q: TagFacetQuery): QueryResult<Tag>;         // facet：scope 篩選 + hidden 遮蔽後計數

  getImage(id): ImageWithId | null;
  getAllImages(): ImageWithId[];   // 不篩選、不遮蔽，維護掃描用
  getImageCount(): number;
  hasImage(id): boolean;
}
```

`QueryResult<T> = { items, total, page, pages }`，`images`/`tags`/`facets` 共用同一個分頁殼（`pagination.ts` 的 `paginate()`）。
`Tag = { name, count, meta }`。

- **`ScopeResolver`**（`scope.ts`）：把 `ImageWhere` 解成位元圖。管線：`live ∩ includedTags − excludedTags ∩ ratingRange`，
  再對 `search` 做名稱子字串後置過濾；另外算 hidden 遮罩（所有 hidden 且不在 `includedTags` 裡的標籤位元圖聯集）。
  回傳 `{ preHidden, visible, included }`，`visible = preHidden − 遮罩`。
- **`ImageEngine`**（`images.ts`）：一律用 `visible` 集合（image 側不遮蔽會直接洩漏隱藏圖）→ 物化成 `ImageWithId` → 排序 → 分頁。
- **`TagEngine`**（`tags.ts`）：`runFacet` 用 `scope` 篩選 + 遮蔽後計數，hidden 且未 included 的標籤取「解鎖後會有幾張」的投影數；
  `runStandalone` 直接用該標籤位元圖大小當 count，不遮蔽。兩者靠 `TagFacetQuery` / `TagQuery` 兩個型別在呼叫處分派，不是同一函式裡的 if。
  兩者都用 `db.getTagMeta(name)` 補 meta。

## mutation

`Mutation` 建構時注入 `db`。只吃 id / name / 純命令物件，不 parse URL，回 `Result`，預期失敗不 throw。

```ts
type MutationError =
  | { kind: "not_found" }
  | { kind: "stale_update"; expectedUpdatedAt: number; actualUpdatedAt: number }
  | { kind: "last_tag"; images: string[] }
  | { kind: "validation"; fields: string[]; message: string };

type Result<T, E = MutationError> = { ok: true; data: T } | { ok: false; error: E };
```

用純物件聯集而非 `Error` class：可 `switch(e.kind)`、可直接序列化進 JSON。工廠函式：`ok`/`notFound`/`staleUpdate`/`lastTag`/`invalid`。
HTTP 狀態碼映射（`not_found→404` / `stale_update→409` / `last_tag→409` / `validation→400`）不在 mutation，在 route 端的 `errorToHttp`。
未載入（503）純粹是 route 頂端守衛，不算進 `MutationError`。

```ts
class Mutation {
  commitRecord(id, entry: ImportEntry, file: FileInfo): Result<ImageWithId, Validation>;
  updateRecord(id, patch: UpdatePatch): Result<ImageWithId, NotFound | StaleUpdate | Validation>;
  updateRecordFileMeta(id, meta: FileMetaPatch): Result<ImageWithId, NotFound>;
  removeRecord(id): Result<ImageRecord, NotFound>;
  renameTag(oldName, newName): Result<{ affected: number }, Validation>;
  deleteTag(name): Result<{ affected: number }, LastTag | Validation>;
  setTagMeta(name, meta: TagMeta): Result<void, Validation>;
}
```

內部拆 `ImageCommands`（commit/update/updateFileMeta/remove）與 `TagCommands`（rename/delete/setMeta），
共用一個私有、必跑的 `Validator`（`tags`/`rating`/`name`/`tagName`，不對外匯出——不管呼叫端有沒有先驗過都會驗）。

寫入模式：先 `db.getImage` 拿完整基底 → 套用不變式（找不到 → `notFound`；`updatedAt` 不符 → `staleUpdate`）
→ `Validator` 驗證 → 覆蓋出完整 next → `db.setImage`（寫真相）+ `db.replaceIndex`（同步投影）+ `db.markDirty`。
`renameTag`/`deleteTag` 是批次動詞：逐筆改真相後統一 `db.rebuild()` 收斂投影一次，而非每筆都 `replaceIndex`。
`deleteTag` 會先掃過一輪，若有圖片會因此變成零標籤就整批擋下（回 `last_tag`，帶受影響 id 列表）。

批次（匯入多筆、前端多選刪除）不在 mutation 內：一律呼叫端逐筆呼叫單筆方法，部分成功由呼叫端自己聚合。

## 檔案結構

```
lib/poc/
  database/    index.ts store.ts bitmap.ts ordinal.ts facet-index.ts serialization.ts types.ts
  query-spec/  index.ts image-where.ts tag-where.ts list-options.ts image-query.ts tag-query.ts
               tag-facet-query.ts parse.ts types.ts
  query/       index.ts scope.ts images.ts tags.ts pagination.ts types.ts
  mutation/    index.ts image.ts tag.ts validator.ts result.ts commands.ts
```
