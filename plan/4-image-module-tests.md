# 4. image 模組測試規劃

> 為 `src/lib/image/` 補上後端測試，比照既有 `test/repo` 領域的做法（`loader` + `fixtures` + `suite`），不引入 Vitest/Jest，也不在 repo 裡簽入圖片二進位檔——測試用圖全部由 `sharp` 在執行當下合成。

## 狀態：已完成 ✅

`test/image/` 已建立並登記進 [test/run.mjs](../test/run.mjs) 的 `DOMAINS`。
`node ./test/run.mjs image` → **98 passed / 0 failed**；`node ./test/run.mjs`（全領域）→ **478 passed / 0 failed，約 1.5s**（新增的 sharp 測試未明顯拉長整體耗時）。未新增任何 npm 依賴，未簽入任何圖片二進位檔。

### 已落地的檔案

```
test/image/
  fixtures.mjs           載入 image 模組、提供合成圖工具（putImage/putAnimated/putText）與隔離目錄
  resources.suite.mjs    LRUCache（淘汰/LRU 順序/覆寫扣抵/clear/stats）、TaskPool（併發/排隊/drain/reject 不卡池）
  formats.suite.mjs      isImageFile/isValidSize/mimeTypeOf/IMG_EXTS + 順帶覆蓋 imgSrc
  blurhash.suite.mjs     blurhashStyle（cover data-uri / contain SVG wrapper / 缺寬高退回 / 極端長寬比）
  metadata.suite.mjs     generateMetadata（吞錯回零值）/ readImageInfo（檔案不存在丟例外）
  processor.suite.mjs    ImageProcessor.get（尺寸 bound 間接驗證 thumbnailSize、快取命中、in-flight 去重、animated 多幀、clear/stats）
  server.suite.mjs       ImageLibrary（ensureActive 切 dir 清快取、resolve/has 穿越檢查、list、probe、payload、clear/stats）
```

### 落地時與原規劃的差異（都已驗證）

- **animated 冒煙驗證已完成**：`sharp` 0.34.5 的 `join({ animated: true })` 合成多幀 GIF、以 `{ animated: true }` 讀回 `pages > 1` 皆符合預期，已正式寫入 `putAnimated` 與 `processor.suite.mjs`。
- 靜態 webp 以 `{ animated: true }` 讀回時 `metadata().pages` 為 `undefined`（非 `1`），斷言改用 `pages ?? 1 === 1` 表達「單幀」。
- `readImageInfo` 為 async，「檔案不存在丟例外」用 `try/await/catch` 斷言（`t.throws` 只認同步拋出）。

## 有意不做（非待辦，為記錄保留）

以下是規劃「需要決策」一節的結論，屬於刻意不覆蓋的範圍，不是未完成項：

1. **不 export `gcd`/`thumbnailSize` 直接單元測**：比照 `database/bitmap.ts` 的 `popcount32` 先例，只透過 `get()` 的輸出尺寸間接驗證，不為測試破壞私有性。
2. **不測「冷啟動未 active」（503）情境**：`ImageLibrary` 是 `globalThis` 單例，跨 suite 共用狀態，一旦任何 suite 呼叫過 `ensureActive` 就永遠 active（與 repo 領域不測 `Database` 未 `ensureLoaded` 的處理一致）。真正的冷啟動行為留給手動/整合測試。
3. **in-flight dedupe 只驗可觀察行為**：只斷言「兩個同時發出的 `get()` resolve 成同一 buffer 且只留一筆快取」，不 spy `process()`/sharp 的實際呼叫次數（超出目前簡單斷言框架的範圍）。
