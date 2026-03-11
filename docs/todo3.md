# Tagger 路由重構計畫

> 本文件定義 `src/routes/tagger/` 的一次性完整重構方案。
> 所有變更皆遵循 `docs/frontend.md` 規範，並落實 `docs/todo2.md` 的設計決策。

---

## 一、重構目標

1. **移除 `createContext`**：改用 `+page.svelte` 的 `$state` + props / `bind` 傳遞，符合規範§1.2。
2. **`active` 改為檔名型**：以 `string | null` 取代索引型 cursor，消除所有 reconciliation。
3. **`selected` 改為檔名型**：以 `Set<string>` 取代 `Set<number>`。
4. **所有操作改用 `invalidateAll()` + 唯讀 SSR props**：不再手動 mutate `stagedFiles`。
5. **拆分粗粒度元件**：TaggerSidebar → TaggerRefresh + TaggerList + TaggerUpload；TaggerPanel → TaggerForm。
6. **表單狀態內部化**：`tags` / `rating` 移入 TaggerForm 的無頭 UI，不再跨元件共享。
7. **`active` 不做任何驗證**：`indexOf` 回傳 -1 時，渲染端 fallback 至第一張。無 reconciliation `$effect`。

---

## 二、架構對照

| 關注點 | 現況 | 目標 |
| --- | --- | --- |
| 跨元件共享 | `TaggerContext` class + `createContext` | `+page.svelte` 的 `$state` + props / `bind` |
| cursor 型別 | 索引 `number` (`ctx.cursor`) | **檔名** `string \| null` (`active`) |
| selected 型別 | `Set<number>` | `Set<string>` |
| 檔案列表來源 | `ctx.list`（手動 mutate） | `data.stagedFiles`（SSR 唯讀，透過 `invalidateAll` 刷新） |
| tags / rating 歸屬 | `ctx.tags` / `ctx.rating`（共享） | TaggerForm 無頭 UI 內部 `$state` |
| zoomPan 歸屬 | `ctx.zoomPan`（共享引用） | TaggerPreview 無頭 UI 內部 |
| imageLoading | `ctx.imageLoading`（共享） | `+page.svelte` 的 `$state`，由 TaggerPreview 管理 |
| loading | `ctx.loading`（共享） | `+page.svelte` 的 `$state`，多元件 `bind` 共用 |
| progress | `ctx.total`（共享） | `+page.svelte` 的 `$state`，初始 0 |
| 列表元素引用 | `ctx.listEl`（共享） | TaggerList 無頭 UI 內部 |
| 左側邊欄 | TaggerSidebar（refresh + list + upload） | 拆為 TaggerRefresh、TaggerList、TaggerUpload |
| 右側面板 | TaggerPanel（form + shortcuts） | TaggerForm（form）；shortcuts 留在 `+page.svelte` |
| active 驗證 | 無（但索引型需 clamp） | **無**。`indexOf` 回傳 -1 → 渲染端 fallback 至 0 |
| selected 驗證 | 無 | 各元件自行按需處理，不集中 |
| 操作後資料刷新 | 手動修改 `ctx.list` | `await invalidateAll()` |
| 自動表單重置 | 切換圖片時重置 tags/rating | **移除**。保留上一張表單值，使用者手動 Reset |

---

## 三、檔案計畫

### 3.1 刪除

| 檔案 | 理由 |
| --- | --- |
| `context.svelte.ts` | 移除 createContext，改用 props / bind |
| `TaggerSidebar.svelte` | 拆為 TaggerRefresh + TaggerUpload |
| `taggerSidebar.svelte.ts` | 同上 |
| `TaggerPanel.svelte` | 改為 TaggerForm |
| `taggerPanel.svelte.ts` | 同上 |

### 3.2 新增

| 檔案 | 職責 |
| --- | --- |
| `TaggerLoading.svelte` | 純展示：顯示 loading / imageLoading 的 CircularProgress |
| `TaggerRefresh.svelte` + `taggerRefresh.svelte.ts` | 側邊欄標題列（標題 + 數量徽章 + 刷新按鈕） |
| `TaggerUpload.svelte` + `taggerUpload.svelte.ts` | 側邊欄底部上傳按鈕 + 隱藏 file input |
| `TaggerForm.svelte` + `taggerForm.svelte.ts` | 右側面板：rating + tags + commit / trash / reset + 全域鍵盤快捷鍵 |

### 3.3 重寫

| 檔案 | 變更摘要 |
| --- | --- |
| `+page.svelte` | 移除 context；宣告頁面級 `$state`；新佈局；props / bind 組裝子元件 |
| `TaggerProgress.svelte` + `taggerProgress.svelte.ts` | 移除 context，改用 props（`stagedFiles`, `progress`） |
| `TaggerList.svelte` + `taggerList.svelte.ts` | 移除 context；改用 props；active / selected 改為檔名型；scrollToActive 以 `$effect` 監聽 active |
| `TaggerPreview.svelte` + `taggerPreview.svelte.ts` | 移除 context；改用 props；zoomPan 內部化；`$effect` 監聽檔案變更以重置 zoomPan + imageLoading |

### 3.4 不變

| 檔案 | 說明 |
| --- | --- |
| `+page.server.ts` | 已回傳 `{ stagedFiles }`，無需變更 |

---

## 四、頁面級狀態（`+page.svelte`）

### 4.1 狀態宣告

```svelte
<script lang="ts">
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";
  /* ... 各子元件 import ... */

  let { data }: { data: PageData } = $props();

  // ─── 頁面級共享狀態 ───
  let active = $state<string | null>(data.stagedFiles[0] ?? null);
  let selected = $state<Set<string>>(
    data.stagedFiles.length > 0 ? new Set([data.stagedFiles[0]]) : new Set(),
  );
  let loading = $state(false);
  let imageLoading = $state(false);
  let progress = $state(0);
</script>
```

**初始化邏輯：**

- `active`：首次載入時指向第一張檔案；若無檔案則為 `null`。
- `selected`：與 `active` 同步，選取第一張。
- `progress`：初始值 0，代表已處理（已 commit / trash）的圖片數量。`total = progress + stagedFiles.length`。
- **不設任何 `$effect` 來監聯 `data.stagedFiles` 並修正 `active` 或 `selected`。**

### 4.2 佈局結構

```svelte
<header class="page-header">
  <a href="/" class="btn btn-ghost btn-sm">
    <IconArrowLeft size={16} />
    首頁
  </a>
  <TaggerProgress stagedFiles={data.stagedFiles} {progress} />
  <TaggerLoading {loading} {imageLoading} />
</header>

<main class="tagger-main">
  <aside class="tagger-files-panel">
    <TaggerRefresh
      stagedFiles={data.stagedFiles}
      {selected}
      bind:loading
    />
    <TaggerList
      stagedFiles={data.stagedFiles}
      bind:active
      bind:selected
    />
    <TaggerUpload
      stagedFiles={data.stagedFiles}
      bind:loading
    />
  </aside>

  <TaggerPreview
    stagedFiles={data.stagedFiles}
    {active}
    {selected}
    bind:imageLoading
  />

  <aside class="tagger-form-panel">
    <TaggerForm
      stagedFiles={data.stagedFiles}
      bind:active
      bind:selected
      bind:loading
      bind:progress
    />

    <div class="separator"></div>

    <div class="tagger-shortcuts">
      {#snippet key(label, keys)}
        <div>
          <div>
            {#each keys as k}
              <span class="kbd">{k}</span>
            {/each}
          </div>
          {label}
        </div>
      {/snippet}
      {@render key("切換圖片", ["←", "→"])}
      {@render key("評等", ["1", "-", "5"])}
      {@render key("聚焦標籤", ["T"])}
      {@render key("提交", ["Enter"])}
    </div>
  </aside>
</main>
```

### 4.3 Props 流向總覽

| 元件 | stagedFiles | active | selected | loading | imageLoading | progress |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| TaggerProgress | read | — | — | — | — | read |
| TaggerLoading | — | — | — | read | read | — |
| TaggerRefresh | read | — | read | **bind** | — | — |
| TaggerList | read | **bind** | **bind** | — | — | — |
| TaggerUpload | read | — | — | **bind** | — | — |
| TaggerPreview | read | read | read | — | **bind** | — |
| TaggerForm | read | **bind** | **bind** | **bind** | — | **bind** |

---

## 五、各元件規格

### 5.1 TaggerProgress

**職責：** 顯示進度條與進度文字。

**Props → Options：**

| 名稱 | 型別 | 方向 |
| --- | --- | --- |
| `stagedFiles` | `string[]` | read（getter） |
| `progress` | `number` | read（getter） |

**Derived：**

- `total = progress + stagedFiles.length`
- `progressPct = total > 0 ? Math.round((progress / total) * 100) : 0`
- `progressLabel = "${progress}/${total} (${stagedFiles.length} 剩餘)"`

**無 handler、無 $effect。**

---

### 5.2 TaggerLoading

**職責：** 純展示元件，條件渲染 CircularProgress。**無 `.svelte.ts`。**

**Props：**

| 名稱 | 型別 | 方向 |
| --- | --- | --- |
| `loading` | `boolean` | read |
| `imageLoading` | `boolean` | read |

**模板：**

```svelte
{#if loading}
  <CircularProgress label="操作中…" />
{/if}
{#if imageLoading}
  <CircularProgress label="圖片載入中…" />
{/if}
```

---

### 5.3 TaggerRefresh

**職責：** 側邊欄標題列——標題「待審查」、數量徽章、刷新按鈕。

**Props → Options：**

| 名稱 | 型別 | 方向 |
| --- | --- | --- |
| `stagedFiles` | `string[]` | read（getter） |
| `selected` | `Set<string>` | read（getter） |
| `loading` | `boolean` | bind（getter/setter） |

**Derived：**

- `listLength = stagedFiles.length`
- `selectedSize = selected.size`

**Handler：**

- `handleRefreshClick`：
  1. 若 `loading` 為 true，return。
  2. `loading = true`
  3. `await invalidateAll()`
  4. Toast 通知
  5. `loading = false`

**模板：** 標題文字 + badge `{selectedSize > 1 ? selectedSize + '/' : ''}{listLength}` + 刷新按鈕（spinning 動畫）。

---

### 5.4 TaggerList

**職責：** 虛擬捲動列表，支援單選 / Ctrl 多選 / Shift 範圍選。

**Props → Options：**

| 名稱 | 型別 | 方向 |
| --- | --- | --- |
| `stagedFiles` | `string[]` | read（getter） |
| `active` | `string \| null` | bind（getter/setter） |
| `selected` | `Set<string>` | bind（getter/setter） |

**內部狀態：**

| 名稱 | 說明 |
| --- | --- |
| `listEl` | 捲動容器 DOM 引用 |
| `scrollTop` | 目前 scrollTop |
| `viewH` | 容器可見高度（ResizeObserver） |
| `anchor` | Shift 多選錨點（**檔名 `string`**） |

**Derived：**

- `activeIndex = stagedFiles.indexOf(active ?? "")`（可為 -1，不修正 active）
- `effectiveActiveIndex = activeIndex === -1 ? 0 : activeIndex`
- 虛擬捲動相關：`totalH`、`startIdx`、`endIdx`、`visible`（同現有邏輯）

**核心行為——選取：**

| 模式 | 觸發條件 | 行為 |
| --- | --- | --- |
| single | 無修飾鍵點擊 | `active = filename; selected = new Set([filename]); anchor = filename` |
| ctrl | Ctrl / Meta + 點擊 | 切換 filename 的選取狀態；`active = filename; anchor = filename` |
| shift | Shift + 點擊 | 從 `anchor` 到點擊項的範圍全選（需要 `indexOf` 取得索引，遍歷範圍取得檔名） |

**$effect（共兩個）：**

1. **scrollToActive：** 監聽 `active` 與 `stagedFiles`。將 `effectiveActiveIndex` 對應的項目捲入可視區域。此為 UI 副作用，非驗證。
2. **ResizeObserver：** 監聽 `listEl`，追蹤 `viewH`。

**Handler：**

- `handleItemClick(e: MouseEvent, filename: string)`：根據修飾鍵調用 single / ctrl / shift 選取。
- `handleListScroll`：同步 `scrollTop`。

**模板高亮判定：**

```svelte
class:active={item.filename === active || (activeIndex === -1 && item.index === 0)}
class:selected={selected.has(item.filename)}
```

第一條規則意為：若 active 失效（不在列表中），視覺上高亮第一項。

---

### 5.5 TaggerUpload

**職責：** 側邊欄底部的「加入圖片」按鈕與隱藏的 file input。

**Props → Options：**

| 名稱 | 型別 | 方向 |
| --- | --- | --- |
| `stagedFiles` | `string[]` | read（getter） |
| `loading` | `boolean` | bind（getter/setter） |

**內部狀態：**

- `fileInputEl`：隱藏 file input DOM 引用。

**Handler：**

- `handleUploadClick`：觸發 `fileInputEl.click()`。
- `handleUploadChange(e: Event)`：
  1. 若無檔案或 `loading`，return。
  2. `loading = true`
  3. 建構 FormData，`await api.post('/api/staged', body)`
  4. `await invalidateAll()`
  5. Toast 通知
  6. `loading = false`；`input.value = ""`

---

### 5.6 TaggerPreview

**職責：** 中央圖片預覽，zoom-pan（滾輪縮放、拖曳平移、雙擊重置）。

**Props → Options：**

| 名稱 | 型別 | 方向 |
| --- | --- | --- |
| `stagedFiles` | `string[]` | read（getter） |
| `active` | `string \| null` | read（getter） |
| `selected` | `Set<string>` | read（getter） |
| `imageLoading` | `boolean` | bind（getter/setter） |

**內部狀態：**

| 名稱 | 說明 |
| --- | --- |
| `zp` | `useZoomPan()` 實例（不再共享至 context） |
| `prevFile` | 上一次渲染的檔案名稱，用於偵測檔案切換 |

**Derived：**

- `activeIndex = stagedFiles.indexOf(active ?? "")`
- `effectiveIndex = activeIndex === -1 ? 0 : activeIndex`
- `currentFile = stagedFiles[effectiveIndex] ?? null`
- `previewSrc = currentFile ? imgSrc("staged", currentFile) : ""`
- `selectedCount = selected.size`

**$effect（檔案切換偵測）：**

```ts
$effect(() => {
  if (currentFile !== prevFile) {
    if (currentFile) options.imageLoading = true;
    prevFile = currentFile;
    zp.reset();
  }
});
```

當 `active` 或 `stagedFiles` 變動導致 `currentFile` 改變時：
- 設定 `imageLoading = true`（通知外部顯示載入狀態）
- 重置 zoomPan（回到初始縮放與位置）

**Handler：**

- `handleContainerWheel`、`handleContainerMousedown`、`handleContainerDblclick`
- `handleWindowMousemove`、`handleWindowMouseup`
- `handleImageLoad`：`imageLoading = false`

---

### 5.7 TaggerForm

**職責：** 評等、標籤輸入、提交 / 刪除 / 重置按鈕、全域鍵盤快捷鍵（`<svelte:window onkeydown>`）。

**Props → Options：**

| 名稱 | 型別 | 方向 |
| --- | --- | --- |
| `stagedFiles` | `string[]` | read（getter） |
| `active` | `string \| null` | bind（getter/setter） |
| `selected` | `Set<string>` | bind（getter/setter） |
| `loading` | `boolean` | bind（getter/setter） |
| `progress` | `number` | bind（getter/setter） |

**內部狀態（不共享）：**

| 名稱 | 初始值 | 說明 |
| --- | --- | --- |
| `tags` | `[]` | 標籤列表 |
| `rating` | `0` | 評等 0–5 |
| `tagInputWrapEl` | `undefined` | 標籤輸入框的容器 DOM 引用 |

> tags 與 rating **不在切換 active / selected 時自動重置**。
> 使用者可沿用上一張的標籤與評等批次處理相似圖片，或手動按 Reset 清空。

**Private helpers：**

- `resolveActiveIndex()`：`stagedFiles.indexOf(active ?? "")`，回傳 -1 時以 0 替代。
- `navigate(delta: -1 | 1)`：
  1. `idx = resolveActiveIndex(); next = idx + delta`
  2. 邊界檢查
  3. `active = stagedFiles[next]; selected = new Set([stagedFiles[next]])`
- `toggleRating(n: number)`：`rating = n === rating ? 0 : n`
- `focusTagInput()`：聚焦標籤輸入框。
- `resetForm()`：`tags = []; rating = 0`

**Commit 流程（`doCommit`）：**

1. Guard：`loading || selected.size === 0` → return
2. 驗證 `tags.length > 0`（至少一個標籤）
3. 取得有效檔名：`[...selected].filter(f => stagedFiles.includes(f))`；若為空，return
4. `loading = true`
5. `batchRun(names, 5, fn => api.post(...))`
6. Toast 通知；`tagCache.invalidate()`
7. `progress += ok`（成功數）
8. `selected = new Set()`（清空選取）
9. `await invalidateAll()`
10. `loading = false`

**Trash 流程（`doTrash`）：**

1. Guard：同 commit
2. `requestConfirm` 確認
3. `loading = true`
4. `batchRun(names, 5, fn => api.del(...))`
5. Toast 通知
6. `progress += ok`（成功數）
7. `selected = new Set()`（清空選取）
8. `await invalidateAll()`
9. `loading = false`

**全域鍵盤快捷鍵（`handleWindowKeydown`）：**

| 按鍵 | 行為 |
| --- | --- |
| `←` | `navigate(-1)` |
| `→` | `navigate(1)` |
| `0`–`5` | `toggleRating(n)` |
| `T` / `t` | `focusTagInput()` |
| `Enter` | `doCommit()` |
| `Delete` | `doTrash()` |

排除條件：`isInEditable(e.target)` 或 `e.ctrlKey / e.metaKey / e.altKey`。

**Handler：**

- `handleCommitClick`、`handleTrashClick`、`handleResetClick`
- `handleTagEnter`（Autocomplete 內部 Enter 時觸發 commit）
- `handleWindowKeydown`

**模板概要：**

```
Rating → separator → Autocomplete (tags) → separator → [提交] [刪除] [重置]
```

---

## 六、關鍵行為流程

### 6.1 Commit

```
使用者按 Enter / 點擊提交
  → TaggerForm.doCommit()
  → 驗證 tags.length > 0
  → 過濾 selected 中仍在 stagedFiles 的檔名
  → batchRun POST /api/staged/[filename]
  → progress += ok（成功數）
  → selected = new Set()
  → await invalidateAll()
  → data.stagedFiles 更新（reactive）
  → active 仍指向已提交的檔名（已從 list 消失）
  → 各元件的 activeIndex 解析為 -1 → effectiveIndex = 0 → 顯示第一張
  → 不做任何 active 修正
  → 使用者按 ← / → 時，active 自然變為有效值
```

### 6.2 Trash

流程與 Commit 相同（含 `progress += ok`），差別在於呼叫 `DELETE /api/staged/[filename]`，且先 `requestConfirm`。

### 6.3 Navigate（← →）

```
使用者按 ← / →
  → TaggerForm.navigate(delta)
  → idx = stagedFiles.indexOf(active ?? ""）
  → resolvedIdx = idx === -1 ? 0 : idx
  → next = resolvedIdx + delta
  → 邊界檢查（< 0 || >= length → return）
  → active = stagedFiles[next]
  → selected = new Set([stagedFiles[next]])
  → TaggerList 的 scrollToActive $effect 觸發捲動
  → TaggerPreview 的 $effect 偵測 currentFile 變更 → imageLoading = true + zoomPan.reset()
  → 圖片載入完成 → imageLoading = false
```

### 6.4 Refresh

```
使用者點擊刷新按鈕
  → TaggerRefresh.handleRefreshClick()
  → loading = true
  → await invalidateAll()
  → Toast
  → loading = false
  → active 不變；若指向的檔案仍在列表則穩定指向，若不在則 fallback
  → progress 不變；total = progress + 新 stagedFiles.length，自動正確
```

### 6.5 Upload

```
使用者選取檔案
  → TaggerUpload.handleUploadChange()
  → loading = true
  → api.post('/api/staged', FormData)
  → await invalidateAll()
  → Toast
  → loading = false
  → progress 不變；total = progress + 新 stagedFiles.length，自動正確
```

### 6.6 Selection（列表點擊）

```
使用者點擊列表項目
  → TaggerList.handleItemClick(e, filename)
  → 判斷修飾鍵 → single / ctrl / shift

single：active = filename; selected = {filename}; anchor = filename
ctrl：  toggle filename in selected; active = filename; anchor = filename
shift： lo/hi = indexOf(anchor) ~ indexOf(filename)
        selected = { stagedFiles[lo..hi] }
        active = filename
        （anchor 不變）
```

---

## 七、注意事項

### 7.1 `getStagedFiles` 排序穩定性

虛擬列表依賴 `stagedFiles` 的順序穩定。實作前須確認 `getStagedFiles` 回傳已排序的列表（例如按檔名自然排序）。若未排序，需在 `+page.server.ts` 或 helper 中加入排序邏輯。

### 7.2 `$effect` 使用限制

本次重構中，僅以下場景使用 `$effect`：

| 元件 | $effect 用途 | 性質 |
| --- | --- | --- |
| TaggerList | scrollToActive（捲動至 active 項目） | UI 副作用 |
| TaggerList | ResizeObserver（追蹤容器高度） | UI 副作用 |
| TaggerPreview | 偵測 currentFile 變更 → imageLoading + zoomPan.reset | UI 副作用 |

**絕對禁止**以 `$effect` 修正 `active` 或集中清理 `selected`。

### 7.3 操作後的 `active` 與 `selected`

- **Commit / Trash 後：** `progress += ok`；`selected` 被清空為 `new Set()`。`active` 不觸碰——若檔案已消失，渲染端 fallback 至第一張。使用者下次導航時 `active` 自然變為有效值。
- **Refresh / Upload 後：** `selected` 與 `active` 皆不觸碰。若 active 指向的檔案仍在列表則穩定指向；若不在則 fallback。
- **不存在任何自動 reconciliation。**

### 7.4 `imageLoading` 時序

`imageLoading` 由 TaggerPreview 的 `$effect` 設定。由於 Svelte 5 的 `$effect` 在 microtask 排程，active 變更後的第一個渲染幀中，`img src` 已更新但 `imageLoading` 尚未設為 true。此延遲（單幀）不可察覺，無需額外處理。

### 7.5 `progress` 語意

`progress` 代表「本次 session 中已成功處理（commit + trash）的圖片數量」。`total = progress + stagedFiles.length`。

- 初始值：`0`
- 遞增：commit / trash 成功後 `progress += ok`
- **refresh / upload 不觸碰 `progress`**：新增檔案只增加 `stagedFiles.length`，`total` 自動增加，進度百分比自然稀釋
- 頁面重新載入：重置為 0（新 session）
