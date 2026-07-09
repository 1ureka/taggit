# lib/query — 執行器(server)

對外**只匯出一個 `Query` class**,**建構時注入 db**(authority-free,可注入假 db 測試)。
值物件 × 引擎 → 結果。**只讀,幾乎無預期失敗**(找不到回 `null` / 空),不碰單例。

```ts
const query = new Query(db);
const result = query.images(ImageQuery.fromSearchParams(sp));
const facets = query.tags(TagQuery.facet(where));
```

## 實體

```ts
// 兩引擎的 result 對稱(皆 QueryResult<T>),讓 Tag 也能分頁排序。
type QueryResult<T> = { items: T[]; total: number; page: number; pages: number };

type Tag = { name: string; count: number; meta: TagMeta };   // 對標 ImageWithId:name 身份、count 查詢衍生、meta 補齊預設
```

- `QueryResult<T>` 是**泛型化的統一結果殼**:`images` 回 `QueryResult<ImageWithId>`、`tags` 回 `QueryResult<Tag>`,兩者共用同一個分頁殼與 `paginate` 原語。

## 公開 class

```ts
class Query {
  constructor(db: Database);

  images(q: ImageQuery): QueryResult<ImageWithId>;
  tags(q: TagQuery): QueryResult<Tag>;

  // by-id / 全量讀取
  getImage(id: string): ImageWithId | null;
  getAllImages(): ImageWithId[];    // 不套篩選、不遮蔽;維護掃描用
  getImageCount(): number;
  hasImage(id: string): boolean;
}
```

- **faceted 頁** = 同一個 `ImageWhere` 各建 `ImageQuery` 與 `TagQuery`,對**同一個 `query` 實例**分別呼叫 `images` / `tags`(兩引擎不互傳結果 —— facet 是對「篩選後、未分頁」的集合計數,不是 `images` 分頁後的輸出)。

## 內部結構(按「專心做一件事」切子模組)

```
lib/query/
  index.ts       ← 只匯出 class Query（組合以下引擎 + by-id 讀取）
  scope.ts       ← class ScopeResolver：組 tagBits / ratingRange / live + hidden 遮罩
  images.ts      ← class ImageEngine：materialize → sort → paginate
  tags.ts        ← class TagEngine：facet / standalone 計數 → sort → paginate
  pagination.ts  ← paginate<T>()（純函式 util,兩引擎共用）
  types.ts       ← QueryResult<T> / Tag
```

- `Query` 在建構時以 `db` 造出 `ScopeResolver`,再注入 `ImageEngine` / `TagEngine`;`Query.images` / `Query.tags` 只是把值物件轉交對應引擎。
- **`ScopeResolver`** 兩大引擎共用:`resolve(where: ImageWhere) → { preHidden, visible, included }` —— 組 `tagBits` / `ratingRange` / `live` + hidden 遮罩,把述詞解析成位元圖 scope。
- **`ImageEngine`**:`materialize`(ordinal → `idOf` → `db.getImage`,投影答「哪些」、真相答「什麼」)→ `sort` → `paginate`。
- **`TagEngine`**:依 `TagQuery.scope` present/absent 走 facet / standalone 計數 → `sort` → `paginate`;附 meta 用 `db.getTagMeta(name)`(**讀取原語在 database**,Q5,不再自造 `tagMetaOf`)。

## hidden 遮蔽的不對稱

- **image 側一律遮蔽**(由 `includedTags` 隱式驅動;不遮蔽會直接洩漏隱藏圖)。「不遮蔽」只出現在維護動詞(`getAllImages` 全量 dump)。
- **tag 側可遮蔽可不遮蔽**,由 `TagQuery.scope` 有無決定(原始標籤計數只是數字、不洩漏圖片,管理情境正當需要真實使用數)。

## 尚開放(Q4,限 query + query-spec)

遮蔽/計數語意由 `TagQuery.scope` **present/absent 推導**,不設獨立欄位:

- **present(帶 scope)→ facet**:count 在「scope 篩選 + hidden 遮蔽後」計算;hidden 且不在 `includedTags` 的標籤取「解鎖 N 張」投影數。
- **absent(不帶)→ 獨立列表**:count = 該標籤**原始總使用數**。
- `present ≠ absent` 是這個 collapse 的**守門測試**(全新空庫的空 scope 仍遮蔽;authoring 路徑無 scope 回原始 count)。詳見 [../plan/1_open-questions/q4_scope-present-absent.md](../plan/1_open-questions/q4_scope-present-absent.md)。
