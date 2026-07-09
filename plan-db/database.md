# lib/database — 引擎(authority-free)

對外**只匯出一個 `Database` class**。持有兩份真相 + 衍生投影,對外只給**策劃過的原語**;
負責 `rebuild`、序列化,以及以**靜態成員**管理的單例生命週期。
**不持有**高階動作(`resolveScope`、索引維護的組合由 `Query` / `Mutation` 用原語組出)→ 因此保持小。
推導見 [../plan/1_open-questions/q0_database-shape.md](../plan/1_open-questions/q0_database-shape.md)。

## 真相(write model / 權威)

| 真相 | 鍵 | 型別 | 儲存形態 |
|---|---|---|---|
| images | id | `ImageRecord` | 完整 |
| tagMeta | name | `TagMeta` | 稀疏(但**介面為完整型別**,見下) |

## 投影(read model / 衍生)

序號宇宙 + 位元圖(`tag→bitset`、`rating→bitset`、`live`)。只從 `images` 單向推導、可 `rebuild`、**永不權威**。
`tagMeta` **不在**投影裡(它是真相,不是索引)。

## class 形狀:靜態生命週期 + 實例原語

`Database` 一個 class 同時扛兩層,兩層都在同一個 class 內、無 module-level 裸函式:

- **靜態層 = 單例生命週期**:唯一碰 `globalThis` 單例的地方;route / hooks 從這裡取 db。
- **實例層 = authority-free 原語**:`Query` / `Mutation` 只認建構子傳入的實例,**不碰靜態單例**(可注入假 db 測試)。

```ts
class Database {
  // ── 靜態:單例生命週期(唯一碰單例處)──────────────────
  static requireLoaded(): Database;          // 取用口(Q1):回已載入實例;拿不到 = route 沒守好的 bug → throw
  static ensureLoaded(dbPath: string): void; // hooks 每個 request 前;內部比對私有 filePath 決定是否重載
  static isLoaded(): boolean;
  static flush(): void;                       // debounce + atomic write(hooks 關閉訊號 / 備份前)

  // ── 實例:私有狀態 ────────────────────────────────
  private filePath: string | null;            // 綁定路徑,**唯一一個**、全私有、無 getter(見下)
  // data(兩份真相)/ ordinals / facets / dirty / flushTimer 皆私有

  // 實例原語見「原語 A / B / C」三段。
}
```

- **靜態方法讀得到私有 `filePath`**:TypeScript 的 `private` 是 class-private(非 instance-private),`ensureLoaded` 這個**靜態**方法與實例同屬 `Database` class body,可直接讀 `instance.filePath` 做「是否需重載」的比對 → 因此**只需一個私有 `filePath`,不需要 getter、也沒有 `boundPath` / `filePath` 之分**(舊 `currentDbPath` 對外零呼叫端;「當前 collection 的硬碟路徑」職責屬 `collection` 模組)。
- **not-load 完全 route 守衛**;`requireLoaded` 正常拿得到,拿不到屬 bug → throw 到框架邊界。

## 原語 A:真相 CRUD —— 對稱、完整業務型別、覆寫語意

```ts
// images by id
getImage(id: string): ImageRecord | null;    // 不含 id(id 是身份,由讀/寫端組裝)
setImage(id: string, rec: ImageRecord): void;// 覆寫;呼叫端組好完整 ImageRecord。只寫真相 slot、不碰投影
deleteImage(id: string): void;
hasImage(id: string): boolean;
imageCount(): number;
imageEntries(): [string, ImageRecord][];     // 全量迭代(維護掃描 / 全量 dump 用)

// tagMeta by name —— 介面與 image 完全對稱
getTagMeta(name: string): TagMeta;           // 缺席鍵回 hydrate 後的 DEFAULT,永遠回完整
setTagMeta(name: string, meta: TagMeta): void;// 吃完整 TagMeta;內部 prune 存稀疏,全預設則移除表項
deleteTagMeta(name: string): void;
tagMetaNames(): string[];                     // 有非預設元資料的標籤名(universe="all" 併入未使用標籤用)
```

- **一律吃吐完整型別、覆寫語意**,不收 partial。**合併/patch 是動詞的事**:動詞先 `get`(完整基底,`getTagMeta` 缺席也回完整)→ 覆蓋 → `set`(完整)。
- tag 的**稀疏(prune)、hydrate、`DEFAULT_TAG_META`** 全是 database **內部零件**,維持「完整型別介面」;呼叫端永不碰稀疏。理由(information hiding)見 q0 §6。
- 介面對稱、實作不對稱:image 原語內部 dumb;tag 原語內部做 hydrate/prune。

## 原語 B:索引(與真相 CRUD 分開的另一組)

```ts
indexAdd(id: string, rec: ImageRecord): number;      // 進序號 + 位元圖,回 ordinal
indexRemove(id: string, rec: ImageRecord): void;     // 出(留墓碑;超門檻自動壓實 = 全 rebuild)
rebuild(): void;                                      // 全建;「索引純由 images 推導」這個契約本身
```

真相 CRUD 只碰真相 slot、**不碰投影**;索引同步是這組。`Mutation` 動詞在寫真相後**組合**它們(只有 image 需要;tagMeta 無投影)。

## 原語 C:投影查詢(唯讀)

```ts
tagBits(name: string): BitSet | null;
tagBitsEntries(): IterableIterator<[string, BitSet]>;  // 逐標籤計數的迭代口(Query 兩引擎用)
ratingRange(from: number, to: number): BitSet;
get live(): BitSet;
idOf(ordinal: number): string | null;
ordinalOf(id: string): number | undefined;
hiddenTagNames(): string[];
```

供 `Query` 的 `ScopeResolver` 與 `Mutation` 的批次遍歷組合。

## 內部檔案結構(扁平,無 `/internal`)

```
lib/database/
  index.ts          ← 只匯出 class Database（＋ 實體型別 re-export）
  store.ts          ← class Database 本體（三組原語 + 靜態生命週期 + dirty/flush）
  bitmap.ts         ← class BitSet
  ordinal.ts        ← class OrdinalRegistry
  facet-index.ts    ← class FacetIndex
  serialization.ts  ← 序列化（見下,非 grab-bag）
  types.ts          ← 實體型別：DBData / ImageRecord / ImageWithId / TagMeta
```

- 子檔只被 `store.ts`(及彼此)取用,**不對模組外匯出**;模組外一律只 `import { Database }`。
- **序列化收斂、不散落**(修正舊 `schema.ts` 的 grab-bag 反例):`serialization.ts` 對 `store.ts` 只露最小面 —— 整檔的 `parseDBData` / `emptyDBData`,以及 tagMeta 稀疏↔完整的 codec(`hydrate` / `prune` / `DEFAULT_TAG_META` 綁成一個內聚單位,不各自裸 export)。**驗證不在這裡**(搬去 `mutation` 的私有 `Validator`;序列化寬容、驗證嚴格,哲學相反,不同家)。

## 序列化(內部,寬容哲學)

`parseDBData` / `emptyDBData` / `DB_VERSION`(=2,v1/v2 相容、壞紀錄寬容跳過) / tagMeta codec(`hydrate` ↔ `prune`、`DEFAULT_TAG_META`)。
`load` 的寬容解析與 `flush` 成對,住 database 內部。稀疏是 tagMeta 的**序列化格式**,故 norm/denorm 屬此。

## 資料流(兩個方向)

- **讀**(disk→可操作):bytes ──反序列化──► 真相 ──`rebuild`──► 投影;`Query` 再用投影(哪些)+ 真相(什麼)。
- **寫**(可操作→disk):動詞 正規化/不變式 ──►(`setImage` 寫真相 + `indexAdd/Remove` 同步投影 + `markDirty`)──`flush`序列化──► bytes。
