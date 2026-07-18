# `/tagger` 頁面現況審查

範圍：`src/routes/(app)/tagger/**` 及其直接呼叫的 API（`/api/proto/staged-batch`、`/api/staged/[filename]`、`/api/committed`）。
判斷基準：只看目前程式碼實際會怎麼跑，不管遷移文件、規劃文件、或記憶裡記的「應該長怎樣」。

---

## 結論先講

1. **確認 bug：`Lightbox.svelte` 全螢幕預覽的頁碼顯示、上一張/下一張的可按判斷全部算錯**，根因是 `+page.svelte` 傳進去的 `index` 是 0-based 陣列索引，但 `Lightbox.svelte` 當成 1-based 在用（跟同頁 `InspectorHeader` 的 `activeIndex` 明確 `+1` 對照就看得出不一致）。實際後果：頁碼永遠少 1；**檢視第 2 張時「上一張」會被誤判成不可按**；**檢視最後一張時「下一張」永遠不會被停用**。
2. **確認 bug：`pending` 被同時拿來表示「這筆暫存目前結構不合法」和「現在有任何不相關的非同步操作正在跑」，兩者共用同一個 `disabled` 欄位**，導致按下「重新整理」「匯入紀錄」「刪除此張」甚至「提交」的當下，審查清單/工具列的「可提交」統計會短暫失真，其中一個具體症狀是提交中「全選」列會顯示成 `N / 0 可提交紀錄已選取` 這種自相矛盾的數字。
3. **次要觀察（非典型路徑才會踩到，但確實是現況行為）：卡片牆（`Card.svelte`/`CardInfo.svelte`）完全不知道 `failures` 這個狀態存在**，提交失敗後只要使用者手動關掉審查對話框，卡片牆上那張圖看起來會跟「從沒提交過、內容合法」的其他已填寫卡片一模一樣（綠勾），沒有任何線索告訴使用者剛剛失敗過。
4. 另外記錄了三個**已經懷疑過、但追完程式碼後可以排除**的點（見最後一節），避免之後重複懷疑同一個地方。

---

## 一、`Lightbox` 索引 0-based / 1-based 不一致

### 程式碼定位

`+page.svelte` 算 `lightbox` 這個 `$derived.by`（第 66–71 行）：

```ts
const lightbox = $derived.by(() => {
  if (lightboxFile === null) return null;
  const index = data.stagedFiles.indexOf(lightboxFile); // 0-based
  if (index < 0) return null;
  return { filename: data.stagedFiles[index], index };
});
```

對照同一個檔案裡 `activeIndex` 的算法（第 56 行，給 `InspectorHeader` 用）：

```ts
const activeIndex = $derived(activeFile !== null ? data.stagedFiles.indexOf(activeFile) + 1 : 0);
```

`activeIndex` 特地 `+ 1` 轉成「第幾張（1-based）」給人看；`lightbox.index` 沒有做這件事，是純陣列索引，且它同時被拿去做導覽運算（`navigateLightbox` 用 `Math.max(0, ...)` / `Math.min(files.length - 1, ...)` 夾住，這部分假設 0-based 是對的，不能亂改）。

問題出在 `Lightbox.svelte` 收到這個 0-based 的 `index` 之後，把它當 1-based 用了三個地方：

```svelte
<!-- 第 33 行：頁碼顯示 -->
<Chip variant="outlined" style="font: var(--font-caption);">{`${index} / ${total}`}</Chip>

<!-- 第 44-53 行：上一張 -->
<Button
  ...
  status={index <= 1 ? "disabled" : undefined}
  onclick={onprev}
  ...
>

<!-- 第 55-64 行：下一張 -->
<Button
  ...
  status={index >= total ? "disabled" : undefined}
  onclick={onnext}
  ...
>
```

`Button` 的 `status="disabled"` 會直接落到原生 `disabled` 屬性（`ButtonSnippets.svelte` 第 33 行 `disabled={status === "disabled" || status === "pending"}`），也就是說一旦判斷錯，那顆按鈕是**真的按不下去**，不是純視覺上的樣式問題。

### 用 3 張圖具體推演

假設 `stagedFiles = ["a.jpg", "b.jpg", "c.jpg"]`，`fileCount = total = 3`。

| 目前檢視 | `index`（0-based） | 頁碼顯示 | 正確頁碼 | 上一張判斷 `index<=1` | 應該的結果 | 下一張判斷 `index>=total` | 應該的結果 |
|---|---|---|---|---|---|---|---|
| a.jpg | 0 | `0 / 3` | `1 / 3` | `0<=1` → 停用 | 停用（對，剛好蒙對） | `0>=3` → 啟用 | 啟用（對） |
| b.jpg | 1 | `1 / 3` | `2 / 3` | `1<=1` → **停用** | **應為啟用** | `1>=3` → 啟用 | 啟用（對） |
| c.jpg | 2 | `2 / 3` | `3 / 3` | `2<=1` → 啟用 | 啟用（對） | `2>=3` → 啟用 | **應為停用** |

看第二列：**檢視清單中第 2 張圖時，「上一張」按鈕會被鎖死**，使用者沒辦法用這顆按鈕退回第一張（只能關掉大圖重開）。看第三列：**檢視最後一張時「下一張」永遠是可按的**，點下去 `navigateLightbox` 雖然會被 `Math.min` 夾住不會出錯，但按鈕看起來像還有下一張，其實是個沒有反應的死點擊。第一列純屬巧合才「看起來對」。

頁碼顯示則是每一張都固定少 1，這個沒有例外。

### 根因一句話

`Lightbox.svelte` 裡的邊界判斷、頁碼顯示，明顯是照抄 `InspectorHeader` 那種「`activeIndex` 已經是 1-based」的心智模型寫的，但呼叫端（`+page.svelte`）給 `Lightbox` 的 `index` 從頭到尾就沒做過那個 `+1`——兩邊對「index 是幾 based」的假設不一致。

---

## 二、`pending` 與「可提交 / 已勾選」統計語意混淆

### 程式碼定位

`reviewEntry.ts` 第 25–44 行 `buildReviewEntry`：

```ts
return {
  ...
  problem: problem ?? (failure ? `提交失敗：${failure}` : null),
  checked: problem === null && checked,
  disabled: problem !== null || pending,
};
```

`disabled` 把兩件事揉在一起：「這筆草稿結構上不合法」（`problem !== null`）跟「現在頁面正在跑某個不相關的非同步操作」（`pending`）。而 `pending` 是整頁共用的單一鎖（`+page.svelte` 第 27 行註解就寫「全頁共用的操作鎖」），會在四種完全不同的操作中被設成 `true`：`handleRefresh`（重新整理）、`handleImportFile`（匯入 JSON）、`handleDeleteFile`（刪除單張暫存圖）、`handleSubmit`（提交審查）。

`readyCount`（`+page.svelte` 第 64 行 `reviewEntries.filter((e) => !e.disabled).length`）跟 `SessionProgress.svelte` 第 16 行 `blockedCount = touchedCount - readyCount` 都是拿這個混合欄位去算「可提交張數」——所以：

- 只要按下「重新整理」（`handleRefresh`，第 245–255 行），哪怕沒有任何一張草稿真的變不合法，`pending` 變 `true` 的那一小段時間內（200ms debounce + `invalidateAll()` 的往返時間），`readyCount` 會瞬間掉到 0，`SessionProgress` 的 tooltip 會把**所有已填寫的圖片都標成「其中尚無法提交」**。
- 匯入 JSON（`handleImportFile`）、刪除單張暫存圖（`handleDeleteFile`）也是同樣道理，且這兩個操作跟「這些暫存圖片能不能提交」根本沒有邏輯關係。

### 更直接可見的症狀：審查對話框裡的「全選」列

`ReviewList.svelte` 第 27–31 行：

```ts
const bulkSelectionState = $derived.by(() => {
  if (checkableCount === 0 || checkedCount === 0) return "unchecked";
  if (checkableCount === checkedCount) return "checked";
  return "indeterminate";
});
```

`checkableCount`（= `entries.filter(!disabled).length`，由 `ReviewModal.svelte` 第 35 行算）在提交送出去、`pending` 變 `true` 的那個當下會直接變成 0（因為每一筆 `disabled` 都因 `pending` 變 `true`），但 `checkedCount`（= `entries.filter(checked).length`）不受 `pending` 影響，維持原本被勾選的數字。於是第 70 行的文字：

```svelte
<span>{checkedCount} / {checkableCount} 可提交紀錄已選取</span>
```

在每一次點「提交」之後、伺服器回應之前，都會短暫顯示成類似「**3 / 0 可提交紀錄已選取**」——選了 3 筆，但可提交的卻是 0 筆，字面上互相矛盾。這是 100% 會重現的（只要提交耗時 > 0ms，也就是每一次提交都會發生），比前面 `SessionProgress` 那個還更容易踩到。

需要說明的是：這個問題**目前只影響顯示統計，不影響實際送出的內容**——`handleSubmit`（`+page.svelte` 第 90 行）是用 `reviewEntries.filter((e) => e.checked)` 去算要送出的檔名，`checked` 本身沒有被 `pending` 污染，所以不會漏送或送錯。純粹是統計數字暫時性地講不通。

---

## 三、次要觀察：卡片牆不反映提交失敗狀態

`Card.svelte` 第 21 行：

```ts
const problem = $derived(problemOf(draft));
```

這裡只呼叫了純草稿驗證 `problemOf`，跟 `buildReviewEntry`（`reviewEntry.ts` 第 40 行）不一樣的地方在於：`buildReviewEntry` 還會把 `failures[f]`（上一次提交失敗訊息）併進 `problem` 裡，`Card.svelte`／`CardInfo.svelte` 完全沒有接到 `failures` 這個 prop，也没有任何管道拿到它。

實際後果：假設一次提交裡有 1 張因為伺服器端驗證失敗（`failures[f]` 被設值），根據 `handleSubmit`（第 89–115 行）的邏輯，只要 `result.size > 0`（有任何失敗）審查對話框會保持開啟（第 107 行 `if (result.size === 0) reviewOpen = false;`），使用者可以在對話框裡看到失敗原因。但如果使用者手動關掉這個對話框（`handleReviewClose`，第 153–155 行，只要沒在 `pending` 中就允許關閉），回到卡片牆看那張失敗的圖——`Card.svelte` 算出來的 `problem` 只看 `problemOf(draft)`，跟正常合法的草稿沒有兩樣，卡片上顯示的是綠勾（`CardInfo.svelte` 第 27–28 行 `IconCheckFilled`），完全看不出剛剛提交失敗過。使用者必須重新打開審查清單才能再次看到錯誤訊息。

嚴重度不高（伺服器端驗證規則目前跟前端 `problemOf`/`Validator` 幾乎一致，實務上很少真的觸發這種伺服器獨有的驗證失敗），但這是目前程式碼確實存在的行為缺口。

---

## 四、幾個具體使用情境的程式碼路徑追蹤

以下都是照現有程式碼逐步走，不含任何「應該怎樣」的假設。

### 情境 1：編輯一張暫存圖並提交（全部成功）

1. 使用者點卡片牆上的縮圖 → `Card.svelte` `onclick` → `onselect(filename)` → `+page.svelte` 的 `handleOpenInspector` → `setActiveFile(file)`（第 239–241、75–78 行）。
2. `setActiveFile` 用 `drafts[file] ??= emptyDraft()` 補一份空草稿（若尚未存在），再設 `active = file`。
3. `activeFile`（`$derived`，第 54 行）重新計算為 `file`（因為它在 `data.stagedFiles` 裡），`Inspector` 被 `{#if activeFile !== null && drafts[activeFile]}`（第 300 行）渲染出來，`bind:draft={drafts[activeFile]}` 建立雙向綁定鏈一路通到 `InspectorFields` 裡的 `TextInput`/`Rating`/`TagInput`。
4. 使用者在 `TagInput` 裡打字並用逗號送出 → `TagInput.svelte` 的 `commitTags`（第 86–99 行）把字串 trim、去重、過濾已存在的標籤，寫回 `draft.tags`（透過綁定鏈直接改到 `drafts[activeFile].tags`）。
5. `touchedFiles`（第 52 行）、`reviewEntries`（第 58–60 行，呼叫 `buildReviewEntry`）、`readyCount`（第 64 行）全部是 `$derived`，自動跟著重算；`Toolbar` 上「檢視待提交的變更 (N)」的 N 即時更新。
6. 使用者點「檢視待提交的變更」→ `handleReviewOpen`（第 119–122 行）：先把 `failures` 清空，再把 `reviewOpen` 設 `true`。
7. `ReviewModal` 開啟，`ReviewList` 逐筆渲染 `entries`；使用者點「全選」或個別勾選 → `handleReviewToggle`/`handleReviewToggleAll` → 直接操作 `checkedFiles`（`SvelteSet<string>`）。
8. 點「提交」→ `ReviewFooter` 的 `onsubmit` → `+page.svelte` 的 `handleSubmit`（第 89–115 行）：取出 `checked` 的檔名 → `pending = true` → `commitDrafts`（`draft.ts` 第 55–71 行）POST `/api/proto/staged-batch`。
9. 伺服器端（`+server.ts` 第 37–110 行）逐筆檢查安全檔名、是否為圖片、`query.hasImage`（是否已提交過）、實體檔案是否存在，再呼叫 `mutation.commitRecord`（內部即 `ImageCommands.commit`，`image.ts` 第 26–55 行）——驗證規則（`Validator.tags`/`Validator.name`，`validator.ts` 第 10–36 行）跟前端 `problemOf`（`draft.ts` 第 19–30 行）幾乎一致，且伺服器端 `normalizeTags`（`image.ts` 第 14–17 行）還會再 trim + 自然排序一次。
10. 全部成功 → `result.size === 0` → 逐一 `delete drafts[f]`、`checkedFiles.delete(f)`、`reviewOpen = false`、`addToast` 成功訊息、`invalidateAll()` 讓 `+page.server.ts` 重新載入 `stagedFiles`（此時這些檔案已經 `query.hasImage` 為真，會被過濾掉）跟 `existingTagNames`。

### 情境 2：提交時部分失敗

延續情境 1 第 8-9 步，若其中一筆 `mutation.commitRecord` 回傳失敗（例如同時有另一個分頁已經把同一張圖提交掉，觸發 `query.hasImage` 檢查而回「已提交過，請重新整理列表」）：

- `commitDrafts` 回傳的 `Map` 只包含失敗的項目 → `failures = Object.fromEntries(result)`（第 96 行）。
- `reviewEntries` 這個 `$derived.by` 因為讀了 `failures`，會自動重算：失敗的那筆 `buildReviewEntry` 算出 `problem = failures[f]` 非 null → `checked` 被強制設回 `false`、`disabled = true`。
- 因為 `result.size > 0`，`reviewOpen` **不會**被設回 `false`（第 107 行），對話框留在畫面上，使用者可以直接看到那一筆多了一行紅字錯誤訊息（`ReviewList.svelte` 第 91–93 行 `{#if entry.problem}`）。
- 但因為 `disabled = true`，那一筆的 checkbox 是鎖住的（`Checkbox status={entry.disabled ? "disabled" : "default"}`），使用者**在同一次對話框開啟期間沒辦法重新勾選它去重試**——必須先關掉對話框，再從 `Toolbar` 重新點「檢視待提交的變更」觸發 `handleReviewOpen` 把 `failures` 清空，那一筆才會恢復成可勾選（前提是這次重新整理後它的 `problemOf` 仍然是 `null`）。就上面舉的「已提交過」這個例子來說，`invalidateAll()`（第 109 行，無論成功失敗都會執行）之後 `stagedFiles` 會直接把它濾掉，那一筆會整個從清單消失，不需要真的重試。

### 情境 3：全螢幕預覽導覽（對照第一節的 bug）

1. 在 `Inspector` 裡點「全螢幕預覽」→ `onexpand` → `handleLightboxOpen()`（無參數，第 137–139 行 `lightboxFile = filename ?? activeFile`）→ 落到 `activeFile`。
2. `lightbox`（第 66–71 行）算出 `{ filename, index }`，`index` 是 `data.stagedFiles.indexOf(...)` 的 0-based 結果。
3. `Lightbox.svelte` 用這個 `index` 顯示頁碼、判斷上一張/下一張是否可按——如第一節推演，**檢視第 2 張時上一張鎖死、檢視最後一張時下一張永遠可按**、頁碼永遠少 1。
4. 點上一張/下一張 → `handleLightboxPrev`/`handleLightboxNext` → `navigateLightbox(±1)`（第 80–85 行），這裡的 `Math.max(0, ...)`/`Math.min(files.length-1, ...)` 是拿 0-based 語意在夾範圍，這部分本身沒錯，錯的只在 `Lightbox.svelte` 顯示/停用邏輯那邊。

### 情境 4：刪除暫存圖片

1. `Inspector` 裡點「刪除此張」→ `ondelete` → `handleDeleteFile`（第 207–233 行）。
2. 先跳確認對話框（`requestConfirm`），確認後：用**刪除前**的 `data.stagedFiles` 算出 `idx`，決定刪除後要自動切去哪一張（`next = 下一張 ?? 上一張 ?? null`）。
3. `pending = true` → `DELETE /api/staged/[filename]`（`+server.ts` 第 81–106 行：檢查檔名安全、`query.hasImage` 為假才准刪、`fs.unlinkSync` 實際刪檔）。
4. 成功後 `delete drafts[file]`、`setActiveFile(next)`、`invalidateAll()` 讓 `stagedFiles` 反映實際少了一張。
5. 這段期間（`pending=true`）全頁其他 `ReviewEntry` 也會暫時被算成 `disabled`（見第二節），但因為刪除操作通常很快，且 `Inspector`/`Cards` 並沒有被任何 modal 擋住互動性，使用者理論上可以在這極短暫的視窗內看到「可提交」統計被誤標成 0——機率低但邏輯上存在。

### 情境 5：匯入 JSON 紀錄（SSE）

1. 點「匯入紀錄」→ `handleOpenImport` → `importOpen = true`，`ImportModal` 用原生 `<dialog>.showModal()` 開啟（`modal.core.svelte.ts` 第 17–19 行），背景（含 `Toolbar`/`Cards`/`Inspector`）此時是 inert，滑鼠/鍵盤都碰不到。
2. 使用者選檔 → `ImportGuide.svelte` 的 `handleFileChange` → `onimport(file)` → `+page.svelte` 的 `handleImportFile`（第 172–198 行）：先在前端解析 JSON、檢查非空物件，才進入 `pending = true`。
3. `importRecords`（`import.ts` 第 11–56 行）用 `fetch` 打 `/api/committed`，讀取 `ReadableStream`，用 `\n\n` 切 SSE 訊息、正則抓 `data: ...` 這一行，逐筆呼叫 `onProgress` 更新 `importProgress`（`ImportModal` 顯示 `LinearProgress`）。
4. 伺服器（`api/committed/+server.ts` 第 70–141 行）逐筆跑 `importEntry`（內部一樣是 `mutation.commitRecord`），每筆都送一個 `progress` 事件，最後送 `done`（含 `imported`/`skipped`/`errors`）。
5. 前端收到 `done` 後設 `importResult`，`ImportModal` 切換成結果畫面（`resultDisplay` 片段，第 28–42 行）；`invalidateAll()` 讓 `stagedFiles`/`existingTagNames` 反映匯入結果（已匯入的圖片會從 `stagedFiles` 消失）。
6. 這整段期間 `pending=true`，同樣會讓當下任何已編輯但**還沒關閉匯入對話框**時看向工具列（若背景真的能被看到，實際上被 `::backdrop` 模糊 + inert 擋住互動但視覺上還是看得到）的「可提交」統計短暫失真，跟情境 4 同一個根因。

### 情境 6：離開頁面守衛

1. 站內導覽（點其他選單連結等）：`beforeNavigate`（第 261–277 行）攔截，若 `touchedFiles.length === 0` 直接放行；否則 `nav.cancel()`，跳確認對話框，確認才 `drafts = {}` 並 `goto(to.url.href)` 手動導航過去。
2. 關分頁/重新整理/離開網站：走瀏覽器原生 `beforeunload`（`handleBeforeUnload`，第 257–259 行），只要 `touchedFiles.length > 0` 就 `preventDefault()`，交給瀏覽器原生確認框（沒有自訂文字的空間，這是瀏覽器規範本身的限制，不是這裡的問題）。
3. 兩條路徑各自獨立判斷，`nav.type === "leave"` 時直接放行不攔（那類型本來就對應「要離開此 app」，交給 `beforeunload` 處理），彼此沒有重疊或漏判的情況。

---

## 五、已排除的懷疑點

寫下來是為了避免之後重複花時間查同樣的地方。

1. **`draft.tags` 有沒有可能帶著沒 trim 的空白送到伺服器？** 追過之後確認不成立：`draft.tags` 唯一的寫入入口是 `TagInput.svelte` 的 `commitTags`（第 86–99 行），裡面已經 `.map((s) => s.trim())`；就算真的漏網，伺服器端 `ImageCommands.commit` 內的 `normalizeTags`（`image.ts` 第 14–17 行）也會再 trim 一次並排序。兩層保護，不是問題。

2. **`drafts`（`$state<Record<string, Draft>>`）有沒有可能踩到跟 `/tags` 頁那次一樣的 proxy identity 分裂 bug（`temp3.md` 記錄的那個 `groups.push(group)` 問題）？** 不成立。那個 bug的必要條件是「先拿到一個尚未被容器包過的裸物件參照，塞進 `$state` 容器之後，繼續用手上那個舊參照直接改欄位（繞過容器的 proxy）」。這裡完全找不到這種模式：`drafts[file] ??= emptyDraft()` 之後，沒有任何程式碼留著 `emptyDraft()` 回傳值的參照去後續直接賦值；所有後續的欄位寫入（`draft.name = ...`、`draft.rating = ...`、`draft.tags = ...`）都是透過 `bind:draft` 一路往下綁到 `InspectorFields`/`TextInput`/`Rating`/`TagInput`，每次寫入都是重新經過綁定鏈讀回 `drafts[activeFile]` 再寫，不會有「拿著舊參照直接寫」的情況。

3. **`ReviewModal`/`ImportModal`/`Lightbox` 三個對話框開著的時候，背景的 `Cards`/`Inspector`/`Toolbar` 是否還能被點到，造成競態（例如提交中途又跑去改同一份 draft）？** 不成立。`Modal.svelte` 底層用原生 `<dialog>.showModal()`（`modal.core.svelte.ts` 第 17–19 行），瀏覽器會自動讓背景內容變成 `inert`，滑鼠點擊、鍵盤 focus 都進不去，不需要額外自己寫鎖。
