<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import BlurImage from "$lib/widgets/BlurImage.svelte";

  // 展示用的示意 blurhash（實際專案由後端為每張圖片計算）
  const photos = [
    {
      src: "https://picsum.photos/seed/taggit-blur-1/1600/1000",
      alt: "Sample photo 1",
      preview: { blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj", width: 1600, height: 1000 },
    },
    {
      src: "https://picsum.photos/seed/taggit-blur-2/1600/1000",
      alt: "Sample photo 2",
      preview: { blurhash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH", width: 1600, height: 1000 },
    },
    {
      src: "https://picsum.photos/seed/taggit-blur-3/1600/1000",
      alt: "Sample photo 3",
      preview: { blurhash: "L6PZfSi_.AyE_3t7t7R**0o#DgR4", width: 1600, height: 1000 },
    },
  ];

  let index = $state(0);
  let withPreview = $state(true);

  const current = $derived(photos[index]);
</script>

<svelte:head>
  <title>BlurImage</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <div class="frame">
        <BlurImage
          src={current.src}
          alt={current.alt}
          fit="cover"
          preview={withPreview ? current.preview : undefined}
          draggable="false"
        />
      </div>

      <div class="row">
        {#each photos as photo, i (photo.src)}
          <Button variant={i === index ? "primary" : "outlined"} padding="sm" onclick={() => (index = i)}>
            Photo {i + 1}
          </Button>
        {/each}

        <Button
          variant={withPreview ? "outlined" : "ghost"}
          padding="sm"
          style="margin-left: auto;"
          onclick={() => (withPreview = !withPreview)}
        >
          blurhash: {withPreview ? "on" : "off"}
        </Button>
      </div>
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="BlurImage"
  label="Blurhash placeholder"
  guide="A plain `<img>` layer. With a `preview`, switching `src` remounts the element so the blurhash placeholder is visible while the new image loads. Without one, it keeps the previous frame and only dims after 0.2s — fast switches never flash."
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

  .frame {
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 1.5);
    overflow: hidden;

    & > :global(img) {
      width: 100%;
      aspect-ratio: 16 / 10;
    }
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
