# `routes/staged` 重寫總結

`staged` 已改寫成與 `committed` 同構的架構：`logic/` 放 12 個領域 controller，
`body/` 與 `header/` 只放純元件。圖章模式移除，改由多選 + 批次表單取代。

本文件只記錄**從程式碼看不出來的理由**，檔案結構與 API 請直接看原始碼。

---

## Controller 一覽（`staged/logic/`）

| 檔案 | 職責 | 與 `committed` 的關係 |
| --- | --- | --- |
| `page-data.svelte.ts` | 包裝 `load` 的 `data` | 逐字相同 |
| `drafts.svelte.ts` | 本地編輯草稿、驗證、生效名稱 | 同一套演算法，基準值來源不同 |
| `pointers.svelte.ts` | 編輯指標 + 全螢幕預覽指標 | 同形，但不寫入 URL |
| `submit.svelte.ts` | 批次提交 | 同形，少了樂觀鎖與退回分支 |
| `deletion.svelte.ts` | 永久刪除單張 | **無對應物** |
| `refresh.svelte.ts` | 重新整理清單 | 對應 `committed` 掛在 `query` 上的那段 |
| `import.svelte.ts` | 匯入紀錄（SSE） | **無對應物** |
| `guard.svelte.ts` | 離頁守衛 | 同形 |
| `review.svelte.ts` | 審查清單、分批 25 筆 | 逐字相同（少了退回來源） |
| `tag-impact.svelte.ts` | 標籤庫影響評估 | **刻意不共用**，見下 |
| `selection.svelte.ts` | 多選模式 | 逐字相同 |
| `selection-draft.svelte.ts` | 批次編輯表單 | 同形，少了退回欄位 |

`+page.svelte` 的建立順序有兩個是必要的：`deletion` 在 `pointers` 之後（刪完要跳下一張），
`guard` 在 `review` 之後（待提交張數取自審查清單）。

---

## 關鍵決策與理由

### 1. 沒有 `snapshots`，因為基準是純值

`committed` 的編輯基準是會隨 `load` 重跑而變動的 DB 快照，需要引用計數快取。
`staged` 的基準恆為 `{ name: "", rating: 0, tags: [] }`，是純值、算得出來，
所以 `drafts` 的 `mutate` / 自動 discard / `problemOf` 可以與 `committed` 同形，卻不需要 `snapshots`。

### 2. `drafts.touchedFiles` 走 `stagedFiles` 交集過濾

這是兩頁 `drafts` **唯一一行實作差異**（`committed` 是純 `Object.keys`）。
原因是匯入紀錄會讓檔案直接離開暫存區，不過濾的話審查清單會留下必然提交失敗的幽靈項目。

對應地，`handleDiscardAll` 走的是原始鍵而非 `touchedFiles`，
確保離頁清空時連已離開清單的草稿也一併清掉。

### 3. `tag-impact` 刻意不與 `committed` 共用

`committed` 需要「淨變化 delta」是因為它同時有新增與退回造成的移除，
必須算 `before + delta` 才知道標籤會不會變孤兒。
`staged` 只會新增，永遠不產生孤兒，所以簡化成「這些標籤現在的使用數是不是 0」，約 35 行對 95 行。
共通的只有 debounce + `seq` 作廢那個模式，不值得為它抽象。

### 4. 刪除是即時單張操作，不是標記

`committed` 的「退回」是可批次、進審查清單、可取消的標記；
`staged` 的「刪除」永遠是「一張圖 + 一次 confirm + 立刻執行」，不進審查清單、不出現在批次表單。
因此獨立成 `deletion` controller，而不是塞進 `pointers`（會沾到 API 與對話框）或 `submit`（語意不同）。

刪除後的鄰居必須在 `invalidateAll` **之前**算好，之後該檔案已不在清單裡。

### 5. 編輯指標不寫入 URL

`committed` 用 `SvelteShallowParam("currentId")`，`staged` 用純本地 `$state`。
代價是重新整理後回不到原本編輯的那張；換到的是頁面完全不涉及淺路由，
所有 `goto` 都能無條件從 `location` 取值，不必擔心 `page.url` 脫鉤。

### 6. pending 各自獨立，guard 聚合三個來源

沒有全頁共用鎖。`submit` / `deletion` / `import` / `refresh` 各自帶 `pending`，
UI 上每個按鈕只 disable 自己。`guard` 的「進行中」判定聚合前三者，
`refresh` 不算（它只是重跑 `load`）。

### 7. 圖章模式由多選批次取代

原本的拖曳筆劃、`strokeSet`、`suppressClickFile` 整套移除。
連續套用同一組標籤／評等改成「進多選 → 框選 → 批次表單勾選欄位 → 套用」。
失去拖曳手感，換到與 `committed` 完全一致的心智模型與程式碼。

---

## 元件劃界

**原則：`$lib` 只留「殼與版面」，「欄位內容與動作文案」歸頁面。**
判準是——如果一個元件必須用 `variant` 或旗標區分「這是 committed 的樣子 / 這是 staged 的樣子」，它就不該在 `$lib`。

依此把四個表單元件從 `$lib/components/workflow/` 下放到各頁 `body/`，命名以 `Panel` 為共用前綴、
變體類型放在 `Fields` 之前，組裝樞紐用中性的 `Panel.svelte`：

| | `committed/body/` | `staged/body/` |
| --- | --- | --- |
| 組裝樞紐 | `Panel.svelte` | `Panel.svelte` |
| 單張欄位 | `PanelFields.svelte` | `PanelFields.svelte` |
| 批次欄位 | `PanelBatchFields.svelte` | `PanelBatchFields.svelte` |
| 退回唯讀檢視 | `PanelRevertFields.svelte` | —（無退回概念） |
| 底部動作列 | `PanelFooter.svelte` | `PanelFooter.svelte` |

`Panel.svelte` 是唯一知道「現在是批次還是單張」的地方，子元件只收 props、不碰 context，
這樣型別上的 `pointer !== null` 守衛只寫一次。

`$lib` 剩下的 `ImageRecordPanel` / `ImageRecordPanelHeader` / `ImageRecordPanelImage` /
`ImageRecordCardWrapper` / `ImageRecordCardInfo` 與所有 `review/*` 皆兩頁共用、未修改。

---

## 連帶改動

| 位置 | 改了什麼 | 為什麼 |
| --- | --- | --- |
| `committed/logic/guard.svelte.ts` | `pendingCount` 改讀 `review.totalCount` | 原本兩個來源相加，同時有草稿與退回標記的檔案會被算兩次，跟 ReviewTrigger 徽章對不上 |
| `$lib/utils/request.ts` | 新增 `api.stream()` | SSE 的 fetch／錯誤解析／frame 拆解是純傳輸邏輯，且錯誤解析與 `request()` 重複；抽上來後 `import-api.ts` 整檔消失 |
| `api/staged/[filename]` | 刪除 `POST` | 前端零呼叫端，且註解宣稱的「向後相容匯入」是過期的——匯入走 `/api/committed` |
| `api/proto/staged-batch` | `name` 改必填，不再補值 | 後端的 `path.basename(f, extname(f).toLowerCase())` 大小寫不一致，`photo.JPG` 剝不掉副檔名。前端本來就需要 `nameOf` 顯示，改由前端解析等於零成本換掉一份錯誤實作 |

> 既有資料不會自動修正：先前用 staged 提交過、副檔名為大寫且未自訂名稱的紀錄，
> `name` 仍帶著副檔名，需要時手動清理。

---

## 待人工驗收

`npm run check` / `build` / `test` 皆已通過，但 `logic/` 的執行期邏輯尚未實際跑過。

### 單張編輯
- [ ] 名稱欄位為空、placeholder 顯示去副檔名的檔名
- [ ] 填標籤後卡片出現綠色標記；只填名稱不填標籤為黃色
- [ ] 欄位全部改回空白，卡片標記自動消失（草稿被自動捨棄）
- [ ] 「刪除此張」confirm 後，面板自動跳到清單下一張；刪最後一張時跳上一張

### 多選 / 批次（全新功能）
- [ ] Rail 切多選，原本編輯中的那張自動被選取
- [ ] 批次表單只有三欄、沒有退回標記、沒有任何欄位會變灰鎖定
- [ ] 套用後所有選取卡片的草稿同步更新，表單自動重置
- [ ] 切回單選 / 重新整理 / 提交 / 刪除後選取狀態清空

### 審查與提交
- [ ] 超過 25 筆出現換頁列，換頁後自動全選該批可送出項目（全新功能）
- [ ] 標籤影響提示**永遠不會**出現移除／孤兒相關文案
- [ ] 部分失敗時失敗項目留在清單並顯示原因、成功項目消失
- [ ] 點清單裡的名稱可跳回該張繼續編輯（同時關閉對話框並退出多選）

### 匯入與守衛
- [ ] **匯入前先填草稿，匯入後該檔案離開暫存區 →「檢視變更」數字要跟著減少**
- [ ] 提交 / 刪除 / 匯入進行中時導航，顯示「操作進行中，請稍候」
- [ ] 有未提交草稿時導航或重新整理，跳出確認框
