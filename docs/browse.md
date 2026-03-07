# 重構計畫 — `/browse`（篩選頁）

> 參考規範：[components.md](./components.md)、[context.md](./context.md)

---

## 一、現況分析

### 檔案結構

```
src/routes/browse/
├── +page.server.ts   ← SSR：預查總數（initialCount）
├── +page.svelte      ← 頁面殼：僅渲染 <Form>
├── Form.svelte       ← 篩選表單 UI
└── form.svelte.ts    ← 篩選表單無頭 UI（createForm 工廠函數）
```

共 **4 個檔案**。

### 合規程度

| 規範 | 狀態 | 說明 |
|------|------|------|
| `+page.svelte` 只做組裝 | ✅ 合規 | 僅接收 `data`，渲染 `<Form>` |
| 子元件拆分 | ✅ 合規 | `Form.svelte` + `form.svelte.ts` |
| 無頭 UI 工廠函數 | ✅ 合規 | `createForm` 已實作 |
| Props 雙向綁定 | ✅ 合規 | `matchCount` 以 getter/setter 傳入 |

### 現有問題

1. **`form.svelte.ts` 中大量 `?` 佔位符 JSDoc**：所有 JSDoc 備註都是 `/** ? */`，顯然是待補。
2. **命名不夠語意化**：`Form.svelte` / `form.svelte.ts` 過於通用，建議改為 `BrowseFilter.svelte` / `browseFilter.svelte.ts`。

---

## 二、重構目標

1. 將 `Form.svelte` 重命名為 `BrowseFilter.svelte`，`form.svelte.ts` 重命名為 `browseFilter.svelte.ts`。
2. 補齊 `form.svelte.ts` 中的 JSDoc。

---

## 三、目標檔案結構

```
src/routes/browse/
├── +page.server.ts           ← 不變
├── +page.svelte              ← 更新 import 路徑
├── BrowseFilter.svelte       ← 重命名自 Form.svelte
└── browseFilter.svelte.ts    ← 重命名自 form.svelte.ts + 補齊 JSDoc
```

---

## 四、改動細節

### 4.1 重命名

| 原名 | 新名 |
|------|------|
| `Form.svelte` | `BrowseFilter.svelte` |
| `form.svelte.ts` | `browseFilter.svelte.ts` |

### 4.2 `+page.svelte` 更新

```diff
- import Form from "./Form.svelte";
+ import BrowseFilter from "./BrowseFilter.svelte";
```

```diff
- <Form matchCount={data.initialCount} />
+ <BrowseFilter matchCount={data.initialCount} />
```

### 4.3 補齊 JSDoc

`browseFilter.svelte.ts` 中所有 `/** ? */` 需替換為實際說明，例如：

- `tags` → `/** 當前所選的篩選標籤 */`
- `rating` → `/** 最低評等篩選值（0 = 不篩選） */`
- `sort` → `/** 排序方式 */`
- `updateCount` → `/** 以 debounce 方式查詢符合條件的圖片數量 */`
- `startPlayer` → `/** 組裝查詢參數並導航至 Player 子路由 */`

---

## 五、注意事項

- **此路由已高度合規**，是專案中最貼近 `components.md` 規範的路由。
- 無需引入 Context（單頁面、無跨元件共享狀態需求）。
