<script lang="ts">
  import { imgSrc } from "$lib/image/client";
  import { IconMaximize } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import ImageCanvas from "$lib/components/display/ImageCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import { getPointersContext } from "../logic2/pointers.svelte";

  const pointers = getPointersContext();

  const file = $derived(pointers.editing?.id ?? null);
</script>

{#if file !== null}
  <div>
    <ImageCanvas resetKey={file} style="height: 220px; min-height: 220px; border-bottom: var(--border-style);">
      <img src={imgSrc(file, "sm")} alt={file} draggable="false" />
    </ImageCanvas>
    <Button
      variant="outlined"
      padding="icon"
      aria-label="全螢幕預覽"
      onclick={() => pointers.handleLightboxOpen()}
      {@attach tooltip({ content: "全螢幕預覽" })}
      style="position: absolute; right: 0.5rem; bottom: 0.5rem;"
    >
      <IconMaximize size={16} />
    </Button>
  </div>
{/if}

<style>
  div {
    position: relative;
    flex-shrink: 0;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
</style>
