<script lang="ts">
  import { page } from "$app/state";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  /** 引導 redirect 帶來的提示訊息（Phase 1 會換成正式的 Alert 元件） */
  const alertMessage = $derived.by(() => {
    const alert = page.url.searchParams.get("alert");
    if (alert === "default") return "尚未設定收藏目錄，請先完成收藏目錄設定。";
    if (alert === "error") return "收藏目錄無效或無法存取，請重新設定。";
    return null;
  });
</script>

<svelte:head>
  <title>設定 — Taggit</title>
</svelte:head>

<!-- Phase 1 佔位：完整的設定頁（收藏目錄、維護任務、標籤管理）將在路由重寫階段實作 -->
<main class="slide-up">
  <h2>設定</h2>

  {#if alertMessage}
    <p class="alert">{alertMessage}</p>
  {/if}

  <p>目前收藏：{data.collectionName}</p>
  <p class="note">此頁為建置期的佔位頁，完整設定功能將在後續階段提供。</p>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: min(70ch, 100%);
    margin: 0 auto;
    padding: 3rem 1.5rem;
    overflow-y: auto;
  }

  h2 {
    font: var(--font-title1);
  }

  p {
    font: var(--font-body1);
    color: var(--color-text);
  }

  .alert {
    padding: 0.5rem 0.75rem;
    color: var(--color-warning);
    background-color: hsl(from var(--color-warning) h s l / 0.1);
    border: var(--border-style);
    border-color: hsl(from var(--color-warning) h s l / 0.5);
    border-radius: var(--border-radius);
  }

  .note {
    color: var(--color-text-muted);
  }
</style>
