<script lang="ts">
  import { imgSrc } from "$lib/client/api.js";
  import { TaggerList } from "./taggerList.svelte.js";
  import TaggerRefresh from "./TaggerRefresh.svelte";
  import TaggerUpload from "./TaggerUpload.svelte";

  type Props = {
    stagedFiles: string[];
    currentFile: string | null;
    selectedFiles: Set<string>;
  };

  let { stagedFiles, currentFile = $bindable(), selectedFiles = $bindable() }: Props = $props();

  const ui = new TaggerList({
    get stagedFiles() {
      return stagedFiles;
    },
    get currentFile() {
      return currentFile;
    },
    set currentFile(v) {
      currentFile = v;
    },
    get selectedFiles() {
      return selectedFiles;
    },
    set selectedFiles(v) {
      selectedFiles = v;
    },
  });
</script>

<svelte:window onkeydown={ui.handleWindowKeydown} />

<header>
  <div class="title">
    <h1>待審查列表</h1>
    <span class="badge">{ui.badgeLabel}</span>
  </div>
  <TaggerRefresh />
</header>

<div class="list" bind:this={ui.listEl} onscroll={ui.handleListScroll}>
  {#if stagedFiles.length === 0}
    <div class="empty">沒有待審查的圖片</div>
  {:else}
    <div class="scroll-content" style="height:{ui.totalH}px">
      {#each ui.visible as item (item.filename)}
        <button
          type="button"
          class="item"
          class:active={item.filename === currentFile}
          class:selected={selectedFiles.has(item.filename)}
          style="top:{item.index * ui.ITEM_H}px"
          onclick={(e) => ui.handleItemClick(e, item.filename)}
        >
          <img src={imgSrc(item.filename, "sm")} alt={item.filename} loading="lazy" />
          <span class="name">{item.filename}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<footer>
  <TaggerUpload />
</footer>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--border);
  }

  footer {
    padding: 0.625rem 0.75rem;
    border-top: 1px solid var(--border);
  }

  .title {
    display: flex;
    align-items: center;
    gap: 0.5rem;

    & > h1 {
      font-size: 0.8125rem;
      font-weight: 600;
      color: var(--text-muted);
    }
  }

  .list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .scroll-content {
    position: relative;
  }

  .item {
    position: absolute;
    left: 0;
    height: 72px;
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

    &:hover {
      background: var(--bg-hover);
    }

    &.selected {
      background: var(--bg-active);
      border-left-color: var(--text-dim);
    }

    &.active {
      background: var(--bg-active);
      border-left-color: var(--accent);
    }

    & img {
      width: auto;
      height: 60px;
      max-width: 80px;
      object-fit: cover;
      border-radius: 4px;
      background: var(--bg);
      flex-shrink: 0;
    }
  }

  .name {
    flex: 1;
    font-size: 0.6875rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    font-size: 0.875rem;
    color: var(--text-dim);
  }
</style>
