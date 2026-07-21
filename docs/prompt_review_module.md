請幫我審查系統（包含前端與後端全域）中是否存在導致執行緒/主線程阻塞的效能瓶頸，並評估這些阻塞是否會拖慢整體系統回應速度或造成使用者體驗卡頓。

包括但不限於

- **後端與 I/O 阻塞：** 未採用非同步（Async/Await、Thread Pool）的資料庫查詢、外部 API 呼叫或檔案讀寫。
- **CPU 密集型計算：** 在關鍵執行緒（如 API Request Handler 或主線程）執行的重度運算、加解密、大資料處理，且未做分塊（Chunking）、讓權（Yielding）或切換至 Background Worker/Worker Thread。
- **前端與 UI 渲染阻塞：** 占用瀏覽器 Main Thread 的長任務（Long Tasks）、高頻率 DOM 重繪與排版計算（Reflow/Repaint）、未採用 Web Worker 的前端計算，或阻塞渲染的同步資源載入。

對於你發現的每個阻塞/瓶頸點，請統一使用以下框架進行評估，並說明是否有必要進行優化或非同步/解耦改寫

1. **阻塞點描述：** 說明引發阻塞的具體操作與層級（例如：後端 DB 查詢、前端主線程長任務、重算大陣列等）。
2. **發生頻率與影響度：** 該操作是高頻發生還是特定情境觸發？是否會佔用關鍵執行緒（如 Event Loop / Main Thread），導致後續請求排隊或畫面卡頓（Jank / Unresponsive）？
3. **具體建議：** 若需要修改，請給出推薦的處理方向（例如：改用 Async API、引入 Web Worker / Worker Thread、做計算分流與 Chunking、引入 Message Queue、或採用分頁/懶載入等）。
