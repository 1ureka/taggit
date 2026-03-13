<script lang="ts">
  import type { PageData } from "./$types.js";
  import { IconSettings, IconTrash } from "@tabler/icons-svelte";
  import HomeCards from "./HomeCards.svelte";

  let { data }: { data: PageData } = $props();
  const stats = $derived(data.stats);
</script>

<svelte:head>
  <title>Image Manager</title>
</svelte:head>

<main>
  <div class="container home-enter">
    <h1 class="title">Image Manager</h1>
    <p class="subtitle">本地圖片標籤管理</p>

    <HomeCards />

    <div class="stats">
      共 {stats.totalImages} 張圖片 · {stats.totalTags} 個標籤 · {stats.stagedCount} 張待審查
    </div>

    <div class="footer">
      <a href="/settings">
        <IconSettings size={14} />
        設定
      </a>
      <span class="footer-dot">·</span>
      <a href="/trash">
        <IconTrash size={14} />
        垃圾桶
      </a>
    </div>
  </div>
</main>

<style>
  main {
    height: 100vh;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  /** slide-up 但不使用 transform，避免創建 containing block 導致 background-attachment: fixed 失效 */
  @keyframes slideUp {
    from {
      opacity: 0;
      margin-top: 8px;
    }
    to {
      opacity: 1;
      margin-top: 0;
    }
  }

  .container {
    max-width: 640px;
    margin: 0 auto;
    padding: 4rem 1.5rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    animation: slideUp 0.3s ease-out both;
  }

  .title {
    font-size: 2rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-bottom: 2.5rem;
  }

  .stats {
    color: var(--text-dim);
    font-size: 0.8125rem;
    text-align: center;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1rem;

    & > .footer-dot {
      color: var(--text-dim);
      font-size: 0.8125rem;
      user-select: none;
    }

    & > a {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--text-dim);
      font-size: 0.8125rem;
      transition: color 0.15s;

      &:hover {
        color: var(--text-muted);
      }
    }
  }
</style>
