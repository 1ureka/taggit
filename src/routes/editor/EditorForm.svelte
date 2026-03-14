<script lang="ts">
  import { IconSearch } from "@tabler/icons-svelte";
  import FilterBar from "$lib/components/FilterBar.svelte";
  import { EditorForm } from "./editorForm.svelte.js";

  const ui = new EditorForm();
</script>

<div class="form">
  <div class="search-container">
    <span class="search-adornment">
      <IconSearch size={16} />
    </span>
    <input
      class="text-input search-input"
      bind:value={ui.search}
      placeholder="搜尋檔名..."
      oninput={ui.handleSearchInput}
      autocomplete="off"
    />
  </div>
  <div class="filter-container">
    <FilterBar
      bind:selectedTags={ui.selectedTags}
      bind:rating={ui.rating}
      bind:ratingOp={ui.ratingOp}
      bind:sort={ui.sort}
      bind:order={ui.order}
      onchange={ui.handleFilterChange}
    />
  </div>
</div>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    margin-bottom: 1rem;
  }

  .search-container {
    position: relative;
    display: flex;
    align-items: center;

    & > .search-adornment {
      position: absolute;
      left: 0.75rem;
      display: flex;
      align-items: center;
      color: var(--text-dim);
      pointer-events: none;
    }

    & > .search-input {
      padding-left: 2.375rem;
      font-size: 0.875rem;
      padding-top: 0.5rem;
      padding-bottom: 0.5rem;
    }
  }

  .filter-container {
    width: 100%;
  }
</style>
