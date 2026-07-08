# 2.0.0 規劃總覽 — 模組化重寫 + Bitmap Index + SSR Faceted Search

本文件是 2.0.0 的總入口，彙整目標、範圍、整體架構、工作分解與驗收標準。
各主題的詳細設計拆分於：

| 文件 | 內容 |
| --- | --- |
| [architecture.md](./architecture.md) | 三大業務模組的邊界、資料夾結構、`server.ts` + `client.ts` 入口約定、依賴規則與可測試性 |
| [bitmap-index.md](./bitmap-index.md) | Bitmap Index 基礎建設：BitSet 實作、ID ↔ 序號管理、查詢管線、facet 計算、複雜度與容量分析 |
| [ssr-data-flow.md](./ssr-data-flow.md) | Tag Cache（`createSWR`）完全刪除、SSR faceted search 資料流、API 入口存廢表、前端改動點 |
| [tag-metadata.md](./tag-metadata.md) | db.json v2 格式、標籤元資料框架、`hidden` 語義的精確定義、與舊 db.json 的相容性 |

---

## 1. 目標

1. **業務邏輯模組化**：以資料夾為單位提取 `collection`、`database`、`image` 三大業務模組，
   每個模組對外只有 `server.ts` 與 `client.ts` 兩個入口，內部實作自由拆檔。
   確立各模組職責，使未來可以對單一模組做局部測試與局部重寫。
2. **Bitmap Index 取代倒排索引**：完全刪除現有 `tagIndex: Map<string, Set<string>>` 倒排索引，
   改以序號（ordinal）+ 位元圖（bitset）作為查詢基礎建設，原生支援 faceted search 的計數需求。
3. **標準 SSR Faceted Search**：刪除 `createSWR` / `tagCache` / `client/cache.ts`，
   查詢與篩選一律走 SvelteKit page load（SSR），查詢結果隨附 facet 計數，
   前端自動完成與篩選 UI 直接消費 page data，不再自行 GET。
4. **標籤元資料框架**：db.json 升級為 v2（不影響既有 v1 檔案的可讀性），
   為標籤本身建立元資料存放區，首個欄位為 `hidden`（預設不隱藏）。
   本版只做後端支援，不做前端設定 UI。

### 非目標（2.1.0 以後，本版不處理）

新建圖片命名、狀態欄 defer-pending、檔案總管選取 collection、切換 collection 清空快取、
edit dirty 導航警告、詳細排序、觀看偵測與權重隨機。同時本版**不撰寫自動化測試**，
只要求新架構在結構上可直接引入 vitest 而無須再次重構。

---

## 2. 現況與問題

- 業務邏輯只以 `client/` / `server/` 區分，`db*`、`thumbnail`、`config`、`helpers` 混雜在
  `src/lib/server/` 之下；`getStagedFiles`（跨 db 與檔案系統的組合邏輯）被放在通用 `helpers.ts`。
- `tagIndex` 倒排索引只能回答「哪些圖片有標籤 T」，交集 / 差集靠 `Set` 逐元素運算，
  且無法廉價回答 faceted search 的核心問題：「在目前篩選結果下，每個標籤各命中幾張」。
- 前端標籤資料靠 `client/cache.ts` 的 `createSWR` + `GET /api/tags` 拉取，
  與頁面本身的 SSR 資料流並存，形成兩套失效機制（`tagCache.invalidate()` 與 `invalidateAll()`
  總是成對出現），與 faceted search 的「篩選改變 → 計數改變」模型直接衝突。
- db.json 只有 `images`（圖片 ID → 元資料），標籤本身沒有任何可掛載元資料的位置。

---

## 3. 整體架構（結論）

```
src/lib/
├─ collection/            # 模組一：當前 collection 的身分與結構
│  ├─ server.ts           #   入口：讀寫 server.json、驗證/初始化目錄結構、衍生路徑
│  ├─ client.ts           #   入口：collection 路徑歷史（localStorage）
│  └─ internal/…
├─ database/              # 模組二：db.json ↔ 記憶體元資料的管理與溝通
│  ├─ server.ts           #   入口：load/flush、queryImages/queryTags（直接吃 URLSearchParams）、
│  │                      #        commit/update/remove、renameTag/deleteTag/setTagMeta
│  ├─ client.ts           #   入口：查詢參數的 build/parse/物件化（前端特化包裝）+ 型別 re-export
│  └─ internal/…          #   store / schema / ordinal / bitmap / facet-index / query / mutation / params
├─ image/                 # 模組三：實際圖片檔案的處理與溝通
│  ├─ server.ts           #   入口：縮圖、原圖串流輔助、readImageInfo（尺寸/blurhash/檔案大小）、
│  │                      #        列目錄圖檔、快取管理
│  ├─ client.ts           #   入口：imgSrc（定義前端如何要求圖片）
│  └─ internal/…
├─ components/、ui/、virtualizer/、icons/、styles/   # UI 層，不變
├─ client/dom.ts、client/blurhash.ts                 # 通用前端工具，保留
└─ utils.ts、types.ts                                # 通用工具與跨領域型別（查詢型別移入 database）
```

職責一句話版（詳見 [architecture.md](./architecture.md)）：

- **collection** 管「現在是哪個 collection、目錄結構對不對」，不在意 db.json 內容是否合法。
- **database** 管「在給定的 db.json 檔案下，紀錄怎麼查、怎麼改、怎麼持久化」，
  不在意 id 是不是檔名、實際圖片存不存在；只要求 id 唯一。
- **image** 管「在給定的 collection 目錄下，怎麼找到圖檔、壓縮、產生元資料、讓前端要求圖片」，
  不在意這張圖在 db.json 有沒有紀錄。
- 需要同時碰兩個模組的邏輯（提交圖片要存元資料、列出 staged 檔案），
  一律上移到 API route / page load 層組合，模組之間不互相 import。

資料流（詳見 [ssr-data-flow.md](./ssr-data-flow.md)）：

```
瀏覽器 goto(?includedTags=…)            瀏覽器 api.post/patch/del(mutation)
        │                                        │ 成功後 invalidateAll()
        ▼                                        ▼
+page.server.ts ── database/server.queryImages(url.searchParams)
        │              └─ Bitmap 查詢管線 → { items, total, pages, facets }
        ▼
page data ──> 列表/篩選欄/自動完成（全部吃同一份 SSR 資料，無 client cache）
```

---

## 4. 工作分解

依賴順序排列；P2 是最大塊，P1 / P3 彼此獨立、可先行。

### P1 — collection 模組（小）

- 建立 `src/lib/collection/`：`server.ts` 收容現 `server/config.ts` 全部職責
  （server.json 讀寫、`collectionRoot`、`isCollectionValid`、`getCollectionPaths`）。
- `client.ts` 收容現 `client/localStorage.ts` 的路徑歷史（`pathHistory` 是「使用者用過哪些
  collection」的狀態，屬 collection 模組；未來若要改存 server.json，只動這個模組）。
- `IMG_EXTS` / `MIME_TYPES` 移入 image 模組（見 P3），config.ts 原檔刪除。

### P2 — database 模組（大，本版核心）

- 建立 `src/lib/database/` 與 internal 檔群：`schema.ts`（v1/v2 解析、TagMeta）、
  `store.ts`（記憶體狀態 + dirty/flush + load）、`ordinal.ts`（ID ↔ 序號）、
  `bitmap.ts`（BitSet）、`facet-index.ts`（標籤/評分位元圖維護）、
  `query.ts`（faceted 查詢管線）、`mutation.ts`、`params.ts`（URLSearchParams ↔ QueryOptions）。
- 完全刪除 `tagIndex` 倒排索引與 `intersectTags` / `differenceTags`；
  刪除 `server/db.ts`、`db-instance.ts`、`db-query.ts`、`db-mutation.ts`、
  已棄用的 `addRecord`，以及 `utils.ts` 內的查詢參數函式（移入 `params.ts`）。
- db.json v2 + 標籤元資料 + `hidden` 查詢語義（見 [tag-metadata.md](./tag-metadata.md)）。
- `QueryResult` 增加 `facets`；查詢相關型別自 `$lib/types.ts` 移入本模組並由入口 re-export。

### P3 — image 模組（中）

- 建立 `src/lib/image/`：`server.ts` 收容 `thumbnail.ts`（縮圖、blurhash、快取管理）+
  新增 `readImageInfo(filePath)`（stat + 尺寸 + blurhash，一次回傳提交所需的全部檔案側元資料）
  與 `listImageFiles(imagesDir)`（列出目錄中的圖檔，供上層組合出 staged 清單）。
- `client.ts` 收容 `imgSrc`；`resources.ts`（LRU / TaskPool）移入 internal。

### P4 — API 入口與前端重接（中）

- 所有 page load 改呼叫 `database/server.ts`，回傳含 `facets`；
  自動完成改吃 page data（props 注入），刪除 `client/cache.ts`、`createSWR`、`tagCache`。
- 刪除被 SSR 取代的讀取端點：`GET /api/committed`、`GET /api/committed/[filename]`、
  `GET /api/tags`、`GET /api/staged`；保留全部 mutation 端點與 `GET /api/images/[filename]`、
  `/api/settings/*`；新增 `PATCH /api/tags`（設定標籤元資料，僅後端）。
- 提交 / 匯入流程改為 route 層組合 `image.readImageInfo` + `database.commitImage`。

### P5 — 收尾

- `npm run check` 全綠；依 §6 驗收清單手動走查全部頁面；更新 `docs/`、版本號 2.0.0。

---

## 5. 可行性評估（結論：全部可行，無外部依賴新增）

- **規模**：個人 / 局域網使用，實際量級以 10^4 張圖、10^3 個標籤為設計上限。
  BitSet 以 `Uint32Array` 自製（約 150 行），10 萬張圖時單一位元圖 12.5 KiB、
  2000 標籤全量約 25 MiB 上限，實際（1 萬張 × 1000 標籤）約 1.25 MiB — 記憶體無虞。
  單次查詢含全標籤 facet 計數在毫秒級（見 [bitmap-index.md](./bitmap-index.md) §6 的估算）。
- **ID ↔ 序號**：序號純記憶體、載入時重建、刪除採墓碑 + 門檻觸發壓實，
  永不寫入 db.json — 對外（API、URL、db.json）的識別永遠是既有字串 ID，無遷移成本。
- **相容性**：db.json v2 只是「多一個可選的 `tags` 區塊 + version 提升」，
  v1 檔案照常載入且純讀取不觸發改寫；`images` 區塊格式完全不變（見 [tag-metadata.md](./tag-metadata.md)）。
- **前端衝擊**：各頁面本就以 `+page.server.ts` + `goto(query)` + `invalidateAll()` 運作，
  SSR faceted search 是把僅存的兩條旁路（`tagCache`、閒置的讀取 GET）收編進既有模式，
  不是引入新模式；`invalidateAll()` 語義不變、繼續沿用。
- **風險集中點**：P2 一次替換整個查詢/異動核心。對策：新模組完成後以「舊入口檔改為
  轉呼叫新模組」的方式先讓 `npm run check` 與頁面行為穩定，再刪舊檔收尾，
  避免長時間處於半改造狀態。

---

## 6. 驗收標準

結構：

- [ ] `src/lib/{collection,database,image}/` 存在，模組外部程式碼只 import 各模組的
      `server.ts` / `client.ts`（以全域搜尋 `internal/` import 驗證為零筆）。
- [ ] `client/cache.ts`、`createSWR`、`tagCache`、`server/db*.ts`、`server/config.ts`、
      `server/thumbnail.ts`、`server/resources.ts`、`client/localStorage.ts` 皆已刪除或搬遷。
- [ ] 全案搜尋 `tagIndex` 為零筆（倒排索引完全移除）。

行為：

- [ ] home / editor / player / compare / tagger 全頁面：篩選、排序、分頁、隨機皆正常，
      改變篩選後 facet 計數即時反映於自動完成與篩選 UI。
- [ ] tagger 提交、editor 單張/批次編輯與取消提交、settings 改名/刪除標籤、匯入（SSE）皆正常，
      mutation 後畫面經 `invalidateAll()` 取得新資料，無任何殘留的 client 快取行為。
- [ ] 以 v1 db.json 啟動：正常載入；純瀏覽不改寫檔案；首次 mutation 後檔案升為 v2 且
      `images` 區塊逐位元組等價於原本應有的輸出。
- [ ] `PATCH /api/tags` 可設定 `hidden`；帶有 hidden 標籤的圖片在未指定該標籤的任何查詢
      （含不篩選、其他標籤命中、facet 計數、標籤樣本）中都不出現；查詢明確包含該標籤時正常出現。
- [ ] `npm run check` 通過。
