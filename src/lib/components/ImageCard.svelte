<script lang="ts">
  import type { ImageWithId } from "$lib/types.js";

  let {
    image,
    onclick,
  }: {
    image: ImageWithId;
    onclick?: () => void;
  } = $props();

  const src = $derived(`/img/committed/${image.id}${image.ext}`);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="image-card"
  {onclick}
  style="
    position: relative;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
    cursor: {onclick ? 'pointer' : 'default'};
    transition: border-color 0.15s;
  "
>
  <img
    {src}
    alt={image.originalName}
    loading="lazy"
    style="
      display: block;
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
    "
  />
  <div
    style="
      padding: 0.5rem;
      font-size: 0.75rem;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      align-items: center;
    "
  >
    <span>{image.tags.length} tags</span>
    <span>{"★".repeat(image.rating)}{"☆".repeat(5 - image.rating)}</span>
  </div>
</div>

<style>
  .image-card:hover {
    border-color: var(--border-hover);
  }
</style>
