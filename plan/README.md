# 2.X.X 實作計畫

本目錄拆解 [`draft.md`](../draft.md) 中 2.X.X 的部分項目，每個項目一份計畫。

| # | 項目 | 計畫 | 主要涉及層 |
|---|------|------|-----------|
| 2 | 匯入紀錄改為先顯示引導說明 modal | [2-import-guide-modal.md](./2-import-guide-modal.md) | tagger 頁 |
| 5 | 導航 dialog 顯示 committed / staged 數量 | [5-nav-dialog-counts.md](./5-nav-dialog-counts.md) | layout + 新 API |

## 架構重寫（跨項目）

項目 0（隱藏標籤）上線後浮現的結構性問題：標籤的「篩選」與「編寫／管理」兩種角色共用同一條遮蔽資料通道。收斂為「兩實體、兩引擎」的 database 重寫：

- [0_database-rewrite.md](./0_database-rewrite.md) — **已完成**

## 共通慣例（撰寫計畫時已對照現有程式）

- **模組邊界**：外部只能 import 各模組的 `client.ts` / `server.ts`，`internal/` 不對外。(*註1)
- **API 回應格式**：`{ ok, data? , error? }`，前端一律走 `$lib/utils/client.ts` 的 `api.{get,post,patch,del}`。
- **狀態邏輯**：頁面互動邏輯放在同名 `*.svelte.ts` 的 class（Runes），元件 `.svelte` 只負責渲染與綁定。
- **資料流**：伺服器變更後前端以 `invalidateAll()` 重新載入 page data。
- **語言**：註解、文案、log 皆為繁體中文。

> 註1: 見 `$lib/{collection,database,image}`
