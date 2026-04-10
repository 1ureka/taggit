# Writable `$derived` 遷移方案：FilterFields 與 EditorForm

> 本文件針對 [writable-derived-analysis.md](./writable-derived-analysis.md) 中判定可遷移的兩個 class，提供完整的遷移方案、前後對比、及需要注意的行為差異。

---

## 1. FilterFields（🟢 直接遷移）

### 1.1 現狀

```ts
// src/lib/ui/filterFields.svelte.ts

export class FilterFields {
    search = $state<string>("");
    includedTags = $state<string[]>([]);
    excludedTags = $state<string[]>([]);
    rating = $state<number | undefined>(undefined);
    ratingOp = $state<"gte" | "lte" | "eq">("gte");
    sort = $state<SortField>("rating");
    order = $state<"asc" | "desc">("desc");

    constructor() {
        this.#setFields(untrack(() => parseQueryParams(page.url)));
        $effect(() => {
            this.#setFields(parseQueryParams(page.url));
        });
    }

    #setFields(opts: QueryOptions) {
        this.search = opts.search ?? "";
        this.includedTags = opts.includedTags ?? [];
        this.excludedTags = opts.excludedTags ?? [];
        this.rating = opts.rating;
        this.ratingOp = opts.ratingOp ?? "gte";
        this.sort = opts.sort ?? "rating";
        this.order = opts.order ?? "desc";
    }

    // ...
}
```

**資料流**：

```
URL 變動 → parseQueryParams(page.url) → $effect → #setFields → 7 個 $state
使用者操作 → bind:value → $state → handleChange/handleSearchChange → goto() → URL 變動
```

### 1.2 遷移後

```ts
// src/lib/ui/filterFields.svelte.ts

export class FilterFields {
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

    // #setFields 完全移除

    // #getQueryString、#goto、handleChange、handleSearchChange 不變
}
```

**資料流**：

```
URL 變動 → parseQueryParams(page.url) → $derived 重新計算 → 7 個欄位更新
使用者操作 → bind:value → 寫入 writable $derived → handleChange/handleSearchChange → goto() → URL 變動
```

### 1.3 變更清單

| 項目 | 變更 |
| --- | --- |
| `filterFields.svelte.ts` | 7 個 `$state` → `$derived`；移除 `#setFields()`；移除 `$effect`；移除 `untrack` import |
| `FilterFields.svelte` | 不需變更（`bind:value` 對 writable `$derived` 同樣適用） |
| 其他檔案 | 不需變更 |

### 1.4 移除的項目

- `import { untrack } from "svelte"`
- `#setFields()` 方法（整個方法）
- constructor 中的 `$effect(() => { ... })`
- constructor 中的 `untrack()` 初始化

### 1.5 行為對比

| 場景 | 現狀 | 遷移後 |
| --- | --- | --- |
| 頁面初始載入 | `untrack` 讀取 URL → `#setFields` 賦值 | `$derived` 從 URL 計算初始值 |
| 使用者選擇排序 | `bind:value` 寫入 `$state` → `handleChange` → `goto()` → URL 變 → `$effect` → `#setFields` 覆蓋同一值 | `bind:value` 寫入 writable `$derived` → `handleChange` → `goto()` → URL 變 → `$derived` 重算確認值 |
| 使用者輸入搜尋 | `bind:value` 寫入 → debounce 500ms → `goto()` → URL 變 → `$effect` 覆蓋 | `bind:value` 寫入 → debounce 500ms → `goto()` → URL 變 → `$derived` 重算 |
| 瀏覽器上/下一頁 | URL 變 → `$effect` → `#setFields` 覆蓋 | URL 變 → `$derived` 重算，覆蓋先前的使用者寫入 |

所有場景行為一致，無 breaking change。

### 1.6 搜尋 Debounce 時序驗證

搜尋欄位有 500ms debounce，需要驗證快速輸入時的行為：

```
t=0    使用者輸入 "a"    → search = "a"（bind 寫入）
t=100  使用者輸入 "ab"   → search = "ab"（bind 寫入）
t=300  使用者輸入 "abc"  → search = "abc"（bind 寫入）
t=800  debounce 到期     → handleChange → #goto() 讀取 this.search = "abc" → goto("?search=abc")
t=810  URL 更新           → $derived 重算 → search = "abc"（值相同，無視覺變化）
```

writable `$derived` 的行為：debounce 期間，使用者的寫入值持續顯示。debounce 到期後 `goto()` 讀取最新寫入值。URL 更新後 `$derived` 重算確認值。整個過程使用者感知無差異。

---

## 2. EditorForm（🟡 可遷移，需配套設計）

### 2.1 現狀

```ts
// src/routes/editor/editorForm.svelte.ts

export class EditorForm {
    dirty = $state(false);
    name = $state("");
    tags = $state<string[]>([]);
    rating = $state(0);

    constructor(private options: EditorFormOptions) {
        // ...（$derived for nameDisabled, saveDisabled, deleteDisabled）...

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

    handleFormReset = (e: Event) => {
        e.preventDefault();
        this.#resetForm();
    };

    handleFieldChange = () => {
        this.dirty = true;
    };

    // ...
}
```

**難點**：`#resetForm()` 同時做兩件事：

1. 將 `name`、`tags`、`rating` 同步為 `currentRecord` 的值
2. 將 `dirty` 重置為 `false`

### 2.2 `dirty` 的語意分析

`dirty` 的行為：

- **來源切換時（`currentRecord` 變動）**：重置為 `false`
- **使用者編輯時**：設為 `true`（由 `handleFieldChange` 觸發）
- **手動重置時**：重置為 `false`（由 `handleFormReset` 觸發）

這其實正好符合 writable `$derived` 的語意：

- **權威來源**：`currentRecord` 變動 → 永遠是 `false`（因為剛切換圖片，表單沒有被編輯過）
- **樂觀寫入**：使用者編輯 → 設為 `true`
- **來源更新時**：`currentRecord` 變動 → `$derived` 重算 → 覆蓋回 `false`

### 2.3 遷移後

```ts
// src/routes/editor/editorForm.svelte.ts

export class EditorForm {
    dirty: boolean;
    name: string;
    tags: string[];
    rating: number;

    constructor(private options: EditorFormOptions) {
        this.name = $derived(options.currentRecord?.name ?? "");
        this.tags = $derived([...(options.currentRecord?.tags ?? [])]);
        this.rating = $derived(options.currentRecord?.rating ?? 0);

        // dirty：來源永遠是 false，但可以被 handleFieldChange 寫入 true
        // 當 currentRecord 變動時 $derived 重算，dirty 回到 false
        this.dirty = $derived.by(() => {
            options.currentRecord; // 追蹤 currentRecord 變動
            return false;
        });

        // nameDisabled、saveDisabled、deleteDisabled 不變
        this.nameDisabled = $derived(options.selectedFiles.size > 1);
        this.saveDisabled = $derived.by(() => { /* 不變 */ });
        this.deleteDisabled = $derived.by(() => { /* 不變 */ });
    }

    // #resetForm 改為寫回來源值
    #resetForm() {
        const rec = this.options.currentRecord;
        this.name = rec?.name ?? "";
        this.tags = [...(rec?.tags ?? [])];
        this.rating = rec?.rating ?? 0;
        this.dirty = false;
    }

    handleFormReset = (e: Event) => {
        e.preventDefault();
        this.#resetForm();
    };

    handleFieldChange = () => {
        this.dirty = true;
    };

    // 其餘方法完全不變
}
```

### 2.4 `dirty` 的 `$derived.by` 解釋

```ts
this.dirty = $derived.by(() => {
    options.currentRecord; // 建立對 currentRecord 的依賴追蹤
    return false;          // 永遠回傳 false
});
```

這段程式碼的語意是：

- `$derived` 的計算結果永遠是 `false`
- 但它追蹤了 `options.currentRecord`——當 `currentRecord` 變動時，`$derived` 重新計算
- 使用者透過 `handleFieldChange` 寫入 `true` 時，writable `$derived` 儲存覆蓋值
- 下次 `currentRecord` 變動 → `$derived` 重算 → 覆蓋值被丟棄 → 回到 `false`

### 2.5 `#resetForm` 的角色變化

| | 現狀 | 遷移後 |
| --- | --- | --- |
| 用途 | 同步 `currentRecord` → `$state` + 重置 `dirty` | 手動重置：將 writable `$derived` 寫回來源值 |
| 自動呼叫 | `$effect` 在 `currentRecord` 變動時自動呼叫 | 不需要——`$derived` 自動重算 |
| 手動呼叫 | `handleFormReset` 按鈕 | 同，用於使用者點擊「重置」按鈕 |

遷移後 `#resetForm` 只服務於手動重置（使用者點擊重置按鈕）。`currentRecord` 變動時的自動同步由 `$derived` 處理。

### 2.6 變更清單

| 項目 | 變更 |
| --- | --- |
| `editorForm.svelte.ts` | 4 個 `$state` → `$derived`；移除 constructor 的 `$effect`；`#resetForm` 邏輯微調 |
| `editor/+page.svelte` | 不需變更（`bind:value`/`bind:tags` 對 writable `$derived` 同樣適用） |
| `EditorFormOptions` | 不需變更 |
| `EditorPage` | 不需變更 |
| 其他檔案 | 不需變更 |

### 2.7 行為對比

| 場景 | 現狀 | 遷移後 |
| --- | --- | --- |
| 載入頁面 | `#resetForm()` 讀取 `currentRecord` 賦值 | `$derived` 從 `currentRecord` 計算初始值 |
| 切換圖片 | `currentRecord` 變 → `$effect` → `#resetForm()` → 4 個 `$state` 覆蓋 | `currentRecord` 變 → 4 個 `$derived` 重算 |
| 使用者編輯 | `bind:value` → `$state` + `handleFieldChange` → `dirty = true` | `bind:value` → writable `$derived` + `handleFieldChange` → `dirty = true` |
| 存檔後 | `invalidateAll()` → `currentRecord` 刷新 → `$effect` → `#resetForm()` | `invalidateAll()` → `currentRecord` 刷新 → `$derived` 重算 |
| 手動重置 | `handleFormReset` → `#resetForm()` → 回到 `currentRecord` 值 | `handleFormReset` → `#resetForm()` → 寫回 `currentRecord` 值 |
| `currentRecord` 為 null | `#resetForm` → `name=""`、`tags=[]`、`rating=0` | `$derived` → `name=""`、`tags=[]`、`rating=0`（`?.` + `??` fallback） |

所有場景行為一致。

### 2.8 saveDisabled 依賴鏈驗證

`saveDisabled` 讀取 `dirty`、`currentRecord`、`pending`、`selectedFiles.size`、`tags.length`：

```ts
this.saveDisabled = $derived.by(() => {
    if (!this.dirty) return true;       // ← dirty 是 writable $derived
    if (this.options.currentRecord === null) return true;
    if (this.options.pending) return true;
    if (this.options.selectedFiles.size === 0) return true;
    if (this.tags.length === 0) return true;  // ← tags 是 writable $derived
    return false;
});
```

遷移後 `dirty` 和 `tags` 都是 writable `$derived`，但讀取時的語意不變——`$derived.by` 讀取的是「當前值」（可能是 `$derived` 計算值，也可能是使用者寫入值），這正是所需的行為。

---

## 3. 完整 Diff 預覽

### 3.1 FilterFields

```diff
 import { page } from "$app/state";
 import { goto } from "$app/navigation";
-import { untrack } from "svelte";
 import { parseQueryParams, buildQueryString, debounce } from "$lib/utils.js";
 import type { QueryOptions, SortField } from "$lib/types";

 export class FilterFields {
-  search = $state<string>("");
-  includedTags = $state<string[]>([]);
-  excludedTags = $state<string[]>([]);
-  rating = $state<number | undefined>(undefined);
-  ratingOp = $state<"gte" | "lte" | "eq">("gte");
-  sort = $state<SortField>("rating");
-  order = $state<"asc" | "desc">("desc");
+  search: string;
+  includedTags: string[];
+  excludedTags: string[];
+  rating: number | undefined;
+  ratingOp: "gte" | "lte" | "eq";
+  sort: SortField;
+  order: "asc" | "desc";

   constructor() {
-    this.#setFields(untrack(() => parseQueryParams(page.url)));
-
-    $effect(() => {
-      this.#setFields(parseQueryParams(page.url));
-    });
+    const params = () => parseQueryParams(page.url);
+
+    this.search = $derived(params().search ?? "");
+    this.includedTags = $derived(params().includedTags ?? []);
+    this.excludedTags = $derived(params().excludedTags ?? []);
+    this.rating = $derived(params().rating);
+    this.ratingOp = $derived(params().ratingOp ?? "gte");
+    this.sort = $derived(params().sort ?? "rating");
+    this.order = $derived(params().order ?? "desc");
   }

   // ---

-  #setFields(opts: QueryOptions) {
-    this.search = opts.search ?? "";
-    this.includedTags = opts.includedTags ?? [];
-    this.excludedTags = opts.excludedTags ?? [];
-    this.rating = opts.rating;
-    this.ratingOp = opts.ratingOp ?? "gte";
-    this.sort = opts.sort ?? "rating";
-    this.order = opts.order ?? "desc";
-  }
-
   #getQueryString(): string {
```

### 3.2 EditorForm

```diff
 export class EditorForm {
-  dirty = $state(false);
-  name = $state("");
-  tags = $state<string[]>([]);
-  rating = $state(0);
+  dirty: boolean;
+  name: string;
+  tags: string[];
+  rating: number;
   nameDisabled: boolean;
   saveDisabled: boolean;
   deleteDisabled: boolean;

   constructor(private options: EditorFormOptions) {
+    this.name = $derived(options.currentRecord?.name ?? "");
+    this.tags = $derived([...(options.currentRecord?.tags ?? [])]);
+    this.rating = $derived(options.currentRecord?.rating ?? 0);
+
+    this.dirty = $derived.by(() => {
+      options.currentRecord;
+      return false;
+    });
+
     this.nameDisabled = $derived(options.selectedFiles.size > 1);

     this.saveDisabled = $derived.by(() => {
@@ // ... 不變 ...

     this.deleteDisabled = $derived.by(() => {
@@ // ... 不變 ...
-
-    this.#resetForm();
-
-    $effect(() => {
-      this.#resetForm();
-    });
   }

   // ---

   #resetForm() {
     const rec = this.options.currentRecord;
-
-    if (rec) {
-      this.name = rec.name;
-      this.tags = [...rec.tags];
-      this.rating = rec.rating;
-    } else {
-      this.name = "";
-      this.tags = [];
-      this.rating = 0;
-    }
-
+    this.name = rec?.name ?? "";
+    this.tags = [...(rec?.tags ?? [])];
+    this.rating = rec?.rating ?? 0;
     this.dirty = false;
   }
```

---

## 4. 結論

| | FilterFields | EditorForm |
| --- | --- | --- |
| **遷移難度** | 🟢 低 | 🟡 中 |
| **是否需改連帶檔案** | 否 | 否 |
| **效益** | 移除 `untrack`、`$effect`、`#setFields`，淨減約 15 行 | 移除 `$effect`，`#resetForm` 簡化，淨減約 10 行 |
| **風險** | 無——所有行為場景一致 | 低——`dirty` 的 `$derived.by` 稍不直覺，但語意正確 |
| **建議** | ✅ 建議遷移 | ✅ 建議遷移，遷移後驗證 `dirty` / `saveDisabled` 行為 |

兩者都**不需要修改任何連帶檔案**（template、options type、相關 class）——writable `$derived` 對外暴露的讀寫介面與 `$state` 完全相同，`bind:value` 和 getter/setter options 都不受影響。
