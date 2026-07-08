# 1_ 待辦：hidden 相關 bug 修復 + 前端 TagAutocomplete 重構

> 前置作業（database 重寫）已完成，見 [0_database-rewrite.md](./0_database-rewrite.md)。
> 底層現在已能表達「編寫／管理語境」的標籤查詢，以下 bug 都變成「呼叫端換組合」而非「新增 API」。
> **本文為計畫，尚未實作。**

## 底層已就緒

`queryTags(conditions?, opts?)` 現在支援：
- `hidden: "ignore"` —— 不遮蔽，供編寫／管理語境。
- `universe: "all"` —— 併入僅有 meta、未使用的 ghost 標籤。

所以「列出全部（含未使用）標籤、含隱藏者」＝ `queryTags(undefined, { hidden: "ignore", universe: "all" })`。四個 bug 的根都在此。

## Bug 修復（皆為「換一個 queryTags 組合」）

| # | 症狀 | 修法 |
|---|------|------|
| 1 | settings「目前隱藏中」清單漏標籤／看不到未使用的 hidden | 資料源改用 `queryTags(undefined, { hidden: "ignore", universe: "all" })`，再 `filter(t => t.meta.hidden)`。 |
| 2 | settings 隱藏管理的選取候選選不到 hidden 標籤 | 該 Autocomplete 的候選改吃上述「編寫語境」清單（見前端重構）。 |
| 3 | tagger 指派標籤候選被遮蔽 | 候選改吃 `queryTags(undefined, { hidden: "ignore", universe: "all" })`（editor 同）。 |
| 4 | editor 編輯／批次標籤候選被遮蔽，但同頁篩選 dialog 需維持遮蔽 | 編輯／批次用「編寫」通道；篩選 dialog（FilterFields）維持「篩選」通道。 |

> 注意 症狀 3/4 的「authoring 通道」count 語義為全庫用量（`hidden:"ignore"`），對編寫時挑既有標籤是合理提示。

## 前端重構（承先前拍板方案）

1. **Autocomplete 去資料化**：不 import database 型別、不讀 `page.data`；改用自有最小型別 `type AutocompleteOption = { name: string; count?: number }`，`candidates` 為必填 prop。
2. **新增 TagAutocomplete（薄 `.svelte`，無 class 檔）**：對外只暴露 `mode: "filter" | "authoring"`（+ 透傳 `tags`/`placeholder`/`variant`/`name`/`id`/`onchange`）；內部依 mode 取對應通道、adapt `Tag → AutocompleteOption` 後傳給 Autocomplete。是唯一碰 page.data 標籤通道之處。
3. **page.data 雙通道 + 改名**：把現在的單一 `facets` 改為一個依 mode 取用的容器，建議
   `PageData.tagCandidates?: { filter?: Tag[]; authoring?: Tag[] }`，TagAutocomplete 以 `page.data.tagCandidates?.[mode] ?? []` 取用（名稱與 `mode` 1:1，解掉先前 `tagOptions` vs `filterFacets` 名稱不對稱的問題）。
   - **遞送採 W1（各頁自算）**：每個需要的頁在 `+page.server.ts` 填自己需要的 key —— query 頁填 `filter: queryTags(params)`；tagger/settings 填 `authoring: queryTags(undefined, { hidden:"ignore", universe:"all" })`；editor 兩者都填。
   - 不採 layout 集中（W2）：因全站以 `invalidateAll` 重載，W2 的「算一次」優勢消失，卻要淌 layout 的 redirect／`/settings` early-return／DB 未載入等特例，且讓 query-only 頁揹不需要的清單。W1 與現有「每頁各自回 facets」慣例一致、更直觀。

### 呼叫點遷移
- `FilterFields.svelte` 的包含/排除標籤 → `TagAutocomplete mode="filter"`（home 篩選、editor 篩選 dialog、compare/player 一次到位）。
- tagger 指派、editor 編輯／批次、settings 重命名／隱藏管理選取 → `TagAutocomplete mode="authoring"`。

## Open question（仍待確認，未定案）

- **「列出 hidden」的最終 UI／包裝**：底層已能一行取得清單（見上），但呈現形狀（純清單？可否直接在該處 toggle？與 tag CRUD 的關係）尚未定。這其實是「以標籤為主的管理介面」的縮影 —— 現在底層已把標籤實體化，若日後要完整 tag CRUD，`queryTags` + `setTagMeta`/`renameTag`/`deleteTag` 已是可持續的基礎，屆時再定 UI。

## 建議順序

1. 前端：Autocomplete 去資料化 + TagAutocomplete + `tagCandidates` 雙通道（W1）。
2. 呼叫點遷移到 TagAutocomplete，query 頁維持 filter、編寫頁改 authoring —— 症狀 3/4 隨之修好。
3. settings 隱藏清單改吃 authoring 通道（`universe:"all"`）—— 症狀 1/2 修好。
4. 驗收：互相共存的 hidden、未使用的 hidden 都能在 settings 看到並取消隱藏；tagger/editor 編輯標籤可從候選選到 hidden；home 與 editor 篩選 dialog 候選維持遮蔽不變。
