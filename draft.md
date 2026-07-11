## 整體改善

- 客戶端導航要有最低限度的載入提示，也就是說當某行為或導航沒有寫好載入時，至少還是有某些通用的指示發生在 +layout
- 改善詳細排序能力
- 新增標籤為核心的頁面路由
- 各處的 tag chip 也應該在是隱藏的標籤顯示與 autocomplete 下拉選單中是隱藏的標籤相同的外觀

## 改善 /tagger, /editor

- 目前的輸入驗證很糟糕，包括但不限於沒有實時驗證、後端的驗證失敗 message 過於模糊、前端有些情況下完全不提後端的 message 等等
- tagger 匯入紀錄按鈕不再直接打開檔案總管，而是先出現與本 app 相同風格的 modal 說明格式要求等的引導說明文字
- editor dirty 時，導航(客戶端導航也好、瀏覽器關閉等)完全沒有要警告的
- 批量處理過於不直觀，有些 UX 依靠的是隱性關係、行為等

以上逐個解決會導致兩個路由越來越亂，原因是當前的寫法太想要做 UI 與 業務邏輯之間的分離，導致難以更新，因此在開始前必須先提出新的寫法，不用一次套用到整個專案，但至少 /tagger, /editor 應該要有新的架構才更新得下去

## 程式碼品質

import 路徑有問題，目前大量使用 `from **/something.js` 但應該可以省略 js，除非一個檔案同時導入 `a.svelte.ts + a.svelte` 但這幾乎不會發生，同時由於這個錯誤習慣，導致甚至有可能會出現 `from **/module/index.js` 這種荒謬的寫法

所有新寫的檔案、更新要改的檔案，都應該不讓這件事發生或者順便修復這件事

## Bug：/editor 切換圖片會壓垮後端（重寫時務必避免）

**現象**：`/editor` 快速或長按方向鍵切換圖片時有明顯延遲，長按後後端幾乎當掉——連 routing 與原圖 `xl` 串流都要等很久。`/tagger` 做同樣操作則完全順暢、瞬間反應。

**根因**：editor 的「切換當前圖片」是靠 SSR 完成的。方向鍵 → `editorList` 的 `#navigateTo` → `goto("?currentId=...")`，因 URL 變動而**重跑 `editor/+page.server.ts` 的 `load`**。這個 load 每次都做全量同步工作：`query.images(limit:0)` materialize + 排序整份已提交清單、`query.facets`、`query.tags`、`getImage`，並把**整份 `committedFiles` 重新序列化成 JSON** 回傳。

長按時瀏覽器的 key repeat 以每秒數十次連發 `goto`，而 `#navigateTo` **沒有任何去抖/節流**。這些請求在單執行緒 Node 上同步執行、無法被前端 abort 取消，於是在後端形成**不斷增長的積壓佇列**，把 event loop 反覆佔滿，餓死其他所有請求。

對比：tagger 的切換（`taggerList` 的 `#navigate`）是純前端 state 變更，**一次後端都不打**，清單只在初次載入查一次。差別純粹在「打幾次後端」，不是查詢速度——DB（bitset / facet-index）其實寫得很好。

**重寫時的要求**：
- 「切換當前圖片」必須是純前端行為，不得每次回 server。editor 前端已握有完整 `committedFiles`（`ImageWithId[]`），`currentRecord` 應由前端 `find(currentId)` 導出，不需 SSR 重查。
- URL 若要反映 currentId，用 `history.replaceState` 同步網址列，**不要**用會觸發 load 重跑的 `goto`。
- 只有真正需要與 server 同步的時機（存檔 / 退回 / 手動重整）才 `invalidateAll()`。
- 任何會連發的互動（key repeat、捲動、輸入）都要有去抖/節流或改為純前端。
