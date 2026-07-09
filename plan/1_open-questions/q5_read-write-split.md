# Q5 — 標籤 metadata 的存取歸屬(已定案)

> 起點是「`getTagMeta`(mutation)與 `tagMetaOf`(query)重複」這個小症狀,往下挖後定案為
> **database 的真相 CRUD 原則**。完整推導見 [q0](./q0_database-shape.md) §6,此處收結論。

## 症狀

同一段「讀 tagMeta + 補預設」寫了兩份:
- `mutation.getTagMeta`(公開,給 route 在 `setTagMeta` 後讀回)
- `query.tagMetaOf`(私有,`queryTags` 逐標籤附 meta 用)

一個**讀**住在**寫**模組,且邏輯重複。

## 根因(非 Tag 特例,是缺一個原語)

不是「這個讀該挑去哪放」,而是 **database 少給了一個讀取原語**:
- database 有寫入側正規化 `pruneTagMeta`(存檔剝預設,維持稀疏),卻**缺對應的讀取側反正規化**(補預設 hydrate)。
- 因為這個 hydrate 原語沒被 database 收編,query 與 mutation 只好各造一份 → 重複。
- 深層原因:tagMeta 稀疏儲存,讀時要 hydrate、寫時要 prune;image 完整儲存,無此需求。所以症狀只出現在 tag —— 它是唯一的稀疏真相。

## 定案

**database 提供對稱、吃吐完整業務型別的真相 CRUD;稀疏是藏在原語內部的實作技術。**

- 原語(名稱與 image 完全對稱):
  - `getTagMeta(name): TagMeta` —— 內部 hydrate,**缺席鍵回 `DEFAULT_TAG_META`**,永遠回完整。
  - `setTagMeta(name, meta: TagMeta)` —— 吃**完整** `TagMeta`、覆寫語意,內部 prune 存稀疏。
  - `deleteTagMeta(name)`。
- `DEFAULT_TAG_META` / `pruneTagMeta` / hydrate 全部**住 database**,是維持「完整型別介面」的內部零件(理由見 q0 §6:介面契約是完整型別,稀疏是被隱藏的實作,default 是完整⇄稀疏轉換的一部分)。
- **合併/patch(只改一欄)是動詞的事**,不是原語:動詞先 `getTagMeta`(拿完整基底)→ 覆蓋 → `setTagMeta`(完整),與 image `updateRecord` 的 read-overlay-write 同構。今天 `TagMeta` 只有 `hidden`,覆寫與 patch 尚不可分。
- **寫入的公開入口仍走一層 mutation 動詞**(如同 image 的寫永遠走動詞、不讓 route 碰裸 `setImage`),未來 `TagMeta` 長出需驗證欄位時,在動詞疊驗證即可,呼叫端不變。今天該動詞近乎 pass-through。

## 兩個症狀一次消掉

- `getTagMeta`(hydrate)成為 database 原語 → `query.tagMetaOf` 與 `mutation.getTagMeta` 不再各造一份。**重複消失。**
- 真相 CRUD 全在 database、對稱命名 → **mutation 不再對外露出任何「讀」**;`setTagMeta` 不再是「感覺放錯地方」,它本來就是原語。

## 呼叫端影響

- `queryTags` 附 meta:改呼叫 `database.getTagMeta(name)`。
- [api/tags](../../src/routes/api/tags/+server.ts) 的「`setTagMeta` 後讀回」:寫走 mutation 動詞、讀走 `database.getTagMeta`。

## 你的回答

已定案(見上)。完整推導 [q0](./q0_database-shape.md) §6。
