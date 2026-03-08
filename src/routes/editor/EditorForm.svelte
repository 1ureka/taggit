<script lang="ts">
  import { IconSearch } from "@tabler/icons-svelte";
  import FilterBar from "$lib/components/FilterBar.svelte";
  import { getEditorContext } from "./context.svelte.js";
  import { createEditorForm } from "./editorForm.svelte.js";

  const ctx = getEditorContext();
  const ui = createEditorForm();
</script>

<div class="editor-form">
  <div class="search-input-wrap">
    <span class="search-adornment">
      <IconSearch size={16} />
    </span>
    <input
      class="text-input search-input"
      bind:value={ctx.searchText}
      placeholder="搜尋檔名..."
      oninput={ui.handleSearchInput}
      autocomplete="off"
    />
  </div>
  <div class="editor-filters">
    <FilterBar
      bind:selectedTags={ctx.selectedTags}
      bind:rating={ctx.rating}
      bind:ratingOp={ctx.ratingOp}
      bind:sort={ctx.sort}
      bind:order={ctx.order}
      onchange={ui.handleFilterChange}
    />
  </div>
</div>

<style>
  .editor-form {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    margin-bottom: 1rem;
  }

  .search-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-adornment {
    position: absolute;
    left: 0.75rem;
    display: flex;
    align-items: center;
    color: var(--text-dim);
    pointer-events: none;
  }

  .search-input {
    padding-left: 2.375rem;
    font-size: 0.875rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  }

  .editor-filters {
    width: 100%;
  }
</style>
