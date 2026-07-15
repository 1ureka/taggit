<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import ImageCanvas from "$lib/components/display/ImageCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";

  const photos = [
    { src: "https://picsum.photos/seed/svelte-workbench-canvas-1/1600/1000", alt: "Landscape photo 1" },
    { src: "https://picsum.photos/seed/svelte-workbench-canvas-2/1600/1000", alt: "Landscape photo 2" },
    { src: "https://picsum.photos/seed/svelte-workbench-canvas-3/1600/1000", alt: "Landscape photo 3" },
  ];

  let index = $state(0);
</script>

<svelte:head>
  <title>ImageCanvas</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <ImageCanvas
        resetKey={photos[index].src}
        style="height: 20rem; border: var(--border-style); border-radius: calc(var(--border-radius) * 1.5);"
      >
        <img src={photos[index].src} alt={photos[index].alt} draggable="false" />
      </ImageCanvas>

      <div class="row">
        {#each photos as photo, i (photo.src)}
          <Button variant={i === index ? "primary" : "outlined"} padding="sm" onclick={() => (index = i)}>
            Photo {i + 1}
          </Button>
        {/each}
      </div>
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="ImageCanvas"
  label="Zoom, pan, any content"
  guide="Scroll or `+`/`-` to zoom toward the pointer, drag or the arrow keys to pan. Double-click, [[Esc]], [[Enter]] or [[Space]] resets the lens — switching photos does too."
  {preview}
/>

<style>
  .container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 32rem;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
</style>
