# 重構計畫 — `/setup`（設定頁）

> 參考規範：[components.md](./components.md)、[context.md](./context.md)

---

## 一、現況分析

### 檔案結構

```
src/routes/setup/
├── +page.server.ts   ← SSR：讀取 collectionRoot
├── +page.svelte      ← 設定頁全部 UI + 邏輯 + 樣式（~150 行）
```

### 問題

1. **違反 Page 規範**：`+page.svelte` 包含表單提交邏輯（`submit`）、多個 `$state`（`collectionRoot`, `saving`, `message`, `isError`）與大量 scoped 樣式。
2. **無子元件**：所有 UI 直接寫在頁面層。
3. **無無頭 UI 拆分**。

---

## 二、重構目標

將表單 UI 與邏輯抽出至 `SetupForm.svelte` + `setupForm.svelte.ts`，頁面層僅做資料銜接。

---

## 三、目標檔案結構

```
src/routes/setup/
├── +page.server.ts        ← 不變
├── +page.svelte           ← 僅接收 data，渲染 <SetupForm>
├── SetupForm.svelte       ← 表單 UI（結構 + 樣式）
└── setupForm.svelte.ts    ← 表單邏輯（提交、驗證、狀態管理）
```

---

## 四、各檔案職責

### 4.1 `+page.svelte`

```svelte
<script lang="ts">
  import type { PageData } from "./$types.js";
  import SetupForm from "./SetupForm.svelte";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>設定 — Image Manager</title>
</svelte:head>

<main class="page">
  <SetupForm collectionRoot={data.collectionRoot ?? ""} />
</main>
```

### 4.2 `setupForm.svelte.ts`

```ts
type SetupFormOptions = {
  initialRoot: string;
};

export function createSetupForm(options: SetupFormOptions) {
  let collectionRoot = $state(options.initialRoot);
  let saving = $state(false);
  let message = $state("");
  let isError = $state(false);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    saving = true;
    message = "";

    const res = await fetch("/api/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ collectionRoot: collectionRoot.trim() }),
    });
    const json = await res.json();
    saving = false;

    if (json.ok) {
      window.location.href = "/";
    } else {
      isError = true;
      message = json.error ?? "未知錯誤";
    }
  }

  return {
    get collectionRoot() { return collectionRoot; },
    set collectionRoot(v) { collectionRoot = v; },
    get saving() { return saving; },
    get message() { return message; },
    get isError() { return isError; },
    handleSubmit,
  };
}
```

### 4.3 `SetupForm.svelte`

- 接收 `collectionRoot` prop。
- 呼叫 `createSetupForm({ initialRoot: collectionRoot })`。
- 搬入原 `+page.svelte` 的所有 HTML 結構（包含 alert 判斷）與 `<style>`。
- URL query param `alert` 的讀取可在 `setupForm.svelte.ts` 初始化時處理，或由 `.svelte` 傳入。

---

## 五、注意事項

- `+page.server.ts` 不需修改。
- 設定頁為獨立表單，無 context 需求。
- `alert` query param 目前在 `+page.svelte` 中用 `window.location.search` 讀取，重構後移至 `SetupForm.svelte` 或透過 prop 傳入。
