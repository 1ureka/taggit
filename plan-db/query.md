# lib/query — 執行器(server)

值物件 × 引擎 → 結果。**只讀,幾乎無預期失敗**(找不到回 `null` / 空)。每個函式第一參數吃 `db`,不碰單例。

## 實體

```ts
type QueryResult<T> = { items: T[]; total: number; page: number; pages: number };

type Tag = { name: string; count: number; meta: TagMeta };   // 對標 ImageWithId:name 身份、count 查詢衍生、meta 補齊預設
```

兩個查詢的 result **對稱**(皆 `QueryResult<T>`),讓 Tag 也能分頁排序。

## 兩大引擎

```ts
function images(db: Database, q: ImageQuery): QueryResult<ImageWithId>;
function tags(db: Database, q: TagQuery): QueryResult<Tag>;
```

- **faceted 頁** = 同一個 `ImageWhere` 各建 `ImageQuery` 與 `TagQuery`,**分別執行**(兩引擎不互傳結果 —— facet 是對「篩選後、未分頁」的集合計數,不是 `images` 分頁後的輸出)。

## by-id / 全量讀取

```ts
function getImage(db: Database, id: string): ImageWithId | null;
function getAllImages(db: Database): ImageWithId[];   // 不套篩選、不遮蔽;維護掃描用
function getImageCount(db: Database): number;
function hasImage(db: Database, id: string): boolean;
```

## 內部(組合原語,非公開)

- `resolveScope(db, where: ImageWhere) → { preHidden, visible, included }`:組 `tagBits` / `ratingRange` / `live` + hidden 遮罩,把述詞解析成位元圖 scope。兩大引擎共用。
- `materialize`:ordinal → `idOf` → `db.getImage`(投影回答「哪些」、真相回答「什麼」)。
- `sort` / `paginate`。
- 附 meta:`db.getTagMeta(name)` —— **讀取原語在 database**(Q5),query 不再自造 `tagMetaOf`。

## hidden 遮蔽的不對稱

- **image 側一律遮蔽**(由 `includedTags` 隱式驅動;不遮蔽會直接洩漏隱藏圖)。「不遮蔽」只出現在維護動詞(`getAllImages` 全量 dump)。
- **tag 側可遮蔽可不遮蔽**,由 `TagQuery.scope` 有無決定(原始標籤計數只是數字、不洩漏圖片,管理情境正當需要真實使用數)。

## 尚開放(Q4,限 query + query-spec)

遮蔽/計數語意由 `TagQuery.scope` **present/absent 推導**,不設獨立欄位:

- **present(帶 scope)→ facet**:count 在「scope 篩選 + hidden 遮蔽後」計算;hidden 且不在 `includedTags` 的標籤取「解鎖 N 張」投影數。
- **absent(不帶)→ 獨立列表**:count = 該標籤**原始總使用數**。
- `present ≠ absent` 是這個 collapse 的**守門測試**(全新空庫的空 scope 仍遮蔽;authoring 路徑無 scope 回原始 count)。詳見 [../plan/1_open-questions/q4_scope-present-absent.md](../plan/1_open-questions/q4_scope-present-absent.md)。
