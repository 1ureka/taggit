<script lang="ts">
  import SelectCheckbox from "$lib/components/SelectCheckbox.svelte";
  import { imgSrc } from "$lib/client/api.js";
  import { blurhashStyle } from "$lib/client/blurhash.js";

  type Props = {
    filename: string;
    selected: boolean;
    onclick: () => void;
    onclickCheckbox: () => void;
  };

  let { filename, selected, onclick, onclickCheckbox }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="card select-checkbox-host" class:selected {onclick}>
  <img class="card-thumb" src={imgSrc("trash", filename, "sm")} style={blurhashStyle()} alt={filename} loading="lazy" />

  <div class="card-info">
    <div class="card-name">{filename}</div>
  </div>

  <SelectCheckbox checked={selected} size="sm" onchange={onclickCheckbox} />
</div>

<style>
  .card {
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

    &:hover {
      background: var(--bg-hover);
      border-color: var(--border-hover);
    }

    &.selected {
      border-color: var(--accent);
      background: var(--bg-hover);

      &:hover {
        border-color: var(--accent);
      }
    }
  }

  .card-thumb {
    width: 56px;
    height: 56px;
    object-fit: cover;
    border-radius: 4px;
    background: var(--bg);
    flex-shrink: 0;
  }

  .card-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .card-name {
    font-size: 0.8125rem;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
