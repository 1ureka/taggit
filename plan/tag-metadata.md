# 標籤元資料框架 — db.json v2 與 hidden 標籤

本文件定義 db.json 的 v2 格式、標籤元資料的型別與異動規則、
`hidden` 的精確查詢語義，以及與既有 v1 檔案的相容性策略。
查詢面的實作位置見 [bitmap-index.md](./bitmap-index.md) §4–§5。

---

## 1. db.json v2 格式

```jsonc
{
  "version": 2,
  "images": {
    "photo.png": { "name": "…", "tags": ["a", "b"], "rating": 3, /* …完全不變… */ }
  },
  "tags": {                    // 新增：標籤名稱 → 標籤元資料（稀疏）
    "wip": { "hidden": true }
  }
}
```

規則：

- `images` 區塊的結構、鍵、欄位**與 v1 逐位元組相同**，不做任何改動。
- `tags` 是稀疏表：**只儲存帶有非預設值元資料的標籤**。絕大多數標籤不會出現在這裡；
  查詢一個不在表中的標籤元資料時，得到全預設值。
- `tags` 的鍵不要求對應任何目前使用中的標籤 —— 元資料獨立於標籤的使用狀態存在
  （某標籤的圖片全被刪除後，其 `hidden` 設定保留；該標籤再次被使用時設定自動生效）。

**型別**（`database/internal/types.ts`）：

```ts
/** 標籤本身的元資料。所有欄位皆有預設值，db.json 只存非預設的部分。 */
interface TagMeta {
  /** 隱藏標籤：帶有此標籤的圖片，僅在查詢明確包含此標籤時可見。預設 false。 */
  hidden: boolean;
}

interface DBData {
  version: number;                             // 寫出時固定為 2
  images: Record<string, ImageRecord>;
  tags: Record<string, Partial<TagMeta>>;      // 稀疏
}
```

框架約定：未來新增標籤元資料欄位時，只需（1）在 `TagMeta` 加欄位與預設值、
（2）在 `schema.ts` 的元資料解析函式加上該欄位的驗證 —— 稀疏儲存讓既有檔案自動相容。

---

## 2. 相容性（不影響舊 db.json）

**讀取**（`schema.ts`）：

- `version: 1` 或 `tags` 欄位缺失 → `tags` 以空表載入，其餘照舊。v1 檔案**無條件可讀**。
- `tags` 欄位存在但格式無效 → 記 warn 日誌、以空表載入（與現有 `parseImages` 對壞資料的
  「跳過並警告」策略一致）；無效的個別項目同樣逐筆跳過。
- `hidden` 欄位僅接受 boolean，`false` 視同未設定（寫出時剔除，維持稀疏）。

**寫入**：

- 純讀取（瀏覽、查詢）**永不觸發改寫** —— 現有的 dirty/flush 機制本就只在 mutation 後寫盤，
  載入 v1 不標記 dirty，因此「開舊庫看看」不會動到檔案。
- 首次 mutation 後的寫出即為 v2（`version: 2` + `tags` 區塊）。由於 `images` 不變、
  `tags` 只增不改，v2 檔案被 1.x 版程式讀取時也只是忽略 `tags` 欄位
  （1.x 的載入器只讀 `version` 與 `images`），不存在破壞性。
- 不做啟動時批次遷移、不做備份副本 —— 格式變更是純增量的，沒有需要遷移的內容。

---

## 3. hidden 的精確語義

定義（與草稿一致，以下為實作用的完整展開）：

> 設 H = 目前被標記為 hidden 的標籤集合，Q = 查詢的 `includedTags`。
> 一張圖片 x 被**遮蔽**，若且唯若存在標籤 h ∈ H，使得 x 擁有 h 且 h ∉ Q。
> 被遮蔽的圖片不出現在該查詢的任何輸出中：items、total、pages、facet 計數、標籤樣本。

推論（作為測試場景）：

1. 不帶任何篩選的查詢：所有擁有任一 hidden 標籤的圖片一律不出現。
2. 圖片有標籤 `{a, wip}`，`wip` hidden：查 `includedTags=[a]` 不出現（其他標籤命中也沒用）；
   查 `includedTags=[wip]` 或 `[a, wip]` 出現。
3. 圖片有兩個 hidden 標籤 `{wip, nsfw}`：必須**同時**包含兩者才出現
   （只含 `wip` 時，`nsfw` 仍遮蔽它）。
4. `excludedTags` 與 hidden 無交互：排除只會進一步縮小結果。
5. `queryTags` 的標籤計數與樣本同樣受遮蔽：標籤 `a` 的 count 不含被其他 hidden
   標籤遮蔽的圖片（遮罩計算時排除 `a` 自身）——保證「卡片上的數字 = 點進去的張數」。
6. hidden 標籤本身照常出現在標籤列表與 facets 中（帶 `hidden: true` 旗標）；
   隱藏的是圖片，不是標籤的存在。

實作即 [bitmap-index.md](./bitmap-index.md) §5 管線的第 4 步：
遮罩 = OR{ tagBits[h] : h ∈ H, h ∉ Q }，對結果集 ANDNOT。

---

## 4. 元資料的異動規則（`mutation.ts`）

```ts
setTagMeta(name: string, meta: Partial<TagMeta>): void
getTagMeta(name: string): TagMeta        // 補齊預設值後回傳
```

- `setTagMeta` 合併寫入；寫入後若該標籤的元資料全為預設值，直接刪除該表項（維持稀疏）。
  寫入 `markDirty()`，走既有防抖 flush。
- `renameTag(old, new)`：`old` 的元資料隨改名搬移至 `new`；若 `new` 已有元資料，
  保留 `new` 既有設定、丟棄 `old` 的（改名到既有標籤 = 併入對方，遵從對方的設定）。
- `deleteTag(name)`：一併刪除該標籤的元資料表項。
- `commitImage` / `updateImage` 不觸碰 `tags` 表 —— 圖片帶上一個 hidden 標籤時
  自動被遮蔽，無需任何額外寫入。

---

## 5. API 與範圍界定

- 後端入口：`PATCH /api/tags`，Body `{ name: string, hidden: boolean }`，
  驗證後呼叫 `setTagMeta`，回傳 `{ ok: true, data: { name, hidden } }`。
- `queryImages` / `queryTags` 的回傳在 facet / 標籤項目上附 `hidden` 旗標，
  讓前端有能力標示（但**本版不做**任何設定 UI 與樣式 —— 草稿明定只要後端支援）。
- 驗收：見 [index.md](./index.md) §6 行為清單的 hidden 項目，測試場景以本文 §3 的推論 1–6 為準。
