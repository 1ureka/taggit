# 2.1.0 實作計畫

本目錄拆解 [`draft.md`](../draft.md) 中 2.1.0 的部分項目，每個項目一份計畫。

| # | 項目 | 計畫 | 主要涉及層 |
|---|------|------|-----------|
| 4 | 切換 collection 時清空快取 | [4-clear-cache-on-switch.md](./4-clear-cache-on-switch.md) | collection / image 模組 |
| 7 | 顯示當前 collection 名稱 | [7-current-collection-name.md](./7-current-collection-name.md) | layout |
| 8 | 導航 dialog 顯示 committed / staged 數量 | [8-nav-dialog-counts.md](./8-nav-dialog-counts.md) | layout + 新 API |

## 架構重寫（跨項目）

項目 0（隱藏標籤）上線後浮現的結構性問題：標籤的「篩選」與「編寫／管理」兩種角色共用同一條遮蔽資料通道。收斂為「兩實體、兩引擎」的 database 重寫：

- [0_database-rewrite.md](./0_database-rewrite.md) — **已完成**：`Tag` 實體 + `queryImages`/`queryTags` 兩引擎 + 共用 `resolveScope`；刪除 `TagFacet`/`getAllTagFacets` 等冗餘型別與介面。

## 共通慣例（撰寫計畫時已對照現有程式）

- **模組邊界**：外部只能 import 各模組的 `client.ts` / `server.ts`，`internal/` 不對外。(*註1)
- **API 回應格式**：`{ ok, data? , error? }`，前端一律走 `$lib/utils/client.ts` 的 `api.{get,post,patch,del}`。
- **狀態邏輯**：頁面互動邏輯放在同名 `*.svelte.ts` 的 class（Runes），元件 `.svelte` 只負責渲染與綁定。
- **資料流**：伺服器變更後前端以 `invalidateAll()` 重新載入 page data。
- **語言**：註解、文案、log 皆為繁體中文。

> 註1: 見 `$lib/{collection,database,image}`

## 建議實作順序

4 →（獨立、低風險，先清掉正確性問題）
7 → 8（都動 layout，可一起做）
