<script lang="ts">
  import type { PageData } from "./$types.js";
  import { IconAlbum, IconChevronRight, IconLibraryPhoto, IconTag, IconSettings } from "@tabler/icons-svelte";

  let { data }: { data: PageData } = $props();

  /** 處理 Window 滑鼠移動事件，更新背景光暈座標 */
  const handleWindowMousemove = (e: MouseEvent) => {
    document.documentElement.style.setProperty("--bg-x", e.clientX + "px");
    document.documentElement.style.setProperty("--bg-y", e.clientY + "px");
  };
</script>

<svelte:head>
  <title>Image Manager</title>
</svelte:head>

<svelte:window onmousemove={handleWindowMousemove} />

<div class="page">
  <main>
    <h1>Image Manager</h1>
    <h2>本地圖片標籤管理工具</h2>

    {#snippet card(href: string, Icon: typeof IconTag, name: string, desc: string)}
      <a {href} class="card">
        <Icon size={24} />
        <div class="card-body">
          <h3>{name}</h3>
          <!-- 為了拖動時文字不要被連到一起 -->
          {" "}
          <p>{desc}</p>
        </div>
        <IconChevronRight size={20} color="var(--text-dim)" />
      </a>
    {/snippet}

    <nav>
      {@render card("/tagger", IconTag, "新增圖片", "審查並標記暫存圖片")}
      {@render card("/editor", IconAlbum, "管理圖片", "編輯已提交圖片")}
      {@render card("/browse", IconLibraryPhoto, "瀏覽圖片", "以瀑布流、播放器、隨機抽選等多種方式")}
      {@render card("#", IconTag, "瀏覽標籤", "敬請期待")}
    </nav>

    <small>
      共 {data.stats.totalImages} 張圖片 · {data.stats.totalTags} 個標籤 · {data.stats.stagedCount} 張待審查
    </small>

    <footer>
      <a href="/settings">
        <IconSettings size={14} />
        設定
      </a>
    </footer>
  </main>
</div>

<style>
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

  .page {
    height: 100vh;
    overflow-y: auto;
    scrollbar-gutter: stable;
  }

  main {
    max-width: 640px;
    margin: 0 auto;
    padding: 4rem 1.5rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    animation: slideUp 0.3s ease-out both;
  }

  /* --- */

  h1 {
    font-size: 2rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin-bottom: 0.25rem;
  }

  h2 {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 2.5rem;
  }

  /* --- */

  nav {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 3rem;
  }

  .card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.25rem;
    background-color: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 1.5);

    transition: background-color 0.15s;
    --light-ring: hsl(from var(--accent) h s l / 0.75);
    --light-bloom: hsl(from var(--accent) h s l / 0.15);
    --bg-ring: radial-gradient(circle at var(--bg-x, 0) var(--bg-y, 0), var(--light-ring), transparent 7.5rem);
    --bg-bloom: radial-gradient(circle at var(--bg-x, 0) var(--bg-y, 0), var(--light-bloom), transparent 15rem);

    &::after {
      content: "";
      position: absolute;
      inset: -2px;
      background-image: var(--bg-ring);
      background-attachment: fixed;
      border-radius: inherit;
      pointer-events: none;
      z-index: -1;
    }

    &:hover {
      background-color: var(--bg-hover);
      background-image: var(--bg-bloom);
      background-attachment: fixed;
    }

    &:active {
      background-color: var(--bg-active);
    }
  }

  .card > .card-body {
    flex: 1;

    & > h3 {
      font-weight: normal;
      font-size: 0.9375rem;
      margin-bottom: 0.125rem;
    }

    & > p {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }
  }

  /* --- */

  small {
    color: var(--text-dim);
    font-size: 0.8125rem;
    text-align: center;
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1rem;

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
