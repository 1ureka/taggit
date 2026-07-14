<script lang="ts">
  import { IconPhotoFilled } from "$lib/icons";
</script>

<svelte:head>
  <title>Taggit</title>
</svelte:head>

<!-- Phase 2 佔位：`/` 的 masonry 瀏覽頁將在路由重寫階段實作 -->
<main class="slide-up">
  <div class="icon">
    <IconPhotoFilled size={48} />
  </div>
  <h2>瀏覽頁尚未就緒</h2>
  <p>masonry 瀏覽頁將在後續階段實作，目前可先透過導航面板前往設定。</p>
</main>

<style>
  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 0.75rem;
    padding: 4rem 1.5rem;
  }

  .icon {
    color: var(--color-text-muted);
    margin-bottom: 0.5rem;
  }

  h2 {
    font: var(--font-title1);
  }

  p {
    font: var(--font-body1);
    color: var(--color-text-muted);
    max-width: 320px;
  }
</style>
