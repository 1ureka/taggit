<script lang="ts">
  import { TooltipState } from "$lib/components/floating/tooltip.core.svelte";
  import Popover from "$lib/components/floating/Popover.svelte";

  const tooltip = new TooltipState();
</script>

<Popover
  open={tooltip.open}
  reference={tooltip.anchor ?? undefined}
  placement={tooltip.placement ?? "bottom"}
  offset={10}
  arrow
  arrowColor="var(--color-text)"
>
  <div aria-hidden="true">
    {#if typeof tooltip.content === "string"}
      {tooltip.content}
    {:else}
      {@render tooltip.content?.()}
    {/if}
  </div>
</Popover>

<style>
  div {
    padding: 0.25rem 0.5rem;
    font: var(--font-body2);
    font-weight: 600;
    border-radius: var(--border-radius);
    background-color: var(--color-text);
    color: var(--color-bg);
  }
</style>
