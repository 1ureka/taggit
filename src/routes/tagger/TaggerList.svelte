<script lang="ts">
  import { IconRefresh, IconUpload } from "@tabler/icons-svelte";
  import { TaggerListSelect, TaggerListActions, TaggerListVirtual } from "./taggerList.svelte.js";
  import TaggerListItem from "./TaggerListItem.svelte";

  type Props = {
    stagedFiles: string[];
    currentFile: string | null;
    selectedFiles: Set<string>;
  };

  let { stagedFiles, currentFile = $bindable(), selectedFiles = $bindable() }: Props = $props();

  const selectList = new TaggerListSelect({
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

  const virtualList = new TaggerListVirtual({
    get stagedFiles() {
      return stagedFiles;
    },
    get currentFile() {
      return currentFile;
    },
  });

  const actions = new TaggerListActions();
</script>

<svelte:window onkeydown={selectList.handleWindowKeydown} />

<header>
  <div class="title">
    <h1>待審查列表</h1>
    <span class="badge">{selectList.badgeLabel}</span>
  </div>

  <button
    class="btn btn-icon"
    title="重新掃描待審查資料夾"
    onclick={actions.handleRefreshClick}
    disabled={actions.pending}
  >
    <IconRefresh size={14} />
  </button>
</header>

<div class="list" bind:this={virtualList.listEl} onscroll={virtualList.handleListScroll}>
  {#if stagedFiles.length === 0}
    <div class="list-empty">沒有待審查的圖片</div>
  {:else}
    <div class="list-content" style="height:{virtualList.listTotalHeight}px">
      {#each virtualList.listVisibleItems as item (item.filename)}
        <TaggerListItem
          filename={item.filename}
          active={item.filename === currentFile}
          selected={selectedFiles.has(item.filename)}
          style="top:{item.top}px; height:{item.height}px"
          onclick={(e) => selectList.handleItemClick(e, item.filename)}
        />
      {/each}
    </div>
  {/if}
</div>

<footer>
  <label class="btn" class:pending={actions.pending}>
    {#if actions.pending}
      操作中...
    {:else}
      <IconUpload size={14} />
      加入圖片
    {/if}

    <input
      type="file"
      accept="image/*"
      multiple
      class="visually-hidden"
      onchange={actions.handleUploadChange}
      disabled={actions.pending}
    />
  </label>
</footer>

<style>
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    border-bottom: 1px solid var(--border);

    & > .title {
      display: flex;
      align-items: center;
      gap: 0.5rem;

      & > h1 {
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--text-muted);
      }
    }

    & > button {
      padding: 0.125rem;

      &:disabled > :global(svg) {
        animation: spin 0.8s linear infinite;
      }
    }
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  footer {
    padding: 0.625rem 0.75rem;
    border-top: 1px solid var(--border);

    & > label.btn {
      width: 100%;

      &.pending {
        opacity: 0.5;
        pointer-events: none;
      }
    }
  }

  .list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;

    & > .list-content {
      position: relative;
    }

    & > .list-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      font-size: 0.875rem;
      color: var(--text-dim);
    }
  }
</style>
