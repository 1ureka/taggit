# Writable `$derived` 取代 `$effect` 同步分析

> 本文件以「`$state(init) + $effect(() => { state = source })` 且 `$effect` 內部沒有分支邏輯或副作用，就可以安全地替換為 writable `$derived(source)`」為核心準則，掃描專案中所有 `$effect` 用法，逐一分析是否適用。

---

## 1. 背景：Writable `$derived`

Svelte 5 移除了 `$derived` 的 read-only 限制，使 `$derived` 的值可以被直接寫入。這形成了官方推薦的「樂觀更新」pattern：

```ts
// 舊寫法：$state + untrack 初始化 + $effect 同步
let value = $state(untrack(() => source.value));
$effect(() => { value = source.value; });

// 新寫法：writable $derived
let value = $derived(source.value);
// 可以直接寫入 value，下次 source 變動時會重新計算
```

**核心語意**：`$derived` 宣告值的「權威來源」，同時允許在來源尚未更新時先行寫入（樂觀更新）。當來源變動時，`$derived` 重新計算，覆蓋先前的寫入值。

---

## 2. 判斷準則

一個 `$effect` 是否可被 writable `$derived` 取代，取決於以下條件——**全部滿足**才適用：

| # | 條件 | 說明 |
| --- | --- | --- |
| 1 | `$effect` 的目的是**將外部來源同步到 `$state`** | 即 `$effect(() => { this.x = source.x })` |
| 2 | 內部**沒有分支邏輯** | 沒有 `if`/`else`、沒有根據狀態跳過同步 |
| 3 | 內部**沒有副作用** | 沒有 DOM 操作、沒有 callback、沒有事件監聽 |
| 4 | 每個欄位**獨立**對應來源的一個值 | 非多欄位交叉 reconciliation |

不滿足任一條件的 `$effect`，應保留現有寫法。

---

## 3. 全專案 `$effect` 掃描

以下列出專案中所有使用 `$effect` 的位置，依 pattern 分類。

### 3.1 Pattern A：外部來源 → `$state` 同步 ⚡

這類 `$effect` 的唯一目的是「當外部 reactive source 變動時，將值寫入本地 `$state`」。是 writable `$derived` 的直接替代對象。

---

#### A1. `FilterFields`（`src/lib/ui/filterFields.svelte.ts`）

**來源**：`page.url`（URL query params）

```ts
search = $state<string>("");
includedTags = $state<string[]>([]);
// ... 共 7 個 $state 欄位

constructor() {
    this.#setFields(untrack(() => parseQueryParams(page.url)));
    $effect(() => {
        this.#setFields(parseQueryParams(page.url));
    });
}
```

**判斷**：

| 條件 | 結果 |
| --- | --- |
| 同步到 `$state` | ✅ 7 個欄位全部是 `$state = source` |
| 無分支邏輯 | ✅ `#setFields` 內部是純賦值 |
| 無副作用 | ✅ |
| 欄位獨立 | ✅ 每個欄位各自對應 URL 的一個參數 |

**結論**：✅ 可以取代

**改寫後**：

```ts
search: string;
includedTags: string[];
excludedTags: string[];
rating: number | undefined;
ratingOp: "gte" | "lte" | "eq";
sort: SortField;
order: "asc" | "desc";

constructor() {
    const params = () => parseQueryParams(page.url);

    this.search = $derived(params().search ?? "");
    this.includedTags = $derived(params().includedTags ?? []);
    this.excludedTags = $derived(params().excludedTags ?? []);
    this.rating = $derived(params().rating);
    this.ratingOp = $derived(params().ratingOp ?? "gte");
    this.sort = $derived(params().sort ?? "rating");
    this.order = $derived(params().order ?? "desc");
}
```

移除了 `untrack`、`$effect`、`#setFields()`。使用者操作（如切換排序）會樂觀寫入 `$derived`，`goto()` 後 URL 更新時 `$derived` 重新計算確認值。

---

#### A2. `EditorForm`（`src/routes/editor/editorForm.svelte.ts`）

**來源**：`options.currentRecord`（SSR 資料）

```ts
name = $state("");
tags = $state<string[]>([]);
rating = $state(0);
dirty = $state(false);

constructor(private options: EditorFormOptions) {
    this.#resetForm();
    $effect(() => {
        this.#resetForm();
    });
}

#resetForm() {
    const rec = this.options.currentRecord;
    if (rec) {
        this.name = rec.name;
        this.tags = [...rec.tags];
        this.rating = rec.rating;
    } else {
        this.name = "";
        this.tags = [];
        this.rating = 0;
    }
    this.dirty = false;
}
```

**判斷**：

| 條件 | 結果 |
| --- | --- |
| 同步到 `$state` | ✅ `name`、`tags`、`rating` 均為 `$state = source` |
| 無分支邏輯 | ⚠️ `#resetForm` 有 `if (rec)` 分支，但本質是 nullish fallback |
| 無副作用 | ⚠️ 同時重置 `dirty = false` |
| 欄位獨立 | ✅ 每個欄位獨立對應 `currentRecord` 的一個屬性 |

**結論**：⚠️ 原則上可以，但需配套處理 `dirty`

`name`、`tags`、`rating` 三者可以直接改為 writable `$derived`：

```ts
name: string;
tags: string[];
rating: number;

constructor(private options: EditorFormOptions) {
    this.name = $derived(options.currentRecord?.name ?? "");
    this.tags = $derived([...(options.currentRecord?.tags ?? [])]);
    this.rating = $derived(options.currentRecord?.rating ?? 0);
}
```

但 `dirty` 需要在 `currentRecord` 變動時重置為 `false`。可以用一個額外的 `$derived` 追蹤 `currentRecord` 的 identity 來解決，但這增加了複雜度。需要實際驗證後再決定是否改寫。

---

### 3.2 Pattern B：有條件的 Reconciliation ❌

這類 `$effect` 內部有**分支邏輯**——根據當前狀態決定如何更新，或涉及多個 `$state` 的交叉更新。不適合 writable `$derived`。

---

#### B1. `EditorPage`（`src/routes/editor/editorPage.svelte.ts`）

```ts
$effect(() => {
    const ids = options.imageIds;
    const record = options.currentRecord;
    const currentId = record?.id ?? null;

    if (currentId && ids.length > 0) {
        const prev = untrack(() => this.selectedFiles);
        const next = new Set([...prev].filter((f) => ids.includes(f)));
        if (next.size === 0) {
            this.selectedFiles = new Set([currentId]);
        } else if (next.size !== prev.size) {
            this.selectedFiles = next;
        }
        return;
    }

    if (!currentId || ids.length <= 0) {
        this.selectedFiles = new Set();
        return;
    }
});
```

**不適用原因**：多重分支（`if/else`）+ `untrack` 讀取自身狀態 + 交叉引用（`imageIds` × `currentRecord` × `selectedFiles`）。這是典型的 reconciliation 邏輯，無法用簡單的值映射表達。

---

#### B2. `TaggerPage`（`src/routes/tagger/taggerPage.svelte.ts`）

```ts
$effect(() => {
    const list = options.stagedFiles;

    if (this.currentFile === null && list.length > 0) {
        this.currentFile = list[0];
        this.selectedFiles = new Set([list[0]]);
        return;
    }

    if (this.currentFile !== null && list.length > 0) {
        if (!list.includes(this.currentFile)) {
            this.currentFile = list[0];
        }
        // ... 清理 selectedFiles ...
        return;
    }

    if (this.currentFile !== null && list.length <= 0) {
        this.currentFile = null;
        this.selectedFiles = new Set();
        return;
    }
});
```

**不適用原因**：三個條件分支 + 同時更新 `currentFile` 與 `selectedFiles` 兩個 `$state` + `untrack` 讀取。

---

### 3.3 Pattern C：副作用觸發 ❌

這類 `$effect` 的目的不是同步 `$state`，而是在外部來源變動時**觸發副作用**（callback、DOM 操作）。`$derived` 不應有副作用。

---

#### C1. `EditorPreview`（`src/routes/editor/editorPreview.svelte.ts`）

```ts
$effect(() => {
    const record = options.currentRecord;
    const id = record ? record.id : null;
    if (id !== this.#prevId) {
        this.#prevId = id;
        options.onChangeImage();  // ← 副作用
    }
});
```

**不適用原因**：呼叫 `onChangeImage()` callback（重置 ZoomPan），這是副作用而非狀態同步。

---

#### C2. `TaggerPreview`（`src/routes/tagger/taggerPreview.svelte.ts`）

```ts
$effect(() => {
    const file = options.currentFile;
    if (file !== this.#prevFile) {
        if (file) this.imageLoading = true;
        this.#prevFile = file;
        options.onChangeImage();  // ← 副作用
    }
});
```

**不適用原因**：同上，呼叫 `onChangeImage()` callback + 有分支邏輯（`if (file)`）。

---

#### C3. `player/+page.svelte` — feedback 信號

```ts
$effect(() => {
    player.playing;
    feedback = true;
    tick().then(() => (feedback = false));
});
```

**不適用原因**：觸發 UI 動畫的瞬間信號，本質是副作用。

---

#### C4. `(home)/+page.svelte` — 手機版面板初始化

```ts
$effect(() => {
    if (window.innerWidth < 600) {
        document.documentElement.style.setProperty("--left-panel-width", "0px");
    }
});
```

**不適用原因**：直接操作 DOM（`style.setProperty`），是副作用。

---

### 3.4 Pattern D：生命週期管理（setup/teardown）❌

這類 `$effect` 使用 return cleanup function 管理事件監聽器、Observer、或外部資源的建立與銷毀。與狀態同步完全無關。

---

#### D1. `Masonry`（`src/lib/virtualizer/masonry.svelte.ts`）

```ts
$effect(() => {
    const viewportEl = this.viewportEl;
    if (!viewportEl) return;

    const resizeObserver = new ResizeObserver(markDirty);
    resizeObserver.observe(viewportEl);
    viewportEl.addEventListener("scroll", markDirty, { passive: true });

    return () => {
        resizeObserver.disconnect();
        viewportEl.removeEventListener("scroll", markDirty);
    };
});
```

**不適用原因**：ResizeObserver + scroll listener 的 setup/teardown。

---

#### D2. `List`（`src/lib/virtualizer/list.svelte.ts`）— 兩個 `$effect`

```ts
// Effect 1: scrollToActive
$effect(() => {
    if (!this.viewportEl) return;
    if (options.currentIndex === null) return;
    const idx = options.currentIndex;
    if (idx >= 0) scrollToActive(this.viewportEl, idx, options.itemHeight);
});

// Effect 2: ResizeObserver
$effect(() => {
    if (!this.viewportEl) return;
    const resizeObserver = new ResizeObserver((entries) => {
        for (const e of entries) this.#viewportHeight = e.contentRect.height;
    });
    resizeObserver.observe(this.viewportEl);
    return () => resizeObserver.disconnect();
});
```

**不適用原因**：Effect 1 呼叫 `scrollToActive`（DOM 操作）；Effect 2 是 ResizeObserver 生命週期。

---

#### D3. `Player`（`src/lib/virtualizer/player.svelte.ts`）

```ts
$effect(() => {
    const images = options.images;
    if (images.length === 0) return;

    const engine = new PlayerEngine<T>({ ... });
    this.#engine = engine;
    engine.start();

    const handleResize = debounce(() => engine.resize(), 150);
    window.addEventListener("resize", handleResize);

    return () => {
        engine.dispose();
        this.#engine = null;
        window.removeEventListener("resize", handleResize);
    };
});
```

**不適用原因**：PlayerEngine 的建立/銷毀 + resize listener。

---

#### D4. `ScrollButton`（`src/lib/ui/scrollButton.svelte.ts`）

```ts
$effect(() => {
    const el = options.viewportEl;
    if (!el) return;

    const onScroll = throttle(() => { ... }, 80);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
});
```

**不適用原因**：scroll listener 的 setup/teardown。

---

#### D5. `Modal`（`src/lib/ui/modal.svelte.ts`）

```ts
$effect(() => {
    if (this.options.open) {
        this.#saveFocusAndTrap();
        return () => this.#restoreFocus();
    }
});
```

**不適用原因**：focus 管理（save/restore focus）。

---

#### D6. `Popover`（`src/lib/ui/popover.svelte.ts`）

```ts
$effect(() => {
    const { reference, open, placement } = this.options;
    const node = this.popoverEl;
    if (!reference || !node) return;

    if (!open) {
        this.#compute(node, reference, placement);
        return;
    }

    if (!node.matches(":popover-open")) node.showPopover();
    return autoUpdate(reference, node, () => this.#compute(node, reference, placement));
});
```

**不適用原因**：Floating UI 的 `autoUpdate` 生命週期 + `showPopover()` DOM 操作。

---

#### D7. `Toast`（`src/lib/ui/toast.svelte.ts`）

```ts
$effect(() => {
    const onToastAdd = (e: Event) => { ... };
    window.addEventListener("toast:add", onToastAdd);
    return () => window.removeEventListener("toast:add", onToastAdd);
});
```

**不適用原因**：自訂事件 listener 的 setup/teardown。

---

#### D8. `ConfirmModal`（`src/lib/ui/confirmModal.svelte.ts`）

```ts
$effect(() => {
    const onConfirmRequest = (e: Event) => { ... };
    window.addEventListener("confirm:request", onConfirmRequest);
    return () => window.removeEventListener("confirm:request", onConfirmRequest);
});
```

**不適用原因**：自訂事件 listener 的 setup/teardown。

---

#### D9. `PlayerAutoHide`（`src/routes/player/playerAutoHide.svelte.ts`）

```ts
$effect(() => {
    const hide = debounce(() => (this.hideDock = true), this.timeout);
    const handleActivity = () => {
        this.hideDock = false;
        hide();
    };
    document.addEventListener("mousemove", handleActivity);
    handleActivity();
    return () => document.removeEventListener("mousemove", handleActivity);
});
```

**不適用原因**：mousemove listener + debounced 自動隱藏邏輯。

---

#### D10. `SettingsNav`（`src/routes/settings/settingsNav.svelte.ts`）

```ts
$effect(() => {
    const ids = this.sections.map((s) => s.id);
    const container = document.getElementById("settings-main");
    if (!container) return;

    const onScroll = () => { ... };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
});
```

**不適用原因**：scroll listener 的 setup/teardown + DOM 查詢。

---

#### D11. `(home)/+page.svelte` — resize listener

```ts
$effect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
});
```

**不適用原因**：resize listener 的 setup/teardown。

---

## 4. 總結

### 分類統計

| Pattern | 數量 | 可取代 |
| --- | --- | --- |
| A. 外部來源 → `$state` 同步 | 2 | ✅ 1 確定 + ⚠️ 1 需配套 |
| B. 有條件的 Reconciliation | 2 | ❌ |
| C. 副作用觸發 | 4 | ❌ |
| D. 生命週期管理 | 11 | ❌ |

### 可取代

| Class | 檔案 | 難度 | 效益 |
| --- | --- | --- | --- |
| `FilterFields` | `src/lib/ui/filterFields.svelte.ts` | 🟢 低 | 移除 `untrack` + `$effect` + `#setFields()`，7 個欄位全部簡化 |

### 需配套處理

| Class | 檔案 | 難度 | 備註 |
| --- | --- | --- | --- |
| `EditorForm` | `src/routes/editor/editorForm.svelte.ts` | 🟡 中 | `name`、`tags`、`rating` 可改，但需重新設計 `dirty` 重置機制 |

### 不適用（保留 `$effect`）

| Pattern | Class | 檔案 |
| --- | --- | --- |
| B. Reconciliation | `EditorPage` | `src/routes/editor/editorPage.svelte.ts` |
| B. Reconciliation | `TaggerPage` | `src/routes/tagger/taggerPage.svelte.ts` |
| C. 副作用 | `EditorPreview` | `src/routes/editor/editorPreview.svelte.ts` |
| C. 副作用 | `TaggerPreview` | `src/routes/tagger/taggerPreview.svelte.ts` |
| C. 副作用 | `player/+page.svelte` | `src/routes/player/+page.svelte` |
| C. 副作用 | `(home)/+page.svelte` | `src/routes/(home)/+page.svelte`（手機面板） |
| D. 生命週期 | `Masonry` | `src/lib/virtualizer/masonry.svelte.ts` |
| D. 生命週期 | `List`（×2） | `src/lib/virtualizer/list.svelte.ts` |
| D. 生命週期 | `Player` | `src/lib/virtualizer/player.svelte.ts` |
| D. 生命週期 | `ScrollButton` | `src/lib/ui/scrollButton.svelte.ts` |
| D. 生命週期 | `Modal` | `src/lib/ui/modal.svelte.ts` |
| D. 生命週期 | `Popover` | `src/lib/ui/popover.svelte.ts` |
| D. 生命週期 | `Toast` | `src/lib/ui/toast.svelte.ts` |
| D. 生命週期 | `ConfirmModal` | `src/lib/ui/confirmModal.svelte.ts` |
| D. 生命週期 | `PlayerAutoHide` | `src/routes/player/playerAutoHide.svelte.ts` |
| D. 生命週期 | `SettingsNav` | `src/routes/settings/settingsNav.svelte.ts` |
| D. 生命週期 | `(home)/+page.svelte` | `src/routes/(home)/+page.svelte`（resize） |

### 結論

專案共有 **19 個 `$effect`**（分布在 18 個檔案），其中僅 **`FilterFields` 完全符合替換條件**，`EditorForm` 需要額外的配套設計。其餘 17 個 `$effect` 的用途（reconciliation、副作用觸發、生命週期管理）均不在 writable `$derived` 的適用範圍內。

這與直覺一致：writable `$derived` 解決的是「外部來源 → 本地可編輯副本」這一特定 pattern。大多數 `$effect` 實際上在做更複雜的事情——管理 DOM 生命週期、觸發跨元件副作用、或執行有條件的狀態 reconciliation——這些都是 `$effect` 無可取代的職責。
