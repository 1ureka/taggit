<script lang="ts">
  import { blurhashStyle } from "$lib/client/blurhash.js";
  import SelectCheckbox from "$lib/components/SelectCheckbox.svelte";
  import { getEditorContext } from "./context.svelte.js";
  import { createEditorList } from "./editorList.svelte.js";

  const ctx = getEditorContext();
  const ui = createEditorList();
</script>

<svelte:window onkeydown={ui.handleWindowKeydown} />

{#if ctx.total > 0}
  <div class="editor-list-info">
    <span>{ctx.total} 張圖片</span>
    {#if ctx.pages > 1}
      <span class="editor-list-pager">
        第 {ctx.page} / {ctx.pages} 頁
      </span>
    {/if}
  </div>
{/if}

{#if ctx.showLoading}
  <div class="editor-list-status">搜尋中...</div>
{:else if ctx.items.length === 0}
  <div class="editor-list-status">找不到符合的圖片</div>
{:else}
  <div class="editor-list-results">
    {#each ctx.items as img (img.id)}
      {@const selected = ctx.selected.has(img.id)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="editor-list-card select-checkbox-host"
        class:editor-list-card-selected={selected}
        onclick={() => ui.handleCardClick(img.id)}
      >
        <img
          class="editor-list-card-thumb"
          src="/img/committed/{img.id}{img.ext}?size=sm"
          style={blurhashStyle({ fit: "cover", blurhash: img.blurhash })}
          alt={img.name || img.id}
          loading="lazy"
        />
        <div class="editor-list-card-info">
          <div class="editor-list-card-name">{img.name || img.id + img.ext}</div>
          <div class="editor-list-card-meta">
            {img.id}
            {#if img.rating}
              <span class="editor-list-card-rating">{"★".repeat(img.rating)}</span>
            {/if}
          </div>
          {#if img.tags.length > 0}
            <div class="editor-list-card-tags">
              {img.tags.slice(0, 4).join(", ")}{img.tags.length > 4 ? ` +${img.tags.length - 4}` : ""}
            </div>
          {/if}
        </div>
        <SelectCheckbox checked={selected} size="sm" onchange={() => ui.handleCheckboxChange(img.id)} />
      </div>
    {/each}
  </div>
{/if}

<style>
  .editor-list-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-dim);
    margin-bottom: 0.75rem;
  }

  .editor-list-pager {
    font-family: var(--font-mono);
  }

  .editor-list-status {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.875rem;
    padding: 2rem 0;
  }

  .editor-list-results {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
  }

  .editor-list-card {
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

  .editor-list-card:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }

  .editor-list-card-selected {
    border-color: var(--accent);
    background: var(--bg-hover);
  }

  .editor-list-card-selected:hover {
    border-color: var(--accent);
  }

  .editor-list-card-thumb {
    width: 56px;
    height: 56px;
    object-fit: cover;
    border-radius: 4px;
    background: var(--bg);
    flex-shrink: 0;
  }

  .editor-list-card-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .editor-list-card-name {
    font-size: 0.8125rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .editor-list-card-meta {
    font-size: 0.6875rem;
    color: var(--text-dim);
    font-family: var(--font-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 0.125rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .editor-list-card-rating {
    color: var(--text-muted);
    font-family: var(--font);
    font-size: 0.625rem;
    letter-spacing: -0.05em;
  }

  .editor-list-card-tags {
    font-size: 0.6875rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 0.125rem;
  }
</style>
