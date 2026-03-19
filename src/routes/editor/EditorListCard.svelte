<script lang="ts">
  import SelectCheckbox from "$lib/components/SelectCheckbox.svelte";
  import { imgSrc } from "$lib/client/api";
  import { blurhashStyle } from "$lib/client/blurhash";
  import type { ImageWithId } from "$lib/types.js";

  type Props = {
    image: ImageWithId;
    selected: boolean;
    onclick: () => void;
    onclickCheckbox: () => void;
  };

  let { image, selected, onclick, onclickCheckbox }: Props = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="card select-checkbox-host" class:selected {onclick}>
  <img
    class="card-thumb"
    src={imgSrc("committed", `${image.id}${image.ext}`, "sm")}
    style={blurhashStyle({ fit: "cover", blurhash: image.blurhash })}
    alt={image.name || image.id}
    loading="lazy"
  />

  <div class="card-info">
    <div class="card-name ellipsis">{image.name || image.id + image.ext}</div>

    <div class="card-meta ellipsis">
      {image.id}
      {#if image.rating}
        <span class="card-rating">{"★".repeat(image.rating)}</span>
      {/if}
    </div>

    {#if image.tags.length > 0}
      <div class="card-tags ellipsis">
        {image.tags.slice(0, 4).join(", ")}{image.tags.length > 4 ? ` +${image.tags.length - 4}` : ""}
      </div>
    {/if}
  </div>

  <div class="card-checkbox" class:visible={selected}>
    <SelectCheckbox checked={selected} size="sm" onchange={onclickCheckbox} />
  </div>
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
  }

  .card-meta {
    font-size: 0.6875rem;
    color: var(--text-dim);
    font-family: var(--font-mono);
    margin-top: 0.125rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .card-rating {
    color: var(--text-muted);
    font-family: var(--font);
    font-size: 0.625rem;
    letter-spacing: -0.05em;
  }

  .card-tags {
    font-size: 0.6875rem;
    color: var(--text-muted);
    margin-top: 0.125rem;
  }

  .card-checkbox {
    position: absolute;
    bottom: 0.375rem;
    right: 0.375rem;
    opacity: 0;
    transform: scale(0.8);
    will-change: opacity, transform;
    contain: layout style;
    transition:
      opacity 0.18s ease,
      transform 0.18s ease;
  }

  .card-checkbox.visible,
  .card:hover .card-checkbox {
    opacity: 1;
    transform: scale(1);
  }
</style>
