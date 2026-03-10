# 邏輯錯誤審查報告

> 最後更新：2026-03-10

本報告記錄專案中經審查發現的**邏輯錯誤**（編譯器無法偵測的 Bug）。
每項附有嚴重等級、位置、問題描述與修正建議。

---

## 目錄

- [CRITICAL](#critical)
- [MEDIUM](#medium)
- [LOW](#low)

---

## CRITICAL

### 1. LRUCache.set() — 快取容量不變量違反

**位置**：`src/lib/server/resources.ts`

LRU 快取在單一項目大於 `maxBytes` 時仍會寫入，導致 `currentBytes` 超過上限。

```typescript
while (this.currentBytes + byteSize > this.maxBytes && this.map.size > 0) {
  // 當 byteSize > maxBytes 時，迴圈清空所有項目後仍會插入超大項目
}
```

**範例**：`maxBytes = 512MB`，單一圖片處理後為 600MB → 強制寫入後 `currentBytes = 600MB`。

**建議**：在插入前檢查 `byteSize > this.maxBytes`，若超過則直接跳過或回傳不快取。

---

## MEDIUM

### 2. Autocomplete addTag() — 大小寫敏感的重複檢查

**位置**：`src/lib/client/autocomplete.svelte.ts`

下拉選單過濾用 `toLowerCase()` 排除已選標籤，但 `addTag()` 用原始大小寫的 `includes()` 做重複檢查。`"Cat"` 和 `"cat"` 可能被重複加入。

---

### 3. ConfirmModal — Escape 鍵事件未消費

**位置**：`src/lib/components/ConfirmModal.svelte`

全域 Escape 鍵處理器沒有呼叫 `preventDefault()` / `stopPropagation()`，可能與其他元件的 Escape 處理器衝突。

---

### 4. Trash 選取項在換頁時被清除

**位置**：`src/routes/trash/trashPagination.svelte.ts`

`validateSelection()` 在換頁後只保留當前頁面上的已選項。使用者在第 1 頁選取後切換至第 2 頁，第 1 頁的選取會被靜默清除。

**備註**：可能為刻意設計，但對使用者不友好。若為預期行為，建議加入 UI 提示。

---

## LOW

### 5. renameTag() — 對重複標籤處理脆弱

**位置**：`src/lib/server/db-mutation.ts`

若記錄中存在重複標籤（違反驗證規則），`indexOf` 只取代第一個。範例：`["apple", "cat", "cat", "dog"]` 中將 `"cat"` 改名為 `"dog"`，結果仍殘留一個 `"cat"`。

**風險**：極低，因正常情況下驗證會阻擋重複標籤。

---

### 6. POST /api/staged/[filename] — getImageMeta 失敗時檔案孤立

**位置**：`src/routes/api/staged/[filename]/+server.ts`

檔案先移至 `committed/`，之後 `getImageMeta()` 若拋出錯誤，`addImage()` 不會執行，檔案孤立。

**緩解**：Settings → Maintenance → Orphan Check 可偵測並清理。

---

### 7. DELETE /api/images/[id] — 檔案與資料庫狀態不一致

**位置**：`src/routes/api/images/[id]/+server.ts`

檔案先移至 trash，若 `removeImage()` 拋出錯誤，檔案已消失但資料庫記錄仍存在。

**緩解**：`removeImage()` 僅操作記憶體物件（極不可能失敗），且 Maintenance 有 Missing Files Check / Orphan Files Check 安全網。

---

### 8. DELETE /api/images/[id] — 檔案不存在仍刪除資料庫記錄

**位置**：`src/routes/api/images/[id]/+server.ts`

當 committed 檔案不存在時，資料庫記錄仍被靜默移除。

---

### 9. Editor 防抖儲存 — 缺少 $effect 清理

**位置**：`src/routes/editor/[id]/editorPanel.svelte.ts`

`setTimeout` 可能在元件卸載後觸發。

---

### 10. Trash 批次操作 — 無並行執行防護

**位置**：`src/routes/trash/trashSelectionDock.svelte.ts`

雙擊可觸發兩個平行的循序 API 迴圈。

---

### 11. Editor 批次評等 — 循序 API 呼叫

**位置**：`src/routes/editor/editorSelectionDock.svelte.ts`

使用循序 `await` 迴圈而非 `batchRun()`（Tagger 則有使用）。效能問題。

---

### 12. /api/maintenance/orphans DELETE — TOCTOU 競爭

**位置**：`src/routes/api/maintenance/orphans/+server.ts`

`hasImage()` 檢查與 `unlinkSync()` 之間，另一個請求可能已提交該檔案。單線程 Node.js 下風險極低，但多 worker 部署時可能刪除剛入庫的檔案。
