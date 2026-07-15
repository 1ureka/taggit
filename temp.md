# StagedList 虛擬化重寫計畫（分析用，尚未實作）

> 本檔取代先前「StagedEntry 投影型別分析」的內容——那份分析已經實作完成（`list/stagedEntry.ts`、`StagedList.svelte` 吃 `entries`/`onselect`），這份是下一階段：用 `$lib/virtualizer/masonry.svelte.ts` 把 `StagedList` 從簡單清單改成可虛擬化的卡片牆。**這次只是計畫，尚未動任何程式碼。**

## 為什麼可以用固定寬高餵給 masonry

`$lib/virtualizer/masonry.core.ts` 的 `createMasonryLayout` 只需要 `ItemWithSize = { id, width, height }`，內部只取 `height/width` 當作「權重」去做貪婀式欄位分配，跟圖片的真實比例無關——欄寬本身是容器寬度均分出來的，`width` 欄位唯一的作用只是拿來算比例，不會真的影響渲染寬度。

暫存圖片（`ImageLibrary.list()` 尚未提交的檔案）沒有資料庫紀錄，因此沒有已知寬高；為此特地量測每張圖片的實際尺寸不划算（還要考慮 meta 讀取失敗等情況）。既然現有的簡單清單本來就是不跟隨真實寬高的固定格子，改成「寫死同一組 width/height 餵給 masonry」不會讓視覺變差，反而換來虛擬化能力（可視範圍二分搜尋、只渲染看得到的卡片）。**結論：所有項目統一使用同一組固定 `width`/`height`，不做逐項差異化。**

## 交錯「wavy」效果：已放棄，原因與未來 TODO

原本想讓卡片矮高交錯（第一排矮高交錯、第二排反過來）製造一點瀑布流的錯落感。實際用 `createMasonryLayout` 模擬（`width=1`，`height` 在 `0.8`/`1.2` 兩個固定值之間逐項交替餵入，欄數 2~5 都測過）後發現：

- `createMasonryLayout` 是**貪婪權重演算法**——每個項目丟給「目前累積權重最短的欄」，完全沒有「row」的概念，不是逐 row 對齊的版面模型。
- 交替餵入兩種高度並不會讓畫面呈現乾淨的棋盤交錯，而是會出現同高度的項目連續分到同一欄（例如 4 欄時，某一欄實測出現連續 3 張高卡片），欄數越多這個現象越明顯。
- 這是演算法的本質限制，不是參數沒調好——只要落點決定權完全交給貪婪最短欄邏輯，就無法保證跨欄的規律交錯。

**決定：這次退回全部卡片使用同一組固定寬高，不追求交錯效果。**

**未來 TODO（先記錄，之後實作 StagedList 虛擬化時要在程式碼補上對應 TODO 註解）**：如果之後還想要那種「矮高規律交錯」的視覺效果，不能靠餵不同 `height` 值給現有的 `masonry.svelte.ts`/`masonry.core.ts` 達成，因為它的貪婪權重演算法本質上不支援跨欄對齊。需要另外寫一個新的虛擬化模組——不用「丟給目前最短欄」的邏輯，而是直接以 `(row, col)` 座標決定每個位置的尺寸（本質上是一個「尺寸交錯的規則網格」，不是真正的瀑布流），但仍可比照 `masonry.core.ts` 的二分搜尋作法做可視範圍虛擬化。這是一個新模組，不是修改現有 masonry。

## 欄數策略：比照首頁 breakpoint 陣列，但量測基準不同

比照 `(home)/wall/config.ts` 的做法——用一個 `{ width, cols, p, g }` 的 breakpoint 陣列，依可用寬度找對應欄數。但**不能直接照抄首頁的數字**，原因：

- 首頁 `+page.svelte` 是用 `innerWidth.current`（`svelte/reactivity/window`）也就是**整個瀏覽器視窗寬度**去查表，因為首頁的 masonry 就是整頁版面。
- `/tagger` 不一樣：`StagedList` 是跟 `Inspector`（固定 `22rem` = 352px）並排的側欄，可用寬度是「視窗寬度 − 22rem − 其餘版面留白」，而且 `Inspector` 是條件渲染（選取某張圖才出現）——選取前後可用寬度會跳動，這不是「使用者改變視窗大小」，`innerWidth` 完全捕捉不到。
- 因此 `/tagger` 這裡的 breakpoint 查表基準必須是 **`StagedList` 自己容器的實際寬度**（例如透過 `bind:clientWidth` 或 ResizeObserver 量測 `masonry.viewportEl`），不是 `innerWidth.current`。門檻數字也要重新抓，考量到扣掉 Inspector 後的常見可用寬度，欄數上限大概落在 2~3 欄（不會到首頁的 5 欄），實際數字留到實作時對照真實裝置寬度調校。

## 卡片內容：沿用 tagger-b StagedGrid 的資料，轉譯到新的固定尺寸卡片

`stagedEntry.ts` 的 `StagedEntry` 型別（本次已實作）已經涵蓋卡片需要的全部欄位，虛擬化只是換了外層佈局容器，卡片內部資料不用重新設計：

- 縮圖：`entry.imgSrc`。`pixelW`/`pixelH` 是 masonry 透過 `item.style` 套在 `<li>`（卡片外層）上的絕對定位尺寸，是**整張卡片**的框，不是圖片的框——卡片內部另外還有 touched 標記列、draft 摘要行要佔空間。做法是卡片內部用 flex column（撐滿 `<li>` 給的 `height: 100%`），`<img>` 用 `width: 100%; flex: 1; min-height: 0; object-fit: cover` 讓它自動吃掉扣除標記列／摘要行後剩下的空間，不需要在元件裡讀 `pixelW`/`pixelH` 數值——跟 tagger-b 原本用 `aspect-ratio: 1` 讓圖片自己撐滿寬度是同一種「交給 CSS 宣告式處理」的思路，只是這次剩餘空間不是固定比例，改用 `flex: 1` 吃剩餘空間。
- 目前檢視中：`entry.current` → 外框樣式（比照 tagger-b 用 `accent` 邊框）。
- 已編輯：`entry.touched` → 顯示標記。
- ready/blocked：`entry.touched && entry.problem === null` 顯示打勾圖示，`entry.touched && entry.problem !== null` 顯示警示圖示，圖示 `title`/tooltip 帶 `entry.problem` 文字（比照 tagger-b 的 `IconCheckFilled`/`IconAlertCircleFilled` + `title`）。
- draft 摘要行（僅 touched 時顯示）：`entry.rating > 0` 顯示 `★{rating}`、`entry.tags.length > 0` 顯示 `{n} 標籤`、`entry.name` 非空顯示引號包住的名稱——邏輯跟 tagger-b 一致。

**圖章模式維持先前決定，這次不做**：grid 層級的疊層徽章、pointerdown/pointerenter 連續塗刷、Esc 離開等，等之後真的要做圖章模式時再照 tagger-b 的 `StampTool.svelte`/`stamp.ts`/`StagedGrid.svelte` 的圖章段落抄。這次的卡片設計不用預留圖章專屬欄位（跟先前 `StagedEntry` 分析的結論一致：圖章是 grid 層級的獨立 state，不是卡片投影欄位）。

## 架構提醒：masonry 版面配置不該跟著 drafts 一起重算

這點是這次分析過程中發現、值得寫下來的重要細節，跟之前討論過的「`stagedEntries` 每個按鍵都整批重算」是同一個問題的延伸：

`createMasonryLayout` 只需要 `{ id, width, height }`，而這次決定 `width`/`height` 全部卡片統一固定——也就是說，**masonry 版面配置其實只依賴 `data.stagedFiles`（有哪些檔案、順序為何）跟欄數，完全不依賴 `drafts`**。如果照現在的寫法，直接把整包 `stagedEntries`（`$derived`，內含 `touched`/`problem`/`name`/`rating`/`tags`，這些每次編輯任何一張的草稿都會整包重新 `.map`）拿去餵給 masonry 的 `items`，會導致「使用者打一個字」不只重算 1000 筆 `StagedEntry`，還會**額外觸發一次 masonry 的貪婪權重版面計算**（`O(n × columns)`），完全是白工——因為版面配置根本不應該因為打字而改變。

實作時建議把兩件事拆開：

1. `layoutItems`：只依賴 `data.stagedFiles` 跟欄數的 `$derived`，只提供 `{ id: filename, width, height }` 給 `Masonry`，只有在暫存清單本身變動（新增/刪除/重新整理）時才重算，編輯草稿不會碰到它。
2. 卡片實際顯示內容：不要在父層 `+page.svelte` 用一個大 `.map` 整批算好 `StagedEntry[]` 再傳給子元件，改成每張卡片自己的元件內部用 `$derived` 直接讀 `drafts[file]` 算自己的 `StagedEntry`——這樣編輯某張圖的草稿，只有那一張卡片自己的 `$derived` 會重跑，其餘卡片完全不受影響。

這個拆分同時解決了「masonry 版面被無關的編輯觸發重算」跟先前討論過的「每個按鍵都要重掃全部暫存張數」兩個問題，是同一次重構可以一起做掉的。`touchedCount`/`readyCount`/`reviewEntries` 這類彙總值本質上還是要掃過所有卡片才能得到答案，這件事不受這次拆分影響，維持現狀（掃描量是 touched 張數而不是總數，量級本來就比較小）。

## 這次不動的部分

- 圖章模式（`stamp`/`StampTool`/`stamp.ts`）：維持先前決定，之後照抄 tagger-b。
- `stagedEntry.ts`／`buildStagedEntry()`：本次已完成的投影邏輯不變，虛擬化只是換外層容器與拆分卡片元件的責任邊界，不改變 `StagedEntry` 的欄位定義。
- 交錯 wavy 效果：明確放棄，改為固定同寬高；未來若要做，需要一個新的、非貪婪權重的虛擬化模組（見上方 TODO 段落），不是這次的範圍。
