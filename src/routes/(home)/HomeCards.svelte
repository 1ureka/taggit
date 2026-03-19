<script lang="ts">
  import { IconTag, IconPencil, IconPlayerPlay, IconLayoutList } from "@tabler/icons-svelte";
  import { IconArrowsLeftRight, IconChevronRight } from "@tabler/icons-svelte";
  import { HomeCards } from "./homeCards.svelte.js";

  const ui = new HomeCards();
</script>

<svelte:window onmousemove={ui.handleWindowMousemove} />

{#snippet card(href: string, Icon: typeof IconTag, name: string, desc: string)}
  <a {href} class="card">
    <!-- <span class="card-icon"><Icon size={24} /></span> -->
    <Icon size={24} />
    <div class="card-body">
      <div class="card-name">{name}</div>
      <div class="card-desc">{desc}</div>
    </div>
    <IconChevronRight size={20} />
    <!-- <span class="card-arrow"><IconChevronRight size={20} /></span> -->
  </a>
{/snippet}

<nav>
  {@render card("/tagger", IconTag, "Tagger", "審查並標記新圖片")}
  {@render card("/editor", IconPencil, "Editor", "編輯已儲存圖片")}
  {@render card("/browse", IconPlayerPlay, "Browse", "水平輪播瀏覽")}
  {@render card("/scroll", IconLayoutList, "Scroll", "垂直捲動瀏覽")}
  {@render card("/compare", IconArrowsLeftRight, "Compare", "隨機比較")}
</nav>

<style>
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
    cursor: pointer;
    --light-ring: hsl(from var(--accent) h s l / 0.75);
    --light-bloom: hsl(from var(--accent) h s l / 0.15);
    --bg-ring: radial-gradient(circle at var(--bg-x, 0) var(--bg-y, 0), var(--light-ring), transparent 7.5rem);
    --bg-bloom: radial-gradient(circle at var(--bg-x, 0) var(--bg-y, 0), var(--light-bloom), transparent 15rem);
  }

  .card::after {
    content: "";
    position: absolute;
    inset: -2px;
    background-image: var(--bg-ring);
    background-attachment: fixed;
    border-radius: inherit;
    pointer-events: none;
    z-index: -1;
  }

  .card:hover {
    background-color: var(--bg-hover);
    background-image: var(--bg-bloom);
    background-attachment: fixed;
  }

  .card:active {
    background-color: var(--bg-active);
  }

  /* .card-icon {
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  } */

  .card-body {
    flex: 1;
  }

  .card-name {
    font-size: 0.9375rem;
    font-weight: 500;
    margin-bottom: 0.125rem;
  }

  .card-desc {
    font-size: 0.8125rem;
    color: var(--text-muted);
  }

  /* .card-arrow {
    color: var(--text-dim);
    font-size: 1.25rem;
    display: flex;
    align-items: center;
  } */

  .card :last-child {
    color: var(--text-dim);
  }
</style>
