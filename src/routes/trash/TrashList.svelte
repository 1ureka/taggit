<script lang="ts">
  import { navigating } from "$app/state";
  import { TrashList } from "./trashList.svelte.js";
  import TrashListCard from "./TrashListCard.svelte";

  type Props = {
    files: string[];
    total: number;
    page: number;
    pages: number;
    selected: Set<string>;
  };

  let { files, total, page, pages, selected = $bindable() }: Props = $props();

  const ui = new TrashList({
    get files() {
      return files;
    },
    get selected() {
      return selected;
    },
    set selected(v) {
      selected = v;
    },
  });
</script>

<svelte:window onkeydown={ui.handleWindowKeydown} />

{#if total > 0}
  <div class="list-info">
    <span>{total} 張圖片</span>
    {#if pages > 1}
      <span class="list-info-page">
        第 {page} / {pages} 頁
      </span>
    {/if}
  </div>
{/if}

{#if files.length === 0}
  <div class="empty">垃圾桶是空的</div>
{:else}
  <div class="list-grid" class:loading={navigating.to}>
    {#each files as filename (filename)}
      <TrashListCard
        {filename}
        selected={selected.has(filename)}
        onclick={() => ui.handleCardClick(filename)}
        onclickCheckbox={() => ui.handleCheckboxChange(filename)}
      />
    {/each}
  </div>
{/if}

<style>
  .list-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-dim);
    margin-bottom: 0.75rem;

    & > .list-info-page {
      font-family: var(--font-mono);
    }
  }

  .list-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;

    transition: opacity 0s step-start;

    &.loading {
      opacity: 0.4;
      transition: opacity 0.2s step-end;
    }
  }

  .empty {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.875rem;
    padding: 2rem 0;
  }
</style>
