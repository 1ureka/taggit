<script lang="ts">
  import { IconTag, IconPencil, IconPlayerPlay, IconLayoutList } from "@tabler/icons-svelte";
  import { IconArrowsLeftRight, IconChevronRight, IconSettings, IconTrash } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";
  let { data }: { data: PageData } = $props();
  const stats = $derived(data.stats);
</script>

<svelte:head>
  <title>Image Manager</title>
</svelte:head>

<div class="home-container slide-up">
  <h1 class="home-title">Image Manager</h1>
  <p class="home-subtitle">本地圖片標籤管理</p>

  <nav class="home-nav">
    <a href="/tagger" class="home-card">
      <span class="home-card-icon"><IconTag size={24} /></span>
      <div class="home-card-body">
        <div class="home-card-name">Tagger</div>
        <div class="home-card-desc">審查並標記新圖片</div>
      </div>
      <span class="home-card-arrow"><IconChevronRight size={20} /></span>
    </a>

    <a href="/editor" class="home-card">
      <span class="home-card-icon"><IconPencil size={24} /></span>
      <div class="home-card-body">
        <div class="home-card-name">Editor</div>
        <div class="home-card-desc">編輯已儲存圖片</div>
      </div>
      <span class="home-card-arrow"><IconChevronRight size={20} /></span>
    </a>

    <a href="/browse" class="home-card">
      <span class="home-card-icon"><IconPlayerPlay size={24} /></span>
      <div class="home-card-body">
        <div class="home-card-name">Browse</div>
        <div class="home-card-desc">水平輪播瀏覽</div>
      </div>
      <span class="home-card-arrow"><IconChevronRight size={20} /></span>
    </a>

    <a href="/scroll" class="home-card">
      <span class="home-card-icon"><IconLayoutList size={24} /></span>
      <div class="home-card-body">
        <div class="home-card-name">Scroll</div>
        <div class="home-card-desc">垂直捲動瀏覽</div>
      </div>
      <span class="home-card-arrow"><IconChevronRight size={20} /></span>
    </a>

    <a href="/compare" class="home-card">
      <span class="home-card-icon"><IconArrowsLeftRight size={24} /></span>
      <div class="home-card-body">
        <div class="home-card-name">Compare</div>
        <div class="home-card-desc">隨機比較</div>
      </div>
      <span class="home-card-arrow"><IconChevronRight size={20} /></span>
    </a>
  </nav>

  <div class="home-footer">
    <div class="stats">
      共 {stats.totalImages} 張圖片 · {stats.totalTags} 個標籤 · {stats.stagedCount} 張待審查
    </div>
  </div>

  <div class="home-settings">
    <a href="/setup" class="home-settings-link">
      <IconSettings size={14} />
      設定
    </a>
    <span class="home-settings-dot">·</span>
    <a href="/trash" class="home-settings-link">
      <IconTrash size={14} />
      垃圾桶
    </a>
  </div>
</div>

<style>
  .home-container {
    max-width: 640px;
    margin: 0 auto;
    padding: 4rem 1.5rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .home-title {
    font-size: 2rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin-bottom: 0.25rem;
  }

  .home-subtitle {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-bottom: 2.5rem;
  }

  .home-nav {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 3rem;
  }

  .home-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 1.5);
    transition:
      background 0.15s,
      border-color 0.15s;
    cursor: pointer;
    text-decoration: none;
    color: inherit;
  }

  .home-card:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }

  .home-card-icon {
    font-size: 1.5rem;
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .home-card-body {
    flex: 1;
  }

  .home-card-name {
    font-size: 0.9375rem;
    font-weight: 500;
    margin-bottom: 0.125rem;
  }

  .home-card-desc {
    font-size: 0.8125rem;
    color: var(--text-muted);
  }

  .home-card-arrow {
    color: var(--text-dim);
    font-size: 1.25rem;
    display: flex;
    align-items: center;
  }

  .home-footer {
    color: var(--text-dim);
    font-size: 0.8125rem;
    text-align: center;
  }

  .home-footer .stats {
    display: inline-flex;
    gap: 1rem;
  }

  .home-settings {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .home-settings-dot {
    color: var(--text-dim);
    font-size: 0.8125rem;
    user-select: none;
  }

  .home-settings-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--text-dim);
    font-size: 0.8125rem;
    transition: color 0.15s;
  }

  .home-settings-link:hover {
    color: var(--text-muted);
  }
</style>
