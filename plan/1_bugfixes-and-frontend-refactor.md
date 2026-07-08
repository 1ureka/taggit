# 1_ 待辦：hidden 相關 bug 修復 + Autocomplete 直觀化

> 前置作業（database 重寫）已完成，見 [0_database-rewrite.md](./0_database-rewrite.md)。
> 底層現在已能表達「編寫／管理語境」的標籤查詢，以下 bug 都變成「呼叫端換組合」而非「新增 API」。
> **本文為計畫，尚未實作。**

## 方向（大幅減少複雜度）

前端本來就扁平，先前規劃的 `TagAutocomplete` 薄包裝、`AutocompleteOption` 最小型別、`page.data.tagCandidates` 雙通道容器都**取消**。改成一切走明確的 props 資料流：

```
+page.server.ts  →  +page.svelte  →  <Autocomplete candidates={...} />
```

三個拍板點：

1. **不做 `TagAutocomplete` 抽象包裝**。各頁直接用 `Autocomplete`。
2. **`Autocomplete` 的 `candidates: Tag[]` 改為必填**：不再 import `page`、不再 `?? page.data.facets`。候選一律由呼叫端明確傳入。
3. **`app.d.ts` 移除 `PageData.facets` 全域增補**：不再有元件反向讀 `page.data`，各頁 load 的回傳由該頁 `./$types` 自行推斷，`page.svelte` 以 `data.xxx` 明確下傳。

### 隱藏標籤的呈現（併入 Autocomplete 本身）

`candidates` 是 `Tag[]`，已帶 `meta.hidden`，所以「是否隱藏」的呈現直接由 `Autocomplete` 判斷，無需外部旗標：

- 下拉選項右側（與 `.count` 同屬 justify-end 群組）：當 `tag.meta.hidden` 為真時，在數字 chip **左邊**渲染 `IconAlertTriangleFilled`。
- 該選項 `div[role="option"]` 加上 `title="已隱藏的標籤"`，懸停時顯示。

> 註：filter 通道（`hidden:"mask"`）本來就會把 hidden 標籤列進 facets（見 `query.ts`），因此 home 篩選也會看到此圖示 —— 這是有意的，等於明確標示「這是隱藏標籤」，不改變既有可選性。

## 底層已就緒

`queryTags(conditions?, opts?)`：
- `hidden: "ignore"` —— 不遮蔽，供編寫／管理語境。
- `universe: "all"` —— 併入僅有 meta、未使用的 ghost 標籤。

「列出全部（含未使用）標籤、含隱藏者」＝ `queryTags(undefined, { hidden: "ignore", universe: "all" })`。四個 bug 的根都在此。

## 兩條語境通道（各頁 load 自算，W1）

| 通道 | 欄位名 | queryTags | 語境 | 使用頁 |
|------|--------|-----------|------|--------|
| filter（遮蔽、依查詢 scope） | `facets` | `queryTags(url.searchParams)` | 篩選 | home、compare、player、editor 篩選 dialog |
| authoring（不遮蔽、含未使用） | `authoringTags` | `queryTags(undefined, { hidden:"ignore", universe:"all" })` | 編寫／管理 | tagger、settings、editor 編輯/批次欄位 |

- 名稱與語境 1:1：`facets`＝篩選、`authoringTags`＝編寫，跨頁一致。
- **editor 兩者都回**：`facets` 給篩選 dialog、`authoringTags` 給編輯/批次三個欄位。
- 採 W1（各頁各自回自己需要的 key），與現有「每頁各自回 facets」慣例一致；不採 layout 集中（全站 `invalidateAll` 重載，集中無「算一次」優勢，卻要淌 layout redirect／`/settings` early-return／DB 未載入等特例）。
- authoring 通道 count 語義為全庫用量（`hidden:"ignore"`），對編寫時挑既有標籤是合理提示。

## Bug 修復（皆為「換一個 queryTags 組合／換通道」）

| # | 症狀 | 修法 |
|---|------|------|
| 1 | settings「目前隱藏中」清單漏標籤／看不到未使用的 hidden | 資料源改用 authoring 通道（`universe:"all"`），`settingsHiddenTags` 由 `data.facets` 改讀 `data.authoringTags`。 |
| 2 | settings 隱藏管理／重命名的候選選不到 hidden 標籤 | 兩個 `Autocomplete` 的 `candidates` 改吃 `data.authoringTags`。 |
| 3 | tagger 指派標籤候選被遮蔽 | 候選改吃 authoring 通道。 |
| 4 | editor 編輯／批次候選被遮蔽，但同頁篩選 dialog 需維持遮蔽 | 編輯/批次三欄 `candidates={data.authoringTags}`；篩選 dialog（FilterFields）`candidates={data.facets}` 維持遮蔽。 |

## 逐檔改動

**元件**
- `Autocomplete.svelte`：移除 `import { page }` 與 `?? page.data.facets ?? []`；`candidates` 改必填；import `IconAlertTriangleFilled`；選項右側加 hidden 圖示 + `title`（見上）。
- `autocomplete.svelte.ts`：無需改（已是 `Tag[]`、已帶 `meta`）。
- `FilterFields.svelte`：新增必填 `candidates: Tag[]` prop，轉發給內部「包含／排除標籤」兩個 `Autocomplete`。

**app.d.ts**：刪除 `App.PageData.facets` 增補。

**各頁**
- `(home)`：server 不變（回 `facets`）；`<FilterFields candidates={data.facets} />`。
- `editor`：server 加回 `authoringTags`（`facets` 維持）；篩選 dialog `<FilterFields candidates={data.facets}>`；編輯/批次三欄 `candidates={data.authoringTags}`。
- `tagger`：server `facets` → `authoringTags`（authoring 組合）；`<Autocomplete candidates={data.authoringTags}>`。
- `settings`：server `facets` → `authoringTags`（authoring 組合）；兩個 `Autocomplete` 傳 `candidates={data.authoringTags}`；`settingsHiddenTags` 選項由 `facets` 改 `authoringTags`。
- `compare`／`player`：其 `.svelte` 未渲染任何 Autocomplete，`facets` 回傳其實未被使用 —— 一併移除該回傳以收斂（若確認無其他消費端）。

## 驗收
- 互相共存的 hidden、未使用的 hidden 都能在 settings「目前隱藏中」看到並取消隱藏。
- tagger／editor 編輯欄位可從候選選到 hidden 標籤，且選項顯示警告圖示 + 「已隱藏的標籤」title。
- home 與 editor 篩選 dialog 候選維持遮蔽語義不變。
- `svelte-check` 通過（`candidates` 必填後無漏傳）。

## Open question（仍待確認，未定案）

- **「列出 hidden」的最終 UI／包裝**：底層已能一行取得清單，但呈現形狀（純清單？可否直接在該處 toggle？與 tag CRUD 的關係）尚未定。若日後要完整 tag CRUD，`queryTags` + `setTagMeta`/`renameTag`/`deleteTag` 已是可持續的基礎，屆時再定 UI。
