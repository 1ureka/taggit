<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import TextInput from "$lib/components/inputs/TextInput.svelte";

  const id = $props.id();
</script>

<svelte:head>
  <title>Text field — Outlined & filled</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <h4>Default</h4>
      <TextInput label="Label" placeholder="Enter text..." />
      <TextInput variant="filled" label="Label" placeholder="Enter text..." />

      <h4>Disabled</h4>
      <TextInput label="Label" status="disabled" value="Disabled value" placeholder="Enter text..." />
      <TextInput variant="filled" label="Label" status="disabled" value="Disabled value" placeholder="Enter text..." />

      <h4>Error</h4>
      <TextInput label="Label" status="error" placeholder="Enter text..." />
      <TextInput variant="filled" label="Label" status="error" placeholder="Enter text..." />

      <h4>Helper Text</h4>
      <div>
        <TextInput variant="filled" label="Label" placeholder="Enter text..." aria-describedby="{id}-helper-text" />
        <span id="{id}-helper-text">Helper text goes here</span>
      </div>
      <div>
        <TextInput label="Label" status="error" placeholder="Enter text..." aria-describedby="{id}-error" />
        <span id="{id}-error" class="error">Helper text goes here</span>
      </div>
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="Text field"
  label="Outlined & filled"
  guide="_Outlined_ when the field needs definition, _filled_ when it settles into the surface."
  {preview}
/>

<style>
  .container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem 1.5rem;
  }

  h4 {
    grid-column: span 2;
    font: var(--font-body1);
    color: var(--color-text-muted);

    &:not(:first-child) {
      margin-top: 1rem;
    }
  }

  div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  span {
    font: var(--font-caption);
    color: var(--color-text-muted);
    &.error {
      color: var(--color-error);
    }
  }
</style>
