<script lang="ts">
  import { IconTag, IconPencil, IconPlayerPlay, IconLayoutList } from "@tabler/icons-svelte";
  import { IconArrowsLeftRight, IconChevronRight, IconSettings, IconTrash } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  let { data }: { data: PageData } = $props();
  const stats = $derived(data.stats);

  function onMouseMove(e: MouseEvent) {
    const el = e.currentTarget as HTMLElement;
    el.style.setProperty("--x", e.clientX + "px");
    el.style.setProperty("--y", e.clientY + "px");
  }
</script>

<svelte:head>
  <title>Image Manager</title>
</svelte:head>

<main class="home" onmousemove={onMouseMove}>
  <div class="home-container home-enter">
    <h1 class="home-title">Image Manager</h1>
    <p class="home-subtitle">本地圖片標籤管理</p>

    {#snippet card(href: string, Icon: typeof IconTag, name: string, desc: string)}
      <a {href} class="home-card">
        <span class="home-card-icon"><Icon size={24} /></span>
        <div class="home-card-body">
          <div class="home-card-name">{name}</div>
          <div class="home-card-desc">{desc}</div>
        </div>
        <span class="home-card-arrow"><IconChevronRight size={20} /></span>
      </a>
    {/snippet}

    <nav class="home-nav">
      {@render card("/tagger", IconTag, "Tagger", "審查並標記新圖片")}
      {@render card("/editor", IconPencil, "Editor", "編輯已儲存圖片")}
      {@render card("/browse", IconPlayerPlay, "Browse", "水平輪播瀏覽")}
      {@render card("/scroll", IconLayoutList, "Scroll", "垂直捲動瀏覽")}
      {@render card("/compare", IconArrowsLeftRight, "Compare", "隨機比較")}
    </nav>

    <div class="home-footer">
      <div class="stats">
        共 {stats.totalImages} 張圖片 · {stats.totalTags} 個標籤 · {stats.stagedCount} 張待審查
      </div>
    </div>

    <div class="home-settings">
      <a href="/settings" class="home-settings-link">
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
</main>

<style>
  main.home {
    height: 100vh;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

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
    position: relative;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background-color: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 1.5);
    transition: all 0.15s;
    cursor: pointer;

    --light-outline: hsl(from var(--accent) h s l / 0.75);
    --light-bg: hsl(from var(--accent) h s l / 0.15);
  }

  .home-card::after {
    content: "";
    position: absolute;
    inset: -2px;
    background-image: radial-gradient(circle at var(--x, 0) var(--y, 0), var(--light-outline), transparent 7.5rem);
    background-attachment: fixed;
    border-radius: inherit;
    pointer-events: none;
    z-index: -1;
  }

  .home-card:hover {
    background-color: var(--bg-hover);
    background-image: radial-gradient(circle at var(--x, 0) var(--y, 0), var(--light-bg), transparent 15rem);
    background-attachment: fixed;
  }

  .home-card:active {
    background-color: var(--bg-active);
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

  /** slide-up 但不使用 transform，避免創建 containing block 導致 background-attachment: fixed 失效 */
  @keyframes homeEnter {
    from {
      opacity: 0;
      margin-top: 8px;
    }
    to {
      opacity: 1;
      margin-top: 0;
    }
  }

  .home-enter {
    animation: homeEnter 0.3s ease-out both;
  }
</style>
