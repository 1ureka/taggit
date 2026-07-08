# 1_ 標籤自動完成重構：抽象 Autocomplete + TagAutocomplete（雙模式）

> 承 [0_hidden-tag-authoring-conflict.md](./0_hidden-tag-authoring-conflict.md)。
> 本文改採**使用者拍板的方案**，取代先前的 candidates-override 方向。
> 「列出 hidden」的解法**刻意留白**（見文末 Open question）。
> **不含任何程式修改。**

## 方案總覽

三個動作，解決症狀 2/3/4（症狀 1「列出 hidden」不在本文範圍）：

1. **Autocomplete 去資料化**：變成純互動元件，不 import 任何 database 型別、不讀 `page.data`。候選以一般 prop 傳入，型別用元件自有的最小型別。
2. **新增 TagAutocomplete（薄包裝，無 `.svelte.ts`）**：包住 Autocomplete，對外只暴露 `mode`（`filter` / `authoring` 兩擇一），內部依 mode 從 page.data 取對應候選、adapt 後傳給 Autocomplete。**不提供候選覆蓋 prop。**
3. **`page.data.facets` 改名 + 雙通道**：全域 SSR 同時提供兩種模式的候選，讓 TagAutocomplete 依 mode 取用。

| 介面 | 語境 | 元件（目標） |
|------|------|--------------|
| home 篩選、editor 篩選 dialog、compare/player（經 FilterFields） | filter | `TagAutocomplete mode="filter"`（遮蔽，不變） |
| tagger 指派標籤 | authoring | `TagAutocomplete mode="authoring"`（不遮蔽） |
| editor 編輯標籤、批次增/刪標籤 | authoring | `TagAutocomplete mode="authoring"` |
| settings 重命名、隱藏管理的選取 | authoring | `TagAutocomplete mode="authoring"` |

editor 同頁的「編輯標籤」與「篩選 dialog」得以分流——差別只在 `mode`。

## 元件職責

### Autocomplete（generic / presentational）
- 移除 `page.data.facets` 預設；移除對 `$lib/database` 型別的依賴。
- 自有最小候選型別，例如 `type AutocompleteOption = { name: string; count?: number }`。
- props：`candidates: AutocompleteOption[]`（**必填**）、`tags`（bindable）、`placeholder`、`variant`、`name`、`id`、`onchange`。
- 互動邏輯（`autocomplete.svelte.ts`）維持，只把型別 `TagFacet` 換成 `AutocompleteOption`。
- 從此不知道「標籤 / facet / 遮蔽」為何物，可被任何清單型自動完成重用。

### TagAutocomplete（domain wrapper；thin `.svelte`，無 class 檔）
- props：`mode: "filter" | "authoring"` + 透傳 `tags` / `placeholder` / `variant` / `name` / `id` / `onchange`。
- 內部：依 `mode` 取 `page.data` 對應通道（缺通道時 fallback `[]`），adapt 成 `AutocompleteOption[]`（`TagFacet` 取 `name`/`count` 即相容），傳給 Autocomplete。
- 無自身互動狀態 → 不需要 `.svelte.ts`。
- 是**唯一**知道 page.data 標籤通道的地方 → 資料耦合集中一處。

## 兩個候選通道（SSR）

- 舊：`page.data.facets: TagFacet[]`（單一、遮蔽、query-scoped）。
- 新：改名並拆為兩者（名稱可議）：
  - **`filterFacets: TagFacet[]`** — 遮蔽、**隨當前查詢變動**（沿用 `queryImages(params).facets`）。`filter` 模式用。
  - **`tagOptions: TagFacet[]`**（或稱 vocabulary）— **不遮蔽**、**與查詢無關**的全庫標籤詞彙（`used ∪ 有 meta`；`count` = 總使用次數，未使用為 0）。`authoring` 模式用。
- `src/app.d.ts` 的 `PageData` 契約同步更新。

### 遞送 wiring（兩種，取一）
- **W1**：需要 authoring 的頁（tagger / editor / settings）各自於 `+page.server.ts` 回傳 `tagOptions`。直觀，但各頁重複計算。
- **W2（推薦）**：`tagOptions` 與查詢無關 → 提到 `+layout.server.ts` 算一次，全站經 layout data 繼承；`filterFacets` 仍由各 query 頁的 page load 提供。
  - 注意：`+layout.server.ts` 目前對 `/settings` 提前 return、且 DB 可能未載入。W2 需讓 layout 在 DB 已載入時提供 `tagOptions`（與 items 7/8 對 layout 的改動可合流）；DB 未載入時給 `[]`。

## 呼叫點遷移

把現有 `<Autocomplete>`（tag 用途）全換成 `<TagAutocomplete mode=...>`：

- **filter**：`FilterFields.svelte` 的「包含/排除標籤」兩處 → `mode="filter"`（home 篩選、editor 篩選 dialog、compare/player 皆經此元件，一次到位）。
- **authoring**：tagger 指派標籤、editor 編輯標籤（`editor/+page.svelte`）、editor 批次增/刪標籤、settings 重命名、settings 隱藏管理選取 → `mode="authoring"`。

## 取捨評估

### 效能
- 多算一份 `tagOptions`：`O(#標籤)` 的 `used ∪ meta` 聯集（+ size 計數），比遮蔽 facet（per-hidden 的 bitmap clone）**更省**；W2 下每次導航算一次，可忽略。
- payload：多送一份小清單；W2 下連 query-only 頁也帶著它（tiny waste，可接受）。TagAutocomplete 對缺通道 fallback `[]`。

### 重複性（真正的成本）
- 元件：**淨增一個** thin wrapper（TagAutocomplete）；Autocomplete 反而變乾淨；**不新增互動 class**。
- 型別：Autocomplete 用自有 `AutocompleteOption`，domain 續用 `TagFacet`——**不**每個介面各發明型別。
- SSR 通道：兩者語意清楚（masked query vs unmasked vocab），**本來就是兩種東西**，先前被硬塞成一個才出問題；分開不算雷同。

### 可擴展性
- `mode` 日後要加第三種語境，只在 TagAutocomplete 一處擴充。
- 新 meta 欄位：`tagOptions` 帶完整 meta 即可被 authoring UI 使用，**不碰 query 管線**。

## 命名修正（順帶，對應使用者提問）

`getAllTagFacets` 的 `all` 指「**全庫、不帶查詢篩選**」（相對 `queryImages().facets` 的查詢範圍），**與「所有標籤」無關、且仍遮蔽**。它與兄弟 `getAllImages`（其 `all` = 完全不篩、**不遮蔽**）語意不一致，易誤導。本 refactor 引入 `tagOptions`/vocabulary 後，正好在命名上把「全庫無篩選但仍遮蔽的 facet」與「不遮蔽的標籤詞彙」分開；`getAllTagFacets` 應一併正名（如 `getFilterFacets` / 保留給 filter 通道）。

## Open question（待確認，不在本文定案）

**列出 hidden 的介面與包裝**，實質是「**以標籤為實體的讀取模型**」問題，而非 `queryTags` 的職責：

- 現況所有標籤讀取（`queryImages().facets` / `getAllTagFacets` / `queryTags`）都是 **faceted、遮蔽、count 導向、used-only**；沒有「以標籤名為鍵、含完整 meta、不遮蔽、與存不存在無關」的實體讀取。→ 只有 meta、無圖片的 hidden 標籤是 ghost，對所有讀取路徑隱形。
- 標籤的**寫入**面（`setTagMeta`/`renameTag`/`deleteTag`）已是實體導向、可擴展；缺口在**讀取**面。
- 傾向結論：引入**一個標籤實體讀取模型**（≈ 本文的 unmasked `tagOptions`）作為 canonical；
  - `TagAutocomplete` authoring 模式吃它（name/count）；
  - 「列出 hidden」＝對它 `filter(t => t.hidden)`；
  - `queryTags` 維持為未來「標籤藝廊（帶樣本圖、query 語境）」用途，或先刪除，**不**為了列 hidden 而往它加旗標。
- 如此「列 hidden」與「authoring 候選」**共用同一 primitive**，非額外介面。

→ 具體介面形狀與是否此時就建立實體讀取模型，待 chat 討論後回填本區或另開文件。
