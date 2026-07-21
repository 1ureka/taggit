<script lang="ts">
  import { IconEditFilled, IconArrowLeft } from "$lib/icons";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
</script>

<svelte:head>
  <title>管理圖片 — Taggit</title>
</svelte:head>

<main class="slide-up">
  <div class="page-icon">
    <IconEditFilled size={48} />
  </div>

  <h2>開發中</h2>
  <p>管理圖片功能尚在開發中，敬請期待。</p>

  <ButtonLink href="/" variant="outlined">
    <IconArrowLeft size={16} />
    <span>返回首頁</span>
  </ButtonLink>
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

  .page-icon {
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
  }

  h2 {
    font-size: 3rem;
    font-weight: normal;
    letter-spacing: -0.03em;
    line-height: 1;
    color: var(--color-text);
  }

  p {
    font: var(--font-body1);
    color: var(--color-text-muted);
    max-width: 320px;
    margin-bottom: 1rem;
  }
</style>
