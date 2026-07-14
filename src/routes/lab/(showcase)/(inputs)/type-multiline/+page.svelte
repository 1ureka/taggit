<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import TextInput from "$lib/components/inputs/TextInput.svelte";

  const textareaProps = { multiline: true, minRows: 3, maxRows: 6 } as const;

  // TODO: 換文案
  const disabledValue =
    "This is a disabled textarea.\n\nIt can contain multiple lines of text to demonstrate the multiline functionality.";
</script>

<svelte:head>
  <title>Text field — Multiple lines</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <h4>Default</h4>
      <TextInput {...textareaProps} label="Label" placeholder="Enter text..." />
      <TextInput {...textareaProps} variant="filled" label="Label" placeholder="Enter text..." />

      <h4>Disabled</h4>
      <TextInput {...textareaProps} label="Label" status="disabled" value={disabledValue} placeholder="Enter text..." />
      <TextInput
        {...textareaProps}
        variant="filled"
        label="Label"
        status="disabled"
        value={disabledValue}
        placeholder="Enter text..."
      />

      <h4>Error</h4>
      <TextInput {...textareaProps} label="Label" status="error" placeholder="Enter text..." />
      <TextInput {...textareaProps} variant="filled" label="Label" status="error" placeholder="Enter text..." />
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout component="Text field" label="Multiple lines" {preview} />

<style>
  .container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem 1.5rem;
    width: 100%;
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
</style>
