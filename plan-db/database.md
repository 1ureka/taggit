# lib/database — 引擎(authority-free)

持有兩份真相 + 衍生投影,對外只給**策劃過的原語**;負責 `rebuild`、生命週期、序列化。
**不持有**高階動作(`resolveScope`、索引維護的組合由 query / mutation 用原語組出)→ 因此保持小。
推導見 [../plan/1_open-questions/q0_database-shape.md](../plan/1_open-questions/q0_database-shape.md)。

## 真相(write model / 權威)

| 真相 | 鍵 | 型別 | 儲存形態 |
|---|---|---|---|
| images | id | `ImageRecord` | 完整 |
| tagMeta | name | `TagMeta` | 稀疏(但**介面為完整型別**,見下) |

## 投影(read model / 衍生)

序號宇宙 + 位元圖(`tag→bitset`、`rating→bitset`、`live`)。只從 `images` 單向推導、可 `rebuild`、**永不權威**。
`tagMeta` **不在**投影裡(它是真相,不是索引)。

## 原語 A:真相 CRUD —— 對稱、完整業務型別、覆寫語意

```ts
class Database {
  // images by id
  getImage(id: string): ImageRecord | null;
  setImage(id: string, rec: ImageRecord): void;      // 覆寫;呼叫端組好完整 ImageRecord
  deleteImage(id: string): void;

  // tagMeta by name —— 介面與 image 完全對稱
  getTagMeta(name: string): TagMeta;                 // 缺席鍵回 DEFAULT_TAG_META,永遠回完整
  setTagMeta(name: string, meta: TagMeta): void;     // 吃完整 TagMeta;內部 prune 存稀疏
  deleteTagMeta(name: string): void;
  // …(原語 B/C 見下)
}
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

真相 CRUD 只碰真相 slot、**不碰投影**;索引同步是這組。mutation 動詞在寫真相後**組合**它們(只有 image 需要;tagMeta 無投影)。

## 原語 C:投影查詢(唯讀)

```ts
tagBits(name: string): BitSet | null;
ratingRange(from: number, to: number): BitSet;
get live(): BitSet;
idOf(ordinal: number): string | null;
ordinalOf(id: string): number | undefined;
hiddenTagNames(): string[];
```

供 query 的 `resolveScope` 與 mutation 的批次遍歷組合。

## 生命週期(單例 + HMR;模組層級 API)

```ts
function requireLoaded(): Database;          // 取用口:回已載入實例(Q1);未載入 = route 沒守好的 bug 情境
function ensureLoaded(dbPath: string): void; // hooks 每個 request 前
function isLoaded(): boolean;
function flush(): void;                       // debounce + atomic write(hooks 關閉訊號 / 備份前)
```

- 單例存 `globalThis.__db`(扛 HMR);**query / mutation 不碰單例**,只認傳入的 `db`(authority-free、可注入假 db 測試)。
- 綁定路徑 **`filePath` 為私有內部欄位**(原 `currentDbPath`,外部零呼叫端;「當前 collection 的硬碟路徑」職責屬 `collection` 模組)。
- **not-load 完全 route 守衛**;`requireLoaded` 正常拿得到,拿不到屬 bug → throw 到框架邊界。

## 序列化(內部)

`parseDBData` / `emptyDBData` / `DB_VERSION`(=2,v1/v2 相容、壞紀錄寬容跳過) / `DEFAULT_TAG_META` / `pruneTagMeta` / hydrate。
`load` 的寬容解析與 `flush` 成對,住 database 內部。稀疏是 tagMeta 的**序列化格式**,故 norm/denorm 屬此。

## 資料流(兩個方向)

- **讀**(disk→可操作):bytes ──反序列化──► 真相 ──`rebuild`──► 投影;query 再用投影(哪些)+ 真相(什麼)。
- **寫**(可操作→disk):動詞 正規化/不變式 ──►(`setImage` 寫真相 + `indexAdd/Remove` 同步投影 + `markDirty`)──`flush`序列化──► bytes。
