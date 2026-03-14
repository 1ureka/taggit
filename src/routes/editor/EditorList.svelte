<script lang="ts">
  import EditorListCard from "./EditorListCard.svelte";
  import { navigating } from "$app/state";
  import { EditorList } from "./editorList.svelte.js";
  import type { ImageWithId } from "$lib/types.js";

  type Props = {
    items: ImageWithId[];
    total: number;
    page: number;
    pages: number;
    selected: Set<string>;
  };

  let { items, total, page, pages, selected = $bindable() }: Props = $props();

  const ui = new EditorList({
    get items() {
      return items;
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

{#if items.length === 0}
  <div class="empty">找不到符合的圖片</div>
{:else}
  <div class="list-grid" class:loading={navigating.to}>
    {#each items as image (image.id)}
      <EditorListCard
        {image}
        selected={selected.has(image.id)}
        onclick={() => ui.handleCardClick(image.id)}
        onclickCheckbox={() => ui.handleCheckboxChange(image.id)}
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
