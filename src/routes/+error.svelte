<script lang="ts">
  import { page } from "$app/state";
  import { IconArrowLeft, IconAlertTriangleFilled } from "$lib/ui/icons";
</script>

<svelte:head>
  <title>{page.status} — Taggit</title>
</svelte:head>

<main class="slide-up">
  <div class="error-icon">
    <IconAlertTriangleFilled size={48} />
  </div>

  <h2>{page.status}</h2>
  <p>{page.error?.message ?? "發生未知錯誤"}</p>

  <a href="/" class="btn-outlined">
    <IconArrowLeft size={16} />
    <span>返回首頁</span>
  </a>
</main>

<style>
  main {
    max-width: 480px;
    margin: 0 auto;
    padding: 4rem 1.5rem;
    flex: 1;
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

  h2 {
    font-size: var(--font-size-display);
    font-weight: normal;
    letter-spacing: -0.03em;
    line-height: 1;
    color: var(--text);
  }

  p {
    font-size: var(--font-size-body1);
    color: var(--text-muted);
    max-width: 320px;
    line-height: 1.5;
    margin-bottom: 1rem;
  }
</style>
