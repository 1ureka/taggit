<script lang="ts">
  import { page } from "$app/state";
  import { IconArrowLeft, IconAlertTriangle } from "@tabler/icons-svelte";
</script>

<svelte:head>
  <title>{page.status} — Image Manager</title>
</svelte:head>

<div class="error-container slide-up">
  <div class="error-icon">
    <IconAlertTriangle size={48} />
  </div>
  <h1 class="error-status">{page.status}</h1>
  <p class="error-message">{page.error?.message ?? "發生未知錯誤"}</p>
  <a href="/" class="btn-ghost">
    <IconArrowLeft size={16} />
    <span>返回首頁</span>
  </a>
</div>

<style>
  .error-container {
    max-width: 480px;
    margin: 0 auto;
    padding: 4rem 1.5rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 0.75rem;
  }

  .error-icon {
    color: var(--text-dim);
    margin-bottom: 0.5rem;
  }

  .error-status {
    font-size: 3rem;
    font-weight: 600;
    letter-spacing: -0.03em;
    line-height: 1;
    color: var(--text);
  }

  .error-message {
    font-size: 0.9375rem;
    color: var(--text-muted);
    max-width: 320px;
    line-height: 1.5;
    margin-bottom: 1rem;
  }
</style>
