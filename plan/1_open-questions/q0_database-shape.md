# Q0 — database 層的樣貌(概覽,非問題)

> 這份不是待決問題,是把 Q1–Q5 定案後 database 層「長什麼樣」收成一張圖,當其餘題的共同背景。
> 核心命題:**database 提供恰到好處的積木(原語),CRUD 是 query/mutation 在這些原語上組出來的。**

## 1. database 的角色:authority-free 引擎

- **持有**:兩份真相(write model)+ 衍生投影(read model)+ 生命週期 + 序列化。
- **不持有**高階動作:`resolveScope`(讀)、索引維護組合(寫)由 query / mutation 用原語**組出**,database 不收 → 因此保持小。
- 類比:Postgres 的 access method 提供原語,planner(讀)與 executor(寫)各自組合。

## 2. 兩份真相(write model / 權威)

| 真相 | 鍵 | 儲存形態 | 讀取是否要正規化 |
|---|---|---|---|
| `images` | id | **完整**(parseImages 保證欄位齊全) | 否 —— 裸 map 查找 |
| `tagMeta` | name | **稀疏**(pruneTagMeta 只留非預設) | **是** —— 讀時要補回預設 |

這張表的最後一欄,就是 Q5 與後面 §6 的全部根源。

## 3. 衍生投影(read model / 只從 images 推導)

- 序號宇宙 + 位元圖:`tag→bitset`、`rating→bitset`、`live`。
- 只從 `images` 單向推導、可 `rebuild` 無損重建、**永不是權威**。
- 注意:**`tagMeta` 不在投影裡**。它是真相、不是索引;`hidden` 只是在**查詢時**參與遮蔽,tagMeta 這筆紀錄本身沒有任何衍生索引。

## 4. 原語表(策劃過的積木)

| 群組 | 原語 | 說明 |
|---|---|---|
| **真相 CRUD**(對稱、完整業務型別) | `getImage` / `setImage` / `deleteImage`(by id,`ImageRecord`) | 完整讀寫、覆寫語意,無正規化 |
| | `getTagMeta` / `setTagMeta` / `deleteTagMeta`(by name,`TagMeta`) | **介面與 image 完全對稱(完整 `TagMeta` 進出)**;稀疏 norm/denorm 藏在原語內部 |
| **索引原子** | `indexAdd` / `indexRemove` | 單筆進出序號 + 位元圖(含墓碑壓實) |
| **投影查詢** | `tagBits` / `ratingRange` / `live` / `idOf` / `ordinalOf` / `hiddenTagNames` | 位元圖與序號的唯讀取用 |
| **一致性** | `rebuild` | 「索引純由 images 推導」這個契約本身 |
| **生命週期** | `ensureLoaded` / `isLoaded` / `requireLoaded` / `flush` | 單例 + HMR;取用口見 [Q1](./q1_singleton-lifecycle.md);`filePath` 私有 |
| **序列化** | `parseDBData` / `emptyDBData` / `DB_VERSION` / `DEFAULT_TAG_META` / `pruneTagMeta`(+ 讀取側孿生:補預設) | 儲存格式的 norm/denorm;load 的寬容解析與 flush 成對 |

## 5. 那條線:原語 vs 動詞(不是 index vs CRUD)

真正的分界是 **儲存機制(primitive)vs 政策(verb)**:

- **原語** = authority-free、policy-free 的儲存機制:真相 CRUD、索引原子、rebuild、序列化。**真相 CRUD 與索引維護是兩組不同的原語**——真相 get/set/delete 只碰真相 slot、不碰投影;索引同步(indexAdd/indexRemove)是另一組。
- **真相 CRUD 一律吃吐「完整業務型別」、覆寫語意**:`setImage(id, rec: ImageRecord)` / `setTagMeta(name, meta: TagMeta)` 不收 partial。**合併/patch 是動詞的事**:想改一部分的動詞先 `get`(拿到完整基底)→ 覆蓋要改的欄位 → 交回完整值。`get` 對缺席鍵也回完整(tag 回 DEFAULT hydrate 後的值),所以「新建」與「更新」對動詞是同一個 read-overlay-write。
- **動詞**(query / mutation)= 用原語組合,再疊上 policy:
  - query:`resolveScope`、materialize、count、sort、分頁。
  - mutation:不變式(樂觀併發、最後一個標籤)、輸入驗證、`get`→覆蓋→`set` 的合併、索引維護的組合、回 Result。

例(mutation 動詞如何坐在原語上):

```
updateRecord(動詞) = getImage(原語,拿完整基底)
                   + 不變式(樂觀併發)+ 覆蓋 patch → 完整 ImageRecord(policy)
                   + setImage(原語) + indexRemove/indexAdd(原語) + markDirty(原語)
```

## 6. 定案:對稱的完整型別真相 CRUD,稀疏藏在原語內部

Q5 的深層結論。決定原則:**database 的 get/set/delete 一律對「完整業務型別」操作、名稱完全對稱(`getImage`/`getTagMeta`…)。稀疏儲存是被藏起來的實作技術,呼叫端永遠不必知道。**

### 為什麼 default / prune / hydrate 屬 database(最本質的理由)

**原語的介面契約是「完整業務型別」,稀疏只是被隱藏的實作;而 default 正是「完整 ⇄ 稀疏」轉換的一部分,所以它跟著實作住在 database。** 這是純 information hiding:

- 這個記憶體設計**沒有 RDBMS 那層獨立 storage schema**,slot 直接裝 domain 型別 → raw get/set 天生吃吐完整業務型別。
- image 的 raw slot 剛好就是完整 `ImageRecord`,零轉換。
- tagMeta 當初用稀疏儲存,等於偷開了一個「mini storage schema」與 domain 型別分家。把介面對齊回完整 `TagMeta`,就是**把這個分家收進 database 內部**;`DEFAULT_TAG_META` / `pruneTagMeta` / hydrate 是維持這個乾淨介面的內部零件。

### image vs tag:介面對稱、實作不對稱

| | 介面 | 內部實作 |
|---|---|---|
| `getImage`/`setImage` | 完整 `ImageRecord` 進出 | dumb(raw 就是 complete,零轉換) |
| `getTagMeta`/`setTagMeta` | **完整 `TagMeta` 進出(與 image 完全對稱)** | **不 dumb** —— 內部 hydrate(get,缺席回 DEFAULT)/ prune(set,存稀疏) |

選的是**介面對稱**而非實作對稱:用「tag 原語內部多做一點」換「呼叫端完全不必碰稀疏」。另一條路(把 raw `Partial<TagMeta>` 露出去)會把稀疏這個儲存技術洩漏給每個呼叫端 —— 正是要避免的。

### 覆寫 vs 合併:原語只做覆寫,合併上移為動詞

- **原語 `setTagMeta(name, meta: TagMeta)` 吃完整、覆寫**,和 `setImage` 一樣。
- **想「只改 hidden、不動別的」= 動詞的事**:動詞先 `getTagMeta(name)`(缺席也回完整 DEFAULT)→ 覆蓋 → 交回完整 —— 與 image 的 `updateRecord` read-overlay-write 同構。今天 `TagMeta` 只有 `hidden`,覆寫與 patch 看起來一樣;等它長出 color/alias 這條線才顯形。
- 這使「上層原本預期 update 就自己組好完整型別、不能缺」**可達成**:因為 `get` 永遠回完整基底,動詞總能 read → overlay → write 完整值。這也正是現有程式已在做的(`{ ...existing, ...changes }`),原則只是讓原語的簽章**強制**完整、讓 partial 無法混進來。

### Q5 的兩個症狀如何一次消掉

- `getTagMeta`(hydrate)成為 database 原語 → query 的 `tagMetaOf` 與 mutation 的 `getTagMeta` 不再各造一份(重複消失)。
- 真相 CRUD 全在 database、對稱命名 → mutation 不再對外露出任何「讀」,`setTagMeta` 也不再是「感覺放錯地方的東西」,它本來就是原語。

一句話:**它們感覺不屬於 mutation,是因為它們本來就是原語 —— 只是 tag 的原語為了維持與 image 對稱的完整型別介面,把稀疏 norm/denorm(含 default)藏在了自己內部。**
