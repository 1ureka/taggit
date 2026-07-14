<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import { IconPuzzleFilled } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";

  const placements = [
    { key: "top-start", label: "TS", placement: "top-start" },
    { key: "top", label: "T", placement: "top" },
    { key: "top-end", label: "TE", placement: "top-end" },
    { key: "left", label: "L", placement: "left" },
    { key: "center", label: "", placement: null },
    { key: "right", label: "R", placement: "right" },
    { key: "bottom-start", label: "BS", placement: "bottom-start" },
    { key: "bottom", label: "B", placement: "bottom" },
    { key: "bottom-end", label: "BE", placement: "bottom-end" },
  ] as const;
</script>

<svelte:head>
  <title>Tooltip — Hover and focus</title>
</svelte:head>

{#snippet richContent()}
  <div class="rich">
    <IconPuzzleFilled size={18} />
    <span>Custom content</span>
  </div>
{/snippet}

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      {#each placements as { key, label, placement } (key)}
        <span>
          {#if placement}
            <Button variant="ghost" {@attach tooltip({ content: placement, placement })}>
              {label}
            </Button>
          {:else}
            <Button variant="ghost" {@attach tooltip({ content: richContent })}>Custom</Button>
          {/if}
        </span>
      {/each}
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="Tooltip"
  label="Hover and focus"
  guide="Hover or [[Tab]] across the buttons — a single tooltip flies between anchors instead of fading out and in."
  {preview}
/>

<style>
  .container {
    display: grid;
    grid-template-columns: repeat(3, minmax(3rem, 1fr));
    width: 100%;

    & > span {
      display: grid;
      place-items: stretch;
      height: 3rem;
    }
  }

  .rich {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font: var(--font-body1);
  }
</style>
