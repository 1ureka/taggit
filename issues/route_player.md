# Player 頁面路由 — 內部邏輯沙盒審查

審查範圍：`src/routes/player/**`（`+page.server.ts`、`+page.svelte`、`control/*`）。
依審查限制，所有外部套件與模組（`$lib/database`、`$lib/query`、`$lib/query-spec`、`$lib/image/client`、`$lib/icons`、`$lib/utils/shared`、`$lib/virtualizer/player.svelte`（`Player` 類別）、`svelte`/`svelte/transition`/`svelte/easing`）、路由參數與 API/load 回傳結果皆視為 100% 正確，僅分析目標模組內部的狀態機、副作用時機、事件處理與條件渲染。

---

## 1. 結構簡述

```
player/
├── +page.server.ts                 (load: images / total；集合為空則導向 "/"）
│
└── +page.svelte                    (根：本模組唯一的可寫狀態中樞)
    │   state:   feedback
    │   derived: images（附加 blurhash 樣式）/ animatedIndex
    │
    │   （player = new Player(...)、autoHide = new AutoHide() 為外部/本模組類別實例，
    │    其暴露的 playing / progress / speed / visibleItems / handleXxx 等成員本身視為外部狀態，
    │    僅審查本頁如何「使用」它們，不審查其內部實作）
    │
    ├── control/
    │   ├── Dock.svelte              (純展示：接收 player，轉發 play/pause、進度、速度)
    │   │   └── DockProgress.svelte     (純展示：input[type=range] 包裝，{...rest} 全轉發)
    │   ├── autoHide.svelte.ts       (AutoHide 類別：hideDock state + mousemove 監聽 $effect)
    │   └── findMiddle.ts            (findClosestToMiddle：純函式，由中央向兩側擴散搜尋)
```

資料流重點：

- **`feedback`**：`+page.svelte` 內唯一自行管理的可寫狀態，由 `$effect`（`+page.svelte:36-40`）讀取 `player.playing` 驅動，設為 `true` 後於下一個 `tick()` 設回 `false`，用來觸發播放/暫停圖示的一次性淡出動畫。
- **`animatedIndex`**：`$derived`，只依賴外部 `player.visibleItems`（虛擬化視窗）與本模組內的純函式 `matchesGif`/`findClosestToMiddle`，用來限制同一時間畫面上只有一張最靠近中央的 GIF 播放動畫、其餘皆以靜態縮圖呈現。
- **`autoHide`**：完全獨立的實例，只依 `document` 的 `mousemove` 事件決定 `hideDock`，與 `player` 的播放狀態沒有任何耦合，`+page.svelte` 僅用它的結果條件渲染 `PlayerDock`。

---

## 2. 內部 Bug 審查

- **`feedback` 效果在頁面掛載當下就會無條件執行一次**：`+page.svelte:36-40` 的 `$effect` 只讀取 `player.playing`。Svelte 的 `$effect` 會在建立後同步執行一次，因此即使使用者尚未做任何播放/暫停操作，一進入頁面就會把 `feedback` 設為 `true`、再於下一個 tick 設回 `false`，導致播放/暫停反饋圖示在首次載入時無條件閃爍一次。這與程式碼註解「用於觸發播放/暫停反饋的瞬間信號」（語意上應僅在使用者操作時觸發）不一致。
> 真實問題，另外我會希望未來剛進去時是暫停的而不是立刻播放

- **`feedback` 效果的 `tick()` 延續之間沒有互相取消，快速連續切換可能提早歸位**：`+page.svelte:36-40` 每次 `player.playing` 改變都會重新執行整個 effect 主體，建立一個新的 `tick().then(() => (feedback = false))`。若 `player.playing` 在前一個 `tick()` resolve 之前又再次改變（例如短時間內連續切換播放/暫停），會同時存在多個尚未 resolve 的延續；由於每個延續都只是單純把 `feedback` 設回 `false`，沒有任何機制判斷「自己是否仍對應最新一次觸發」，較早的延續 resolve 時仍會把 `feedback` 設為 `false`，可能讓對應「最新一次切換」的反饋顯示被提前中斷。
> tick 極短，尚不清楚該問題是否是真實問題

- **`hideDock` 與播放狀態完全無關聯**：`autoHide.svelte.ts:12-28` 的 `$effect` 只依賴 `document` 的 `mousemove`，與 `+page.svelte` 內的 `player.playing` 沒有任何耦合。當播放器處於暫停狀態、使用者移開滑鼠超過 `timeout`（2000ms）後，控制列（`PlayerDock`）仍會被自動隱藏；要再次顯示控制列，目前程式碼唯一路徑是重新移動滑鼠，沒有「暫停時常駐顯示控制列」的例外分支。是否為預期行為取決於產品需求，但純就目前程式碼邏輯而言，沒有任何條件式會依 `player.playing` 抑制自動隱藏。
> 刻意為之，預期行為，只是若未來重構，單獨有個 autoHide.svelte.ts 可能的確太小，不過也不確定是否有 controller 可以吸收他

- **（次要）`findClosestToMiddle` 在第一輪迴圈中會對同一元素判斷兩次**：`findMiddle.ts:6-12` 初始 `L = R = mid`，第一輪迴圈會先以 `L` 呼叫 `testFn(arr[L])`，緊接著又以 `R` 呼叫 `testFn(arr[R])`，此時 `L === R`，等於對 `arr[mid]` 重複呼叫了一次 `testFn`。目前唯一呼叫端 `matchesGif` 無副作用，不影響結果正確性，純屬多餘的重複執行。
> 若判斷對效能影響不大，可不修

- **（次要）`DockProgress.svelte` 完全依賴呼叫端提供無障礙屬性、自身無任何防呆**：`DockProgress.svelte:4` 的 `rest` 直接展開到 `<input>` 上，`id`/`aria-label` 等屬性完全由呼叫端（目前是 `Dock.svelte`）決定，元件本身沒有預設值或缺漏時的後備行為。目前兩處呼叫（進度、速度）皆有正確提供，此點僅為觀察到的潛在脆弱點，不是目前程式碼的作用中 bug。
> 頁面組件只要整體最終 OK，通用性本身不考慮

> 希望新增長按兩倍速(當前速度直接兩倍，可超過當前 input 上限)撥放(看方向也有可能是倒轉)

> 希望長按加速時，畫面正上方或角落顯示一個微小的 ▶▶ 2X 或 ◀◀ 2X 輕量提示字樣

> 希望新增箭頭按鍵監聽 +3 張或 -3 張(看方向)

---

## 3. Edge Case 清單

- [ ] 頁面剛掛載、使用者尚未操作播放/暫停 -> 反饋圖示仍會閃爍一次 -> [未解決]
- [ ] 短時間內連續切換播放/暫停，多個 `tick()` 延續重疊 -> [未解決]
- [ ] 可見範圍（`player.visibleItems`）內沒有任何 `.gif` -> `animatedIndex = -1`，無圖片播放動畫 -> [已解決]
- [ ] 可見範圍內有多個 `.gif` -> 僅最靠近中央者播放動畫 -> [已解決]
- [ ] 圖片集為空（`stagedFiles`/`images` 為空）-> 由 `+page.server.ts` 於 load 階段導向 `/`，不會進入本頁渲染 -> [已解決]
- [ ] 暫停狀態下滑鼠靜止超過 2 秒 -> Dock 仍自動隱藏，無法單純靠暫停保持常駐 -> [未解決/待確認是否為預期]
- [ ] 僅使用鍵盤操作播放器（`svelte:window onkeydown`）、滑鼠長時間未移動 -> Dock 已隱藏但鍵盤操作仍可用，控制列視覺上不可見 -> [未解決/待確認]
- [ ] 視窗縮放或欄數變動導致 `player.visibleItems` 大幅變化 -> `animatedIndex` 重新計算 -> [已解決，純函式重算]
