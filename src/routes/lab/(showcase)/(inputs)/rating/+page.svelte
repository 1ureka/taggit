<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";

  let sizeMdValue = $state(3);
  let sizeSmValue = $state(3);
  let maxValue = $state(6);
  let disabledValue = $state(2);
</script>

<svelte:head>
  <title>Rating</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <h4>Sizes</h4>
      <div class="row">
        <Rating bind:value={sizeMdValue} />
        <span class="value">{sizeMdValue} / 5</span>
      </div>
      <div class="row">
        <Rating bind:value={sizeSmValue} size="sm" />
        <span class="value">{sizeSmValue} / 5</span>
      </div>

      <h4>Custom max</h4>
      <div class="row">
        <Rating bind:value={maxValue} max={10} />
        <span class="value">{maxValue} / 10</span>
      </div>

      <h4>Readonly</h4>
      <div class="row">
        <Rating value={4} readonly />
        <span class="value">4 / 5, display only</span>
      </div>

      <h4>Disabled</h4>
      <div class="row">
        <Rating bind:value={disabledValue} status="disabled" />
        <span class="value">Not interactive</span>
      </div>
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="Rating"
  label="Stars"
  guide="Hover to preview a score, click the current star to clear it. Keyboard: [[←/→]] step by one, [[0-9]] jump to a score, [[Home]]/[[End]] to the ends."
  {preview}
/>

<style>
  .container {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    max-width: 20rem;
  }

  h4 {
    font: var(--font-body1);
    color: var(--color-text-muted);

    &:not(:first-child) {
      margin-top: 0.5rem;
    }
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .value {
    font: var(--font-caption);
    color: var(--color-text-muted);
  }
</style>
