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
| **真相存取** | image by id:get / set / delete | 完整讀寫,無正規化 |
| | tagMeta by name:get / set / delete | **get 補預設(反正規化)、set 剝預設(正規化,維持稀疏)** |
| **索引原子** | `indexAdd` / `indexRemove` | 單筆進出序號 + 位元圖(含墓碑壓實) |
| **投影查詢** | `tagBits` / `ratingRange` / `live` / `idOf` / `ordinalOf` / `hiddenTagNames` | 位元圖與序號的唯讀取用 |
| **一致性** | `rebuild` | 「索引純由 images 推導」這個契約本身 |
| **生命週期** | `ensureLoaded` / `isLoaded` / `requireLoaded` / `flush` | 單例 + HMR;取用口見 [Q1](./q1_singleton-lifecycle.md);`filePath` 私有 |
| **序列化** | `parseDBData` / `emptyDBData` / `DB_VERSION` / `DEFAULT_TAG_META` / `pruneTagMeta`(+ 讀取側孿生:補預設) | 儲存格式的 norm/denorm;load 的寬容解析與 flush 成對 |

## 5. 那條線:原語 vs 動詞(不是 index vs CRUD)

真正的分界是 **儲存機制(primitive)vs 政策(verb)**:

- **原語** = authority-free、policy-free 的儲存機制:真相 get/set/delete、索引原子、rebuild、序列化。索引維護只是其中**一種**機制;真相 get/set 是**另一種**。
- **動詞**(query / mutation)= 用原語組合,再疊上 policy:
  - query:`resolveScope`、materialize、count、sort、分頁。
  - mutation:不變式(樂觀併發、最後一個標籤)、輸入驗證、索引維護的組合、回 Result。

例(mutation 動詞如何坐在原語上):

```
commitRecord(動詞) = 驗證(policy)
                   + setImageRecord(原語) + indexAdd(原語)
                   + markDirty(原語)
```

## 6. 為什麼 tagMeta 的 get/set「塌回」原語(getTagMeta/setTagMeta 的定位)

這是「積木 vs CRUD」那條線最微妙的地方,也是 Q5 的深層答案。

**image 的 get/set 永遠被動詞包起來**,因為寫一張 image **一定**連帶:
1. 維護索引(indexAdd/indexRemove)—— 有衍生投影要同步;
2. 檢查不變式(樂觀併發、找不到…)。

有這兩層 policy 可疊,所以 image 的真相 get/set 從不單獨出現,總是藏在 `commitRecord`/`updateRecord` 這些動詞裡。

**tagMeta 是「裸真相」**:
- **沒有任何投影/索引從它推導** → 寫它不需要維護任何索引;
- **目前沒有不變式** → 寫它不需要檢查什麼。

沒有 policy 可疊,它的 get/set 就**直接塌成原語** —— 純粹是「這份稀疏真相的 norm/denorm 存取」。這正是:
- `getTagMeta`(讀 + 補預設)= 讀取側反正規化,是 `pruneTagMeta`(寫入側正規化)缺失已久的**孿生**。缺了它,query 的 `tagMetaOf` 與 mutation 的 `getTagMeta` 只好各造一份 → Q5 的重複。
- `setTagMeta`(合併 + 剝預設 + 寫入 + markDirty)= 寫入側正規化,同樣是儲存機制。

### 定位結論

- **讀(`getTagMeta`)= 純原語**,直接放 database,query 與(未來的)mutation 都向它拿。重複與「一個讀住在 mutation」同時消失。
- **寫(`setTagMeta`)= 原語機制**。它今天無驗證,就是個原語;但因為它是**寫**,而寫是不變式未來會長出來的地方(若 `TagMeta` 加顏色/別名等需驗證的欄位),保險做法是:**norm+write 這個機制放 database 原語,對外的公開寫入仍走一層薄 mutation 動詞**(如同 image 的寫永遠走動詞、不讓 route 碰裸 setRecord)。今天那層動詞是 pass-through,未來在原語上疊驗證即可,呼叫端不變。

一句話:**getTagMeta/setTagMeta 之所以「感覺不屬於 mutation」,是因為它們本來就是原語 —— tagMeta 是沒有投影、沒有不變式的裸真相,它的存取沒有 policy 可疊,自然落在線的原語側。**
