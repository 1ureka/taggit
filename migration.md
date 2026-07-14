# Taggit v3 規劃：複製 workbench、移植後端、分階段重寫路由

> 本報告是自成一體的執行規劃。做法：**複製 svelte-workbench（本專案）成為新專案**，把 taggit（`C:\Users\Summe\Documents\Projects\taggit`）的後端整包移植進來，前端路由在 workbench 的元件庫與基座上全部重寫。
>
> 節奏原則（已與使用者確認）：**路由頁面重寫之前的所有工程一次到位**（Phase 0，單一大階段），只有**路由頁面本身分階段**（Phase 1~6）。

---

## 一、方案輪廓

- 新專案（暫稱 `taggit-next`）的前端基因 100% 來自 workbench：token 主題系統（`$lib/assets/theme.css` + `app.css`、`html[data-theme]` 雙主題）、原生 top-layer 浮層（`<dialog>`/popover API，無 z-index 系統）、元件 + `.core.svelte.ts` 架構、`OneOf`/`variant`/`status`/`padding` 慣例。
- 後端基因 100% 來自 taggit：in-memory 資料庫（`db.json` 載入、SIGINT flush）、sharp 縮圖管線、blurhash、REST API、`query-spec` 同構查詢值物件、`test/` 後端測試。
- 兩者能直接合體的前提（已實際驗證）：
  - taggit 後端是乾淨的 server-only 模組群，與前端只透過 `$lib/query-spec`、`$lib/image/client`、`$lib/utils/shared` 三個同構契約與 `/api/**` REST 介面往來，頁面對 `$lib/database` 只有 type-only import。
  - 兩專案的 `$lib` 子目錄**完全不重疊**（workbench：`components/{actions,display,floating,inputs,navigation}`、`icons`、`assets`、`types.ts`；taggit 後端：`database`、`collection`、`image`、`mutation`、`query`、`query-spec`、`utils`），合併是純聯集，零改名、零 import 調整。
- 舊 taggit 專案在過渡期繼續作為日常使用工具，不做任何改動；新專案寫完全部路由後一次切換。

---

## 二、Phase 0：一次到位的建置（唯一的非路由階段）

Phase 0 完成後，新專案應該是：後端測試全綠、API 全部可打、全域殼層與服務就緒、元件庫展示場保留可用——**只差業務頁面**。以下每一節都是 Phase 0 的一部分，一個分支內做完。

### 0.1 建立專案與工具鏈

- 複製 workbench 為新 repo，**從全新的 git 歷史開始**（不延續 workbench 的 commit history，於複製出的檔案上建立初始 commit）；workbench、taggit 兩份歷史分別留在各自舊 repo 作為紀錄。
- `package.json`：
  - `name: "taggit"`、版本接續 taggit 的 `2.x` → `3.0.0-dev`。
  - dependencies 取聯集：`@floating-ui/dom`（已有）+ `sharp`、`blurhash`、`@unpic/placeholder`（來自 taggit）。
  - devDependencies：`@sveltejs/adapter-vercel` 換成 `@sveltejs/adapter-node`；其餘沿用 workbench 的較新版本組合（svelte、kit、vite、TypeScript 以現值為底，`npm install` 後以 `check`/`build` 驗證）。
  - scripts：加回 taggit 的 `"test": "node ./test/run.mjs"`。
- `svelte.config.js`：adapter 換 node；**保留 workbench 的 runes filename 過濾寫法**（不用 taggit 的全域 `runes: true`，避免波及 node_modules）。
- `app.html`：`lang` 改 `zh-TW`；**保留** workbench 的 data-theme bootstrap script（localStorage / `prefers-color-scheme`）——新專案從第一天就是 light/dark 雙主題。
- `.gitignore`：加入 `server.json`（見 0.3）。

### 0.2 路由分域

workbench 的展示頁與 taggit 的業務頁都想住在 `/`，必須先分域：

```
src/routes/
├── (app)/                  # 業務域：taggit 的所有頁面
│   ├── +layout.server.ts   # collection 啟動/引導邏輯（見 0.4）
│   ├── +layout.svelte      # 全域殼層（見 0.5）
│   ├── +error.svelte
│   ├── settings/ tagger/ tags/ compare/ editor/ player/ …（Phase 1~6 逐一補上）
│   └── +page.svelte        # `/` = masonry 瀏覽頁（Phase 6）
├── lab/                    # 元件展示場：原 workbench (home) + (showcase) 整體搬到 /lab 前綴下
│   ├── +page.svelte        # 原首頁網格索引（config.ts 的卡片連結加上 /lab 前綴）
│   └── (showcase)/…        # 原展示頁原樣保留
└── api/                    # REST API（見 0.3）
```

- 展示場**保留**而非刪除：它是元件與 widget 的就地驗證場，未來新增 widget 也在這裡加展示頁。
- taggit 的「collection 未設定 → redirect `/settings`」引導邏輯只掛在 `(app)` 的 layout，`/lab` 與 `/api` 不受影響。
- Phase 0 需在 `(app)/settings/` 放一個 stub 頁（空殼 + 標題），讓引導 redirect 有落點、不 404；Phase 1 才填入真內容。

### 0.3 後端整包移植

機械複製，不重構（重構是收斂後的事）：

| 來源（taggit） | 內容 | 備註 |
| --- | --- | --- |
| `src/lib/database/**` | in-memory DB、bitmap/facet 索引、序列化 | server-only |
| `src/lib/collection/**` | collection 根目錄管理、`server.json` 讀寫 | server-only |
| `src/lib/image/**` | `server/processor/metadata/resources`（sharp，server-only）+ `client/formats/blurhash`（同構：`imgSrc()`、`blurhashStyle()`） | 整目錄搬 |
| `src/lib/mutation/**`、`src/lib/query/**` | 寫入命令與查詢 | server-only |
| `src/lib/query-spec/**` | 查詢值物件（isomorphic），前後端共同語言 | 前端重寫頁面時直接使用 |
| `src/lib/utils/server.ts`、`shared.ts` | log、共用工具 | |
| `src/hooks.server.ts` | SIGINT/SIGTERM flush | 原樣 |
| `src/routes/api/**` | 全部 REST 端點 | `api/proto/**`（staged-batch、committed-batch、tags-batch）一併搬——它們是已收斂原型（tagger-b、editor-d/compare-a、tags-d）的資料介面，路由轉正時再改名為正式端點 |
| `test/**`、`TESTING.md` | 後端測試（Vite `ssrLoadModule` 直跑 TS） | scripts 已在 0.1 加回 |
| `server.json` | 使用者本機狀態（含個人 collection 路徑） | **不入版控**；首次啟動由 settings 引導產生 |

前端搬運（同屬 lib 層、與特定路由無關，因此歸 Phase 0）：

- `$lib/ui/request.ts` → 新專案 `$lib/api/request.ts`：統一 `{ok,data,error,status}` 封包 + mutation 結構化錯誤格式化，原樣可用。
- `$lib/ui/virtualizer/**`（list / masonry / player / raf-aggregator）→ 新專案 `$lib/virtualizer/**`：邏輯原樣，僅把樣式引用換成新 token；這是 `/`、`/player`、清單類頁面的共用底盤，先搬好，路由階段才不會被 lib 工程卡住。
- `$lib/ui/dom.ts` 的通用函式（`isInEditable`、`scrollToActive`）→ `$lib/utils/dom.ts`。**不搬**其中的 `addToast`/`withProgressToast`/`requestConfirm`——新前端直接用 workbench 的 `toast-events.ts` API 與新 ConfirmDialog（見 0.5），不需要相容層。

搬完的驗收：`npm run check`、`npm run build`、`npm run test` 全綠；`npm run dev` 起服務後以測試 collection 打通 `/api/settings/setup` → `/api/staged` → `/api/committed` → `/api/images/{file}?size=md` 的基本鏈路。

### 0.4 `(app)` layout 的啟動邏輯

改寫自 taggit 的 `+layout.server.ts`，行為不變：

- `/settings` 底下：寬鬆載入（回傳 collectionName、counts，可容忍 DB 未載入）。
- 其他路由:root 未設定 → redirect `/settings?alert=default`；root 無效 → `/settings?alert=error`；正常則 `setActiveRoot` + `Database.ensureLoaded` + `ImageLibrary.ensureActive`，回傳 `collectionName`、`committedCount`、`stagedCount` 供殼層顯示。

### 0.5 全域殼層與全域服務

用 workbench 元件重寫 taggit 的 `+layout.svelte`（這是殼層不是業務頁，屬 Phase 0）：

- **header**：品牌（favicon + Taggit）、中央的「當前狀態」按鈕（開啟導航面板）、右側 **ToastList 開啟鈕**（taggit 既定計畫：header 右側可打開通知歷史）。
- **導航面板**：原本的 command palette 式 Modal（上一頁/下一頁、四大導航卡片 + count 徽章）用 workbench `Modal` + `ButtonLink` 重寫；徽章用 `Chip` 或局部樣式。
- **全域掛載**：`ToastStage`、`ToastList`、`Tooltip`、`NavigationIndicator`（taggit 想要的「客戶端導航最低限度載入提示」，workbench 已有現成元件）。
- **全螢幕模式**：`/player` 隱藏 header 的邏輯保留。
- **Toast API**：全站直接用 workbench 的 `addToast({ message, variant })` 與 `withProgressToast(task)`（`$lib/components/floating/toast-events.ts`）。
- **Confirm**：workbench 沒有這個積木 → 本階段做 widget `ConfirmDialog`（見 0.6），並提供 `requestConfirm(message, options): Promise<boolean>` 模組函式（沿用 taggit 的好介面，事件驅動、全域單例掛在殼層）。
- `+error.svelte`：以 workbench 風格重寫。

### 0.6 widget 層底座

`src/lib/widgets/**`——介於積木（`$lib/components`）與頁面之間的組合層。準則：**widget 只組合既有積木與業務型別，不重新發明樣式、不新增設計語彙**；當某個 widget 被證明足夠通用，才升格回 workbench 積木庫。

Phase 0 首發（殼層與多數路由都會用到的）：

| widget | 組成 | 取代 taggit 的 |
| --- | --- | --- |
| `ConfirmDialog` | Modal + Button + 事件協定 + `requestConfirm()` | `overlay/ConfirmModal` + `confirmModal.svelte.ts` |
| `BlurImage` | `<img>` + `blurhashStyle()` 佔位 + 載入 defer-dim | `media/ImageCanvas` 內建的圖片載入層；與 workbench 的內容無關 `ImageCanvas` 組合成完整看圖區 |

隨路由階段再長出的候選（到時各自加 `/lab` 展示頁）：`TagChips`（Chip 組合、統一 hidden 標籤外觀）、`SearchBar`（TextInput+Popover+Chip 的 SearchInput 組合接 `query-spec`，取代 FilterFields）、`ReviewModal` 骨架（「本地變更集 → 前後對照審查 → 送出」是 taggit 已定案的通用互動模式：名稱/評等舊→新箭頭、標籤 ±chip，tagger/editor/tags/compare 四條路由都要用，值得做成 widget）。

### 0.7 icons 補齊

使用者已補，若仍有缺失代表使用者認為已經有類似 icon 可替代!

### 0.8 慣例成文（新專案的 CLAUDE.md / README）

把兩邊已達成共識的規則寫死，避免路由階段各寫各的：

- import 一律無副檔名（終結 taggit 的 `from "**/x.js"` 慣性）。
- 路由層不用 presenter class（`xxx.svelte.ts` 建構子接 getter 模擬綁定），回到單純 component 拆分；`.core.svelte.ts` controller 只允許存在於 `$lib/components` 積木內部。
- 頁面資料夾：`+page.svelte` / `+page.server.ts` + 單層子資料夾（`list/`、`inspector/`、`modals/`、`logic/` 等有意義命名，不巢狀）。
- 會產生變更的互動一律「本地變更集 → 審查 modal 前後對照 → 送出」，不逐筆送出；輸入要有即時驗證。
- 效能鐵律（來自 taggit 已定案的 editor 事故解剖）：切換當前項目必須純前端；URL 同步用 `history.replaceState` 不用會重跑 load 的 `goto`；只有存檔/退回/手動重整才 `invalidateAll()`；任何會連發的互動（key repeat、捲動、輸入）必須去抖/節流。
- 樣式只引用 token；顏色一律 `hsl(from …)` 推導；新頁面必須在 light/dark 都走查。

### 0.9 Phase 0 驗收清單

1. `npm run check`、`npm run build`、`npm run test` 全綠。
2. `/lab` 展示場全部頁面照常運作（等於元件庫回歸測試）。
3. dev server 對測試 collection：API 鏈路可打通（setup → staged → committed → images 縮圖）。
4. 未設定 collection 時訪問 `(app)` 任意路由 → 正確引導到 `/settings` stub。
5. 殼層在 light/dark 下渲染正常；toast、confirm、tooltip、導航面板、NavigationIndicator 可手動觸發驗證。

---

## 三、Phase 1~6：路由重寫（分階段）

排序邏輯：`/settings` 是全 app 入口必須最先；接著優先湊出「**最小日常可用集**＝能設定、能瀏覽」讓新專案盡早接管日常，再依 UX 收斂度由高到低排；editor 因全局視角未定案排最後。每條路由都以 taggit 對應原型/現行頁為**規格參考**（邏輯可抄、markup 全新），寫完即為正式版。

### Phase 1：`/settings`

- **規格參考**：taggit `routes/settings/**`（現行正式頁，五個 presenter class 需解散重寫為 component 拆分）。
- **資料契約**：load 回傳 `collectionRoot`、`cacheStats`、`databaseLoaded`、`authoringTags`；API：`api/settings/{setup,cache,backup,metadata,missing}`、`api/tags`（改名/刪除）、hidden tags patch。
- **主要積木/widget**：TextInput、Button/ButtonConfirm、Checkbox、Select、Chip、ConfirmDialog、LinearProgress（維護任務進度）、Alert 類訊息（先用頁面局部樣式，第二次出現再考慮 widget）。
- **特別驗收**：首次設定引導（`?alert=default/error`）與 `server.json` 產生流程完整可跑——這是整個 app 的大門。

### Phase 2：`/`（masonry 瀏覽）＋ `/player`

- **規格參考**：taggit `routes/(home)/**` 與 `routes/player/**`。兩者共用虛擬化底盤（0.3 已搬好），一起做。
- **資料契約**：home 的 `+page.server.ts` 以 `ImageQuery.fromSearchParams` 查詢；player 同源（`images`、`total`，空結果 redirect 回 `/`）。
- **主要積木/widget**：`$lib/virtualizer` masonry/player、`BlurImage`、Select（欄數）、Rating、`SearchBar`（本階段實作，取代 FilterFields——workbench 側 SearchInput 組合已有展示頁可依）、`TagChips`、Modal（BrowseModal 瀏覽詳情）、ScrollButton 與 InverseRadius（自 taggit `misc/` 原樣搬進 widgets 或頁面局部）。
- **里程碑**：本階段完成＝最小日常可用集成立，新專案可開始承擔「瀏覽」用途（注意 db 單寫者紀律，見第四節）。

### Phase 3：`/tagger`

- **規格參考**：taggit `routes/tagger-b/**`（已勝出原型；UX 全部定案：每圖獨立 draft、圖章模式含 cursor/徽章/Esc 細節、合併式標籤、審查 modal）。
- **資料契約**：staged 清單 load；API：`api/staged`（上傳/刪除）、`api/proto/staged-batch`（commit，轉正時改名 `api/staged/commit` 之類正式路徑）。
- **主要積木/widget**：Combo+Chip（標籤輸入）、TextInput、Rating、Checkbox、`ReviewModal` widget（首次實作）、`BlurImage`+ImageCanvas（inspector 看圖）、Modal（Import）。

### Phase 4：`/tags`（含巢狀 `/tags/cleanup`）

- **規格參考**：taggit `routes/tags-d/**`（合併畫布）+ `tags-d/tags-c`（清理助手，巢狀工具頁）。
- **資料契約**：layout 層一次取回 `committedFiles` + `allTags`，其後互動純前端；API：`api/proto/tags-batch`（changeset 送出，轉正改名）、`api/tags/[tagName]`。
- **主要積木/widget**：Chip/`TagChips`（拖放畫布上的標籤）、`ReviewModal`（標籤 changeset 版）、Combo（搜尋標籤）、ConfirmDialog。
- **攜帶的未決 UX**：「這個標籤掛在哪些圖片上」如何在畫布內被滿足——實作時若仍無答案，先照 tags-d 現狀落地，缺口記入 draft。

### Phase 5：`/compare`

- **規格參考**：taggit `routes/compare-a/**`（由 editor-c 轉生的並排畫布＋標籤廣播＋隨機抽選 N 張），取代現行 `/compare`。
- **資料契約**：一次取回完整 `committedFiles` + `authoringTags`，互動純前端；API：`api/proto/committed-batch`（轉正改名）。
- **主要積木/widget**：ImageCanvas+`BlurImage`（多開並排）、`TagChips`、`ReviewModal`、Select/Rating。

### Phase 6：`/editor`

- **規格參考**：taggit `routes/editor-d/**` 為載體（功能最全的勝出原型）；**全局視角的最終形狀未定案**——正因如此排最後，且此時新專案已有真後端 + 全部積木，可用 taggit 的「原型比較工作流」直接在本專案內做 3~4 個形狀比較後定案。
- **資料契約**：一次取回完整清單、切換純前端（0.8 效能鐵律的主要適用地）；API：`api/committed/[filename]`（patch/del）、`api/proto/committed-batch`（轉正）。
- **主要積木/widget**：ImageList（以 `$lib/virtualizer` list 重寫）、TextInput/Rating/Combo+Chip、`ReviewModal`（批次評等的套用前後對照）、ConfirmDialog。

### 每個 Phase 的共同完成定義

1. 不引用任何 taggit 舊 utility class 概念（`.btn-*`/`.text-input`/`.chip` 不存在於新專案）；樣式只用 token。
2. 頁面邏輯無 presenter class；資料夾結構符合 0.8 慣例。
3. light/dark 雙主題走查通過；鍵盤基本盤（focus 順序、Escape 關浮層）通過。
4. 該路由用到的 `api/proto/*` 端點完成轉正改名（原型收斂即正式）。
5. `npm run check` + `build` + 後端測試綠；draft/計畫文件更新該路由的決定與遺留問題。

---

## 四、過渡期紀律與切換

### db.json 單寫者（過渡期最重要的一條）

taggit 的資料庫是「啟動載入進記憶體、SIGINT 時 flush 回寫」的單寫者模型。**同一個 collection 絕不可同時被舊 taggit 與新專案兩個 server 開啟**——後關閉者的 flush 會整份覆蓋前者寫入的變更。執行紀律：

- 開發期：新專案一律對**複製出來的測試 collection** 開發（複製 `images/` + `db.json` 即可）。
- Phase 2 之後若想用新專案瀏覽真 collection：同一時間只開一個 server，用完即關。
- 正式切換前，舊 taggit 正常關閉（確保 flush），之後真 collection 只由新專案開啟。

### 切換與收尾

1. Phase 6 完成、全部路由驗收後：舊 taggit 停役（repo 保留為歷史紀錄）。
2. 新專案版本定為 `3.0.0`，README 以 taggit 的使用說明為底更新（安裝、collection 結構、workflow 不變）。
3. repo 歸宿**留到此時再決定**（新 repo 全程獨立演進，不預先假設結論）：新 repo 直接成為 taggit 的正身並取代舊 repo；或維持獨立 repo；屆時視新 repo 累積的 git 歷史是否值得保留、與舊 taggit repo 的關係再拍板。若決定合併回 taggit，舊 repo README 加一行指向新家（或反之）。
4. `/lab` 展示場長期保留；若未來元件庫要服務第三個專案，屆時再抽成獨立 package，現階段不做。

---

## 五、風險與未決事項

| 項目 | 說明 | 對策 |
| --- | --- | --- |
| 中途停手＝半成品 | 本方案沒有「逐路由可暫停、隨時可用」的中間態，Phase 2 前新專案無日常價值 | Phase 排序已把最小可用集（settings＋瀏覽）壓到最前；舊 taggit 全程可用，沒有服務中斷風險 |
| editor 全局視角未定案 | Phase 6 的規格缺口 | 在新專案內用原型比較工作流收斂（真後端、全積木，成本比在舊專案低） |
| tags 的「標籤→圖片」視圖未定案 | Phase 4 的規格缺口 | 照 tags-d 現狀落地，缺口記錄，不阻塞 |
| SearchBar／SearchInput 規格 | workbench 側標記為進行中的組合 | Phase 2 實作時就地定案，並回饋 workbench 的展示頁 |
| db 單寫者 | 見第四節 | 紀律 + 測試 collection |
| 版本聯動 | sharp 為原生依賴，Node 版本與 adapter-node 部署環境需一致 | 沿用 taggit 現行的 Node LTS 要求，Phase 0 驗收含 build+preview 實跑 |
| `--text-dim` 第三階文字色 | taggit 舊 token，workbench 主題只有兩階（text/text-muted） | Phase 0 不加；路由重寫遇到真需求時再決定升格為 theme.css 正式 token（同步回 workbench）或就地用 `hsl(from …)` 推導 |
