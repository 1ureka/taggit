<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
</script>

<svelte:head>
  <title>Tooltip — Pinned while scrolling</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <span>Scroll me ↓</span>
      <div>
        <span>
          <Button variant="primary" {@attach tooltip({ content: "I follow my anchor", placement: "right" })}>
            Hover me, then scroll
          </Button>
        </span>
      </div>
      <span>↑ Scroll me</span>
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="Tooltip"
  label="Pinned while scrolling"
  guide="Hover a button, then scroll inside the box. The tooltip stays pinned to its anchor with a _spring_ follow."
  {preview}
/>

<style>
  .container {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    width: 100%;
    height: 10rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    border: var(--border-style);
    border-radius: var(--border-radius);
    padding: 0.75rem;
  }

  .container > span {
    display: grid;
    place-items: center;
    min-height: 16rem;
    color: var(--color-text-muted);
    font: var(--font-body2);
  }

  .container > div {
    display: grid;
    place-items: center;
    min-height: 16rem;
    padding: 1rem 0;

    & > span {
      display: grid;
      place-items: stretch;
      height: 8rem;
    }
  }
</style>
