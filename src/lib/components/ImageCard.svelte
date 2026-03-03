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
<div class="image-card" class:image-card-clickable={!!onclick} {onclick}>
  <img {src} alt={image.originalName} loading="lazy" />
  <div class="image-card-footer">
    <span>{image.tags.length} tags</span>
    <span>{"★".repeat(image.rating)}{"☆".repeat(5 - image.rating)}</span>
  </div>
</div>

<style>
  @import "../styles/ImageCard.css";
</style>
