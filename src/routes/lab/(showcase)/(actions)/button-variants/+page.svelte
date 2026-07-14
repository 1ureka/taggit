<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";

  let pending = $state<Record<string, boolean>>({});
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  $effect(() => {
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  });

  const handleClick = (key: string) => () => {
    pending = { ...pending, [key]: true };
    if (timers.has(key)) clearTimeout(timers.get(key));
    const timer = setTimeout(() => {
      pending = { ...pending, [key]: false };
    }, 1000);
    timers.set(key, timer);
  };

  const statusOf = (key: string) => (pending[key] ? "pending" : undefined);
</script>

<svelte:head>
  <title>Button — Variants</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <section>
        <h4>Default</h4>
        <div>
          <Button variant="primary" status={statusOf("primary")} onclick={handleClick("primary")}>Primary</Button>
          <Button status={statusOf("outlined")} onclick={handleClick("outlined")}>Outlined</Button>
          <Button variant="ghost" status={statusOf("ghost")} onclick={handleClick("ghost")}>Ghost</Button>
          <Button variant="destructive" status={statusOf("destructive")} onclick={handleClick("destructive")}
            >Destructive</Button
          >
        </div>
      </section>

      <section>
        <h4>Disabled</h4>
        <div>
          <Button variant="primary" status="disabled">Primary</Button>
          <Button status="disabled">Outlined</Button>
          <Button variant="ghost" status="disabled">Ghost</Button>
          <Button variant="destructive" status="disabled">Destructive</Button>
        </div>
      </section>

      <section>
        <h4>Loading</h4>
        <div>
          <Button variant="primary" status="pending">Primary</Button>
          <Button status="pending">Outlined</Button>
          <Button variant="ghost" status="pending">Ghost</Button>
          <Button variant="destructive" status="pending">Destructive</Button>
        </div>
      </section>
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="Button"
  label="Variants"
  guide="_Heavier_ when the action matters, _quieter_ when it's secondary, **red** when it can't be undone."
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
