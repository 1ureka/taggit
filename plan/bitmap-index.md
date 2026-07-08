# Bitmap Index 基礎建設

本文件定義取代倒排索引的位元圖索引：BitSet 實作、ID ↔ 序號管理、
查詢管線與 facet 計數、複雜度與容量分析。模組歸屬見 [architecture.md](./architecture.md) §3
（`database/internal/` 的 `bitmap.ts`、`ordinal.ts`、`facet-index.ts`、`query.ts`）。

---

## 1. 為什麼換掉倒排索引

現有 `tagIndex: Map<string, Set<string>>` 的問題：

- 交集 / 差集是 `Set` 逐元素運算，`intersectTags` 還需先複製每個 Set；
- faceted search 的核心操作 ——「對目前結果集，計算**每一個**標籤的命中數」——
  在 Set 表示下是 O(標籤數 × 結果集大小) 的雜湊查找，無法接受；
- 圖片 ID 是任意字串（檔名），集合運算的每一步都在操作字串雜湊。

位元圖把「一個標籤擁有哪些圖片」表示為一串 bit（第 n 個 bit = 序號 n 的圖片是否擁有該標籤），
交集 = 逐字 AND、排除 = ANDNOT、計數 = popcount，全部是對 `Uint32Array` 的線性掃描，
一次處理 32 張圖片，且 facet 計數不需要物化任何中間集合。

2.0.0 **完全刪除** `tagIndex` 與其維護程式碼（`indexAdd` / `indexRemove` / `buildIndexes`
的 Set 版本、`intersectTags` / `differenceTags`），不保留雙軌。

---

## 2. ID 與序號（ordinal）

位元圖需要稠密整數下標，但 db.json 的鍵、API 的參數、URL 全部是字串 ID（檔名）。
兩者的橋接規則：

- **序號純屬記憶體，永不持久化**。db.json 的格式與鍵完全不變，
  對外世界（前端、API、URL）永遠只看得到字串 ID。
- `OrdinalRegistry`（`ordinal.ts`）維護三份資料：

  ```ts
  ids:  (string | null)[]        // 序號 → ID；null 為墓碑
  map:  Map<string, number>      // ID → 序號
  live: BitSet                   // 目前存活的序號全集
  ```

- **載入 collection 時**：依 `Object.keys(images)` 的順序從 0 起連續指派序號並重建全部位元圖。
- **新增紀錄**：`ordinal = ids.length`，append；容量不足時位元圖按倍增策略擴容。
- **刪除紀錄**：`ids[o] = null`（墓碑）、`map.delete(id)`、`live.clear(o)`，
  各標籤位元圖中的該 bit 一併清除。序號**不重用**，避免任何懸掛 bit 造成錯配。
- **壓實（compaction）**：墓碑數 > 存活數時，重新指派連續序號並重建全部位元圖
  （成本 O(圖片數 × 平均標籤數)，萬張規模下毫秒級）。載入 collection 一律視為壓實。

序號因此是「單一載入週期內有效的內部座標」，不存在跨啟動一致性問題 ——
這就是草稿中「ID 與序號的問題」的解法：不解決持久化映射，而是讓映射根本不需要持久化。

---

## 3. BitSet（`bitmap.ts`）

自製 `Uint32Array` 位元圖，不引入外部依賴（Roaring 等壓縮位元圖在本專案量級下
只有複雜度沒有收益；§6 有數字）。介面：

```ts
class BitSet {
  constructor(capacityBits: number)
  set(i): void;  clear(i): void;  has(i): boolean
  size(): number                        // popcount（逐字 popcount32）
  clone(): BitSet
  andInPlace(o: BitSet): this           // 交集
  andNotInPlace(o: BitSet): this        // 差集
  orInPlace(o: BitSet): this            // 聯集
  andSize(o: BitSet): number            // popcount(this AND o)，不配置記憶體 —— facet 專用
  *values(): Iterable<number>           // 迭代 set bits（序號）
  ensureCapacity(bits: number): void    // 倍增擴容
  isEmpty(): boolean
}
```

`andSize` 是 faceted search 的熱路徑：單次融合 AND + popcount，
不產生中間 BitSet，這是位元圖方案效能主張的核心。

---

## 4. FacetIndex（`facet-index.ts`）

維護所有查詢用位元圖，與 `OrdinalRegistry` 同生命週期：

```ts
tagBits:    Map<string, BitSet>     // 標籤 → 位元圖（惰性建立，空了就刪）
ratingBits: BitSet[6]               // 評分 0..5 各一張位元圖
live:       BitSet                  // 引用 OrdinalRegistry.live
```

維護點與現有 `indexAdd` / `indexRemove` 一一對應：

- `add(ordinal, record)`：對 `record.tags` 各標籤 set bit；`ratingBits[rating]` set bit。
- `remove(ordinal, record)`：對應 clear；標籤位元圖清空後刪除 Map 項目。
- `update` = remove 舊紀錄 + add 新紀錄（沿用現有 mutation 的先移除後加入模式）。
- `renameTag` / `deleteTag`：批次改寫紀錄後整表重建（與現制 `buildIndexes` 相同策略）。

評分位元圖讓 `rating gte/lte/eq` 篩選變成 1~6 張位元圖的 OR，
取代現有對候選集逐一讀 `record.rating` 的迴圈。

**hidden 遮罩**：查詢時對「hidden 且不在 `includedTags` 中」的每個標籤，
將其位元圖 ANDNOT 出結果集（語義與資料來源見 [tag-metadata.md](./tag-metadata.md)）。
hidden 標籤數量預期極少（個位數），遮罩即時計算，不做快取。

---

## 5. 查詢管線（`query.ts`）

`queryImages` 重寫為固定順序的管線；輸出型別在現有 `QueryResult` 上增加 `facets`：

```
1. base = live.clone()
2. includedTags：對每個標籤 andInPlace(tagBits[t])；任一標籤無位元圖 → 空結果（維持現語義）
3. excludedTags：andNotInPlace(tagBits[t])（不存在則忽略，維持現語義）
4. hidden 遮罩：對每個 hidden 且 ∉ includedTags 的標籤 h：andNotInPlace(tagBits[h])
5. rating：andInPlace(OR(ratingBits[范圍]))
6. search（名稱子字串）：位元圖無法表達 → 迭代候選序號，對 record.name 後置過濾；
   結果收斂回一個 BitSet（供 facet 計算使用）
7. facets：對 tagBits 每個標籤 t，count = result.andSize(tagBits[t])；
   count > 0 者進入 facets，附 { name, count, hidden }，依 count desc、name asc 排序
8. 物化：序號 → ID → ImageWithId，沿用現有 sortImages（含 random 洗牌）與分頁邏輯
```

```ts
interface TagFacet { name: string; count: number; hidden: boolean }
interface QueryResult {
  items: ImageWithId[]; total: number; page: number; pages: number;
  facets: TagFacet[];    // 新增：目前篩選結果下各標籤的命中數
}
```

facet 語義採標準 faceted search 定義：`count` = 「在目前結果集中擁有該標籤的圖片數」，
亦即把該標籤加入 AND 篩選後的結果筆數。前端據此同時獲得
自動完成候選（取代 `tagCache`）與「加選這個標籤還剩幾張」的提示能力。

hidden 標籤的 facet 例外：對 hidden 標籤 h 而言，「把 h 加入篩選」會同時把 h
從 hidden 遮罩中移除，因此其 count 不能用第 7 步的通用公式。
單獨為每個 hidden 標籤重算：以第 3 步結束的集合為基底，套用「hidden 遮罩排除 h 自身」
後再 `andSize(tagBits[h])`。hidden 標籤數極少，額外成本可忽略。

`queryTags`（標籤列表頁 / 樣本卡片）同步重寫：

- `count` = `live.andSize(tagBits[t])` 扣除 hidden 遮罩（遮罩排除 t 自身），
  與 facet 語義一致 —— 標籤卡片顯示的數量必須等於點進去後看到的張數；
- 樣本抽選：候選 = `tagBits[t] AND live ANDNOT hidden遮罩(排除 t)`，
  之後的 stable / recent / random 抽樣邏輯沿用現制；
- 搜尋、minCount/maxCount、排序、分頁邏輯沿用現制。

---

## 6. 複雜度與容量（可行性數據）

設 N = 圖片數、T = 標籤數、W = ⌈N / 32⌉（每張位元圖的字數）。

| 項目 | 成本 | N = 10,000, T = 1,000 | N = 100,000, T = 2,000 |
| --- | --- | --- | --- |
| 單張位元圖記憶體 | 4W bytes | 1.25 KiB | 12.5 KiB |
| 全部標籤位元圖 | 4W(T+7) bytes | ~1.3 MiB | ~25 MiB |
| 一次 AND / ANDNOT | O(W) | 313 字 | 3,125 字 |
| 全標籤 facet 計數 | O(T × W) | ~0.3M 字運算，« 1 ms | ~6M 字運算，約 1–5 ms |
| 載入時全量重建 | O(N × 平均標籤數) | 毫秒級 | 數十毫秒 |

結論：目標量級（個人收藏，萬張 / 千標籤）下所有操作都在毫秒級、記憶體個位數 MiB，
未壓縮 `Uint32Array` 位元圖綽綽有餘。物化 + 排序（第 8 步）與現制相同，仍是
O(結果數 log 結果數)，不因本次改動變差。

---

## 7. 失效模式與防護

- **序號錯配**（bit 指到別張圖）是本設計唯一的新風險。防護：序號不重用 + 刪除即全索引清 bit +
  壓實/載入時整體重建；`store.ts` 提供 `rebuildIndexes()` 作為所有批次異動
  （rename/delete tag、匯入完成）後的統一收斂點，延續現有 `buildIndexes()` 的保守策略。
- **擴容遺漏**：所有位元圖經 `FacetIndex` 統一持有，新增序號時由 FacetIndex 對
  全部位元圖呼叫 `ensureCapacity`，不允許散落各處的 BitSet。
- **與 db.json 的一致性**：位元圖是純衍生資料，永不寫盤；任何懷疑不一致的場景
  （載入、壓實、批次異動）都以重建解決，重建成本已在 §6 證明可接受。
