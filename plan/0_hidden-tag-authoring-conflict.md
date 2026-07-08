# 0_ 隱藏標籤 × 標籤管理：問題診斷與架構評估

> 本文只做「診斷 + 架構是否走得通」的判斷；解法與取捨（效能、重複介面）見
> [1_hidden-tag-solution-and-tradeoffs.md](./1_hidden-tag-solution-and-tradeoffs.md)。
> **不含任何程式修改。**

## 一句話

標籤在本 app 有兩種**本質不同**的角色，但目前只用同一條資料通道（`page.data.facets`，經過 hidden 遮蔽）餵給所有介面，於是「隱藏」這個查詢層的特性，污染了「以標籤為主角」的管理／編寫介面。

## 標籤的兩種角色

| 角色 | 語境 | 出現位置 | hidden 遮蔽是否正確 |
|------|------|----------|---------------------|
| **篩選述詞**（query） | 「找出符合條件的圖片」 | home 篩選、editor 篩選 dialog、compare、player | ✅ 正確，遮蔽就是這功能本身 |
| **被編寫／被管理的實體**（authoring / admin） | 「這張圖要掛什麼標籤」「這個標籤本身要怎麼設定」 | tagger 指派標籤、editor 編輯標籤、editor 批次增刪標籤、settings 重命名、settings 隱藏管理 | ❌ 錯誤，此時標籤是主角，不該被自己的 hidden 遮掉 |

目前**兩種角色都吃同一個** `page.data.facets`（見下節），這是所有症狀的共同根因。

## 現況資料流（單一通道）

- 全域契約：`src/app.d.ts` 宣告 `PageData.facets?: TagFacet[]`，語意是「目前查詢語境下的 facet 計數」。
- 元件預設：`src/lib/components/form/Autocomplete.svelte:45`
  `return candidates ?? page.data.facets ?? [];` —— 每個 Autocomplete 未給 `candidates` 時，一律吃這個遮蔽過的集合。目前**全站沒有任何一處傳入 `candidates`**，所以「篩選」與「編寫」用的是完全同一份清單。
- 這份清單怎麼來：各 route 的 `+page.server.ts` 都回傳 `facets`：
  - 篩選語境：`queryImages(...).facets`（home/editor/compare/player）——經 `computeFacets`，**遮蔽**。
  - 編寫語境：`database.getAllTagFacets()`（tagger、settings）——同樣經 `computeFacets`，**遮蔽**、且**只含被使用的標籤**（`db.facets.tagBits`）。
- 真實全集在 server 端已存在但**未對前端開放**：
  - `db.hiddenTagNames()`（`src/lib/database/internal/store.ts:96`）讀 `db.data.tags`，回傳**所有** hidden 標籤名稱，**含未被任何圖片使用的**。
  - `db.data.tags`（稀疏 meta 表）＝ 標籤自身設定的真相來源。
  - `db.facets.tagBits.keys()` ＝ 目前被使用的標籤全集（不遮蔽）。

## 具體症狀（皆為上述根因的下游）

### 症狀 1：settings「目前隱藏中」清單會漏標籤（甚至完全空白）

- 現行做法：`settingsHiddenTags.svelte.ts:39` 用 `facets.filter(f => f.hidden)` 推導。
- 但 `getAllTagFacets` 會遮蔽。遮蔽計數的核心（`query.ts` 的 `computeFacets` / `hiddenMask`）對「hidden 且不在查詢內」的標籤 t，計數基底是「preHidden 扣掉其他 hidden 標籤的聯集」。
- 因此**兩個互相共存的 hidden 標籤 t1、t2**（同一批圖片同時擁有）：算 t1 時要扣掉 t2 的圖片、算 t2 時要扣掉 t1 的圖片 → 若這些圖片就是它們僅有的載體，兩者 count 都掉到 0 → `computeFacets` 只 push `count > 0` → **t1、t2 直接從 facets 消失**。
- 另外，**未被使用的 hidden 標籤**（只有 meta、沒有圖片）根本不在 `tagBits` 裡，永遠不會出現。
- 後果：使用者**看不到**這些隱藏標籤，也就**無從得知**某些未使用標籤其實被標記隱藏。
- 諷刺點：真相 `db.hiddenTagNames()` 早就完整存在，只是沒被端出來。

### 症狀 2：settings 隱藏管理的 Autocomplete 選不到要管理的標籤

- 該 Autocomplete 也吃 `page.data.facets`（遮蔽、used-only）→ t1、t2 不在候選 → **無法被選取來取消隱藏**。
- 「管理隱藏標籤」的介面，被「隱藏」自身打敗 —— 自相矛盾。

### 症狀 3：tagger 指派標籤的 Autocomplete 被遮蔽

- tagger load 給的是 `getAllTagFacets()`（遮蔽）。新增圖片要沿用既有 hidden 標籤時，候選裡看不到它們，只能全靠手打 → 難用、易打錯造成標籤分裂。這是**編寫語境**，遮蔽是錯的。

### 症狀 4：editor 編輯／批次標籤的 Autocomplete 被遮蔽；但同頁的篩選 dialog 必須維持遮蔽

- 同一個 editor route、同一份 `page.data.facets` 同時餵給：
  - 編輯標籤（`editor/+page.svelte:204`）、批次增刪標籤（:221、:228）——**應該不遮蔽**。
  - 篩選 dialog 的 `FilterFields`（:289）——**應該維持遮蔽**。
- 因為兩者共用同一份 data，**無法**用「把 editor 的 facets 改成不遮蔽」一招解決——那會破壞篩選 dialog 的正確語意。兩條必須在此**分流**。

## 架構評估：目前架構「死了」嗎？

**沒有。** 資料模型是好的、可擴展的；問題被侷限在**讀取／候選來源這一層**與**一個被過度承載的 PageData 契約**。

- ✅ 底層健康：稀疏 `db.data.tags` meta 表 + bitmap facets，是合理且可擴展的基礎。「所有 hidden 標籤（含未使用）」的真相 `hiddenTagNames()` 已存在。
- ❌ 缺一條路：沒有一個**不遮蔽、含完整 meta、以標籤為鍵**的「標籤詞彙／標籤管理」讀取模型對前端開放；也沒有讓編寫型 Autocomplete 改吃它的機制（雖然 `Autocomplete` 早就留了 `candidates` prop，目前全站沒用）。
- ⚠️ 型別接縫錯位：`TagFacet = { name, count, hidden }`（`types.ts:135`）把 `hidden`（admin 概念）焊在 **facet（query 概念）** 上。這正是兩種角色在型別層被混為一談的地方。
- ⚠️ 既有債務：另有一整條 `queryTags` / `TagWithSamples`（`query.ts:380` 起、`server.ts:128`）**已實作但無任何 route 使用**，同樣是遮蔽、count 導向、還帶樣本圖。動手前必須決定它的去留，否則很容易再長出第三種平行的「標籤清單」。

**結論**：這是**加一條讀取路徑 + 把編寫介面接過去**的增量改動，不是打掉重練。難點不在「能不能做」，而在「怎麼做才不會重複與浪費」——見下一份文件。

## 擴展性隱憂（使用者的前瞻問題）

若未來標籤要有更多設定（顏色、置頂、描述、別名…），同樣的分裂會**重演並惡化**：

- 遮蔽型 `TagFacet` 會不斷長出 admin 欄位（`color?`、`pinned?`…），把 query 與 admin 混得更死。
- 每個管理介面都需要「完整 meta、不遮蔽」的資料。

可擴展的方向，是把**「標籤作為被管理實體」獨立成一等公民的、不遮蔽的讀取模型**（以標籤名為鍵、帶完整 `TagMeta`），與「facet 查詢用的 `TagFacet`」解耦。屆時新增一個 meta 欄位只會動到：`TagMeta`（本就稀疏可擴展）→ 該讀取模型（單一處）→ 管理 UI；**完全不碰查詢管線**。

## 待決策（供下一份文件展開）

1. 編寫語境是否只顯示「已存在標籤全集」還是也要顯示 count／meta？
2. 是否順勢處理未使用的 `queryTags`/`TagWithSamples`（刪除 or 併入新讀取模型）？
3. settings 隱藏清單改以 `hiddenTagNames()` 為準——列出**所有** hidden（含未使用），與存不存在、用幾次無關。
