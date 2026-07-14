<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import ButtonConfirm from "$lib/components/actions/ButtonConfirm.svelte";
  import { IconCheck, IconX } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";

  const tooltipOptions = {
    top: { content: "Hold to confirm", placement: "top" },
    bottom: { content: "Hold to confirm", placement: "bottom" },
  } as const;

  let timer: NodeJS.Timeout;

  $effect(() => {
    return () => {
      clearTimeout(timer);
    };
  });

  let pending = $state(false);

  const handleConfirm = () => {
    pending = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      pending = false;
    }, 1000);
  };

  const status = $derived(pending ? "pending" : undefined);
</script>

<svelte:head>
  <title>Button — Press and hold</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <section>
        <h4>Default</h4>
        <div>
          <ButtonConfirm variant="primary" onconfirm={handleConfirm} {status} {@attach tooltip(tooltipOptions.top)}>
            Primary</ButtonConfirm
          >
          <ButtonConfirm onconfirm={handleConfirm} {status} {@attach tooltip(tooltipOptions.top)}
            >Outlined</ButtonConfirm
          >
          <ButtonConfirm variant="ghost" onconfirm={handleConfirm} {status} {@attach tooltip(tooltipOptions.top)}
            >Ghost</ButtonConfirm
          >
          <ButtonConfirm variant="destructive" onconfirm={handleConfirm} {status} {@attach tooltip(tooltipOptions.top)}
            >Destructive</ButtonConfirm
          >
        </div>
      </section>

      <section style="justify-self: stretch;">
        <h4>Custom</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr;">
          <ButtonConfirm variant="primary" onconfirm={handleConfirm} {status} {@attach tooltip(tooltipOptions.bottom)}>
            <IconCheck size={16} />
            <span style="flex: 1;">Save</span>
          </ButtonConfirm>
          <ButtonConfirm
            variant="destructive"
            onconfirm={handleConfirm}
            {status}
            {@attach tooltip(tooltipOptions.bottom)}
          >
            <IconX size={16} />
            <span style="flex: 1;">Delete</span>
          </ButtonConfirm>
        </div>
      </section>
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="Button"
  label="Press and hold"
  guide="When action demands intent, a _long press_ provides a moment of deliberation to prevent accidental actions."
  {preview}
/>

<style>
  .container {
    display: grid;
    justify-content: center;
    gap: 1.5rem;
  }

  section {
    display: flex;
    flex-direction: column;
    justify-content: stretch;
    gap: 0.5rem;
  }

  section > h4 {
    font: var(--font-body1);
    color: var(--color-text-muted);
  }

  section > div {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
</style>
