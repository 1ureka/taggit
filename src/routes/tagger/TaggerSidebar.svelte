<script lang="ts">
  let {
    stagedFiles,
    currentIndex,
    onselect,
  }: { stagedFiles: string[]; currentIndex: number; onselect: (idx: number) => void } = $props();

  let sidebarListEl: HTMLDivElement | undefined = $state();

  /** Scroll the active thumbnail into view. */
  export function scrollToActive(idx: number) {
    requestAnimationFrame(() => {
      const thumbs = sidebarListEl?.querySelectorAll(".tagger-thumb");
      thumbs?.[idx]?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
</script>

<aside class="tagger-sidebar">
  <div class="tagger-sidebar-header">
    <span class="tagger-sidebar-title">待審查</span>
    <span class="badge">{stagedFiles.length}</span>
  </div>
  <div class="tagger-sidebar-list" bind:this={sidebarListEl}>
    {#if stagedFiles.length === 0}
      <div class="tagger-empty">沒有待審查的圖片</div>
    {:else}
      {#each stagedFiles as filename, idx}
        <button type="button" class="tagger-thumb" class:active={idx === currentIndex} onclick={() => onselect(idx)}>
          <img
            class="tagger-thumb-img"
            src="/img/staged/{encodeURIComponent(filename)}"
            alt={filename}
            loading="lazy"
          />
          <span class="tagger-thumb-name">{filename}</span>
        </button>
      {/each}
    {/if}
  </div>
</aside>

<style>
  .tagger-sidebar {
    width: 220px;
    min-width: 220px;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border);
    background: var(--bg-card);
    overflow: hidden;
  }

  .tagger-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  .tagger-sidebar-title {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-muted);
  }

  .tagger-sidebar-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .tagger-thumb {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    cursor: pointer;
    border: none;
    border-left: 3px solid transparent;
    background: transparent;
    width: 100%;
    text-align: left;
    color: inherit;
    font-family: inherit;
    transition:
      background 0.1s,
      border-color 0.15s;
    user-select: none;
  }

  .tagger-thumb:hover {
    background: var(--bg-hover);
  }

  .tagger-thumb.active {
    background: var(--bg-active);
    border-left-color: var(--accent);
  }

  .tagger-thumb-img {
    width: auto;
    height: 60px;
    max-width: 80px;
    object-fit: cover;
    border-radius: 4px;
    background: var(--bg);
    flex-shrink: 0;
  }

  .tagger-thumb-name {
    flex: 1;
    font-size: 0.6875rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .tagger-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 0.875rem;
    color: var(--text-dim);
  }

  /* ─── Mobile ─────────────────────────────────────────────────────────── */

  @media (max-width: 768px) {
    .tagger-sidebar {
      width: 100%;
      min-width: 0;
      max-height: 120px;
      border-right: none;
      border-bottom: 1px solid var(--border);
    }

    .tagger-sidebar-list {
      display: flex;
      flex-direction: row;
      overflow-x: auto;
      overflow-y: hidden;
    }

    .tagger-thumb {
      flex-direction: column;
      min-width: 80px;
      border-left: none;
      border-bottom: 3px solid transparent;
      padding: 0.25rem;
      text-align: center;
    }

    .tagger-thumb.active {
      border-left-color: transparent;
      border-bottom-color: var(--accent);
    }

    .tagger-thumb-img {
      height: 48px;
      max-width: 64px;
    }
  }
</style>
