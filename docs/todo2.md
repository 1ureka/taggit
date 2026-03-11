### 7.1 為何 cursor 存檔名而非索引

**核心觀察：** commit/trash/refresh 後已選取圖片消失時，「選附近的圖片」並不重要——直接選第一張即可。真正重要的是**如果該圖片還在，就繼續指向它**。

索引型 cursor 在 list 變動後需要複雜的 reconciliation（找舊檔名新位置、clamp）。檔名型 cursor 天然解決：

| 場景                    | 索引型 cursor                     | 檔名型 cursor                       |
| ----------------------- | --------------------------------- | ----------------------------------- |
| commit/trash 後圖片消失 | 需 clamp + reconciliation $effect | `indexOf` 回傳 -1 → fallback 第一張 |
| commit/trash 後圖片還在 | 索引可能漂移，需找新位置          | `indexOf` 直接找到                  |
| refresh 發現新增圖片        | 索引指向的檔案可能改變            | 檔名不變，穩定指向                  |
| refresh 發現圖片消失        | 索引可能超出範圍，需 clamp          | `indexOf` 回傳 -1 → fallback 第一張 |

**代價：** 上一張/下一張需要 `indexOf` 查找 index（O(n)），但 staged files 量級小，開銷可忽略。

而當無效後，下一次執行下一張/上一張時，自然就變成有效的

### 7.3 為何移除自動表單重置

- **UX：** 批次標記相似圖片時保留上一張的 tags/rating，使用者可直接 commit 下一張或按 Reset 清空。
- **架構：** 消除 `onselect` 回調穿透元件樹的需求。所有元件少一個 prop，`+page.svelte` 少一個膠水函數。
- **zoomPan：** 由 TaggerPreview 內部 `$effect` 在檔案改變時自動重置。與表單重置解耦。

### 7.4 為何不再需要 TaggerRefs / 共享引用

- `zoomPan.reset()`——移除自動重置後，只有 TaggerPreview 自己需要
- `scrollToActive(listEl, ...)`——TaggerList 自己監聽 cursorIndex 並自動捲動
- 不再有任何跨元件引用需求

### 7.5 為何不需要驗證

cursor 存的是檔名，`resolveCursorIndex(list, cursor)` 在找不到時 fallback 至 0。無效的 cursor 值（手動改 URL、圖片被刪）不會導致錯誤——渲染端自然降級為選取第一張。

這消除了：

- cursor range 驗證
- reconciliation `$effect`

---

+page
子元件組裝：

```svelte
<header class="page-header">
  <a href="/" class="btn btn-ghost btn-sm">
    <IconArrowLeft size={16} />
    首頁
  </a>

  <TaggerProgress ... />

  <TaggerLoading ... />
</header>

<main>
  <aside class="tagger-files-panel">
    <TaggerRefresh .../>

    <TaggerList ... />

    <TaggerUpload ... />
  </aside>

  <TaggerPreview .../>

  <aside class="tagger-form-panel">
    <TaggerForm .../>

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

- `<header>` / `<aside>` 直接寫在 `+page`（§1.2 頁面殼）
- `renderItem` snippet 為 §1.5 策略注入

---

不寫成
```
<TaggerList ...>
    {#snippet renderItem(index)}
    ...
    {/snippet}
</TaggerList>
```

因為該組件直接在 +page 中使用，因此業務邏輯只能放在他自身的無頭 UI

---

cursor 改名為 active

selection 驗證寫在各自無頭 UI，不要硬是 DRY，根據各自情況特化邏輯

所有行為不再自己 fetch 而是只用 invalidate all + reactive read only ssr props

所有行為共用 page 狀態 loading 當作鎖，避免重複提交/刪除/上傳/refresh...

SSR props 改名為 stagedFiles

scrollToActive 直接放在 TaggerList 內部，利用 $effect 監聽 active (記得，找不到代表第一個!)

Staged 檔案名稱列表絕對絕對得用唯讀響應式 SSR 來源!

由於不在改變選取或 active 時重置表單，因此 tags, rating 等是 TaggerForm 的無頭 UI 內部狀態!

---

我注意到你仍然想驗證 active，我已經說了不准驗證!

active 是檔名，resolveCursorIndex(list, active) 找不到就回傳 -1，自然 fallback 到第一張。不做任何驗證、不寫任何 reconciliation $effect。無效就是無效，下次操作時自然歸位。

---

imageLoading 為 page 狀態

---

1. 接受在 +page 寫 $effect
2. 使 active, selected 必定可信
3. 不要直接 `let active = $state<string | null>(data.stagedFiles[0] ?? null);` 因為這樣會出現 `This reference only captures the initial value of `data`. Did you mean to reference it inside a closure instead?`


因此可以預期第一幀會未選取任何圖片，直到 $effect 執行後 active 才會被設定為第一張或者驗證後的

那你可能會擔心，第一幀(幾乎看不到，除非效能超差)，顯示 `所有圖片皆已處理，沒有新圖片` 會不會很怪，當然會，但解法很簡單
```
所有圖片皆已處理，沒有新圖片 => 未選取任何圖片
```

這樣，無論是真的因為沒有 staged files 還是因為第一幀 active 還沒被設定(被 SEO 看到)，都是合理的解釋
