# 重構計畫 — `/`（首頁）

> 參考規範：[components.md](./components.md)、[context.md](./context.md)

---

## 一、現況分析

### 檔案結構

```
src/routes/
├── +page.server.ts   ← SSR：統計 totalImages, totalTags, stagedCount, trashCount
├── +page.svelte      ← 首頁全部 UI + 樣式（~200 行）
```

### 問題

1. **違反 Page 規範**：`+page.svelte` 包含業務邏輯（`$derived` 計算 `stats`）、所有 HTML 結構與大量 scoped 樣式，未委託給子元件。
2. **無無頭 UI 拆分**：雖然頁面較簡單，但按規範仍應至少有一個子元件。

---

## 二、重構目標

將首頁的所有 UI 抽出至 `Home.svelte` + `home.svelte.ts`，`+page.svelte` 僅做資料接收 → 傳入子元件。

---

## 三、目標檔案結構

```
src/routes/
├── +page.server.ts        ← 不變
├── +page.svelte           ← 僅接收 data，渲染 <Home>
├── Home.svelte            ← 首頁 UI（結構 + 樣式）
└── home.svelte.ts         ← 無頭 UI（統計數據衍生）
```

---

## 四、各檔案職責

### 4.1 `+page.svelte`

```svelte
<script lang="ts">
  import type { PageData } from "./$types.js";
  import Home from "./Home.svelte";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Image Manager</title>
</svelte:head>

<Home
  totalImages={data.stats.totalImages}
  totalTags={data.stats.totalTags}
  stagedCount={data.stats.stagedCount}
  trashCount={data.stats.trashCount}
/>
```

- 無業務邏輯、無 `<style>`（或僅保留最外層殼層佈局）。

### 4.2 `home.svelte.ts`

```ts
type HomeOptions = {
  totalImages: number;
  totalTags: number;
  stagedCount: number;
  trashCount: number;
};

export function createHome(options: HomeOptions) {
  // 目前首頁邏輯極其簡單，僅做 pass-through
  // 未來若新增導航快捷鍵等可在此擴充

  return {
    get totalImages() { return options.totalImages; },
    get totalTags() { return options.totalTags; },
    get stagedCount() { return options.stagedCount; },
    get trashCount() { return options.trashCount; },
  };
}
```

### 4.3 `Home.svelte`

- 接收 props，呼叫 `createHome` 建立 `ui`。
- 搬入原 `+page.svelte` 的所有 HTML 結構與 `<style>`。
- 將 `stats` 相關的 `$derived` 改用 `ui.*` getter。

---

## 五、注意事項

- `+page.server.ts` 不需任何修改。
- 首頁為純展示頁，無 context 需求。
