<script lang="ts">
  import SelectCheckbox from "$lib/components/SelectCheckbox.svelte";
  import { imgSrc } from "$lib/client/api.js";
  import { blurhashStyle } from "$lib/client/blurhash.js";
  import { getTrashContext } from "./context.svelte.js";
  import { createTrashList } from "./trashList.svelte.js";

  const ctx = getTrashContext();
  const ui = createTrashList();
</script>

<svelte:window onkeydown={ui.handleWindowKeydown} />

{#if ctx.total > 0}
  <div class="trash-list-info">
    <span>{ctx.total} 張圖片</span>
    {#if ctx.pages > 1}
      <span class="trash-list-pager">
        第 {ctx.page} / {ctx.pages} 頁
      </span>
    {/if}
  </div>
{/if}

{#if ctx.showLoading}
  <div class="trash-list-status">搜尋中...</div>
{:else if ctx.files.length === 0}
  <div class="trash-list-status">垃圾桶是空的</div>
{:else}
  <div class="trash-list-results">
    {#each ctx.files as filename (filename)}
      {@const selected = ctx.selected.has(filename)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="trash-card select-checkbox-host"
        class:trash-card-selected={selected}
        onclick={() => ui.handleCardClick(filename)}
      >
        <img
          class="trash-card-thumb"
          src={imgSrc("trash", filename, "sm")}
          style={blurhashStyle()}
          alt={filename}
          loading="lazy"
        />
        <div class="trash-card-info">
          <div class="trash-card-name">{filename}</div>
        </div>
        <SelectCheckbox checked={selected} size="sm" onchange={() => ui.handleCheckboxChange(filename)} />
      </div>
    {/each}
  </div>
{/if}

<style>
  .trash-list-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-dim);
    margin-bottom: 0.75rem;
  }

  .trash-list-pager {
    font-family: var(--font-mono);
  }

  .trash-list-status {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.875rem;
    padding: 2rem 0;
  }

  .trash-list-results {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
  }

  .trash-card {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
    text-align: left;
    color: inherit;
    font-family: inherit;
    width: 100%;
  }

  .trash-card:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }

  .trash-card-selected {
    border-color: var(--accent);
    background: var(--bg-hover);
  }

  .trash-card-selected:hover {
    border-color: var(--accent);
  }

  .trash-card-thumb {
    width: 56px;
    height: 56px;
    object-fit: cover;
    border-radius: 4px;
    background: var(--bg);
    flex-shrink: 0;
  }

  .trash-card-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .trash-card-name {
    font-size: 0.8125rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
