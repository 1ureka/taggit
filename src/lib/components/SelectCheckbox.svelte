<!--
  SelectCheckbox — shared checkbox for image card selection.
  Always present in the DOM; controlled via CSS opacity + scale transitions.
  Appears on parent hover or when checked.

  Sizes: "sm" (20px), "md" (24px), "lg" (28px)

  Usage:
    Wrap the card in a container with class `select-checkbox-host`
    so that the checkbox can respond to the parent's :hover.
-->
<script lang="ts">
  import { IconCheck } from "@tabler/icons-svelte";

  let {
    checked = false,
    size = "md",
    onchange,
  }: {
    checked?: boolean;
    size?: "sm" | "md" | "lg";
    onchange?: (checked: boolean) => void;
  } = $props();

  const iconSize = $derived(size === "sm" ? 12 : size === "md" ? 14 : 16);

  function handleClick(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    onchange?.(!checked);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="select-checkbox select-checkbox-{size}"
  class:select-checkbox-checked={checked}
  onclick={handleClick}
  role="checkbox"
  aria-checked={checked}
  tabindex="-1"
>
  {#if checked}
    <IconCheck size={iconSize} stroke-width={3} />
  {/if}
</div>

<style>
  .select-checkbox {
    position: absolute;
    bottom: 0.375rem;
    right: 0.375rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    border: 2px solid var(--border-hover);
    background: rgba(0, 0, 0, 0.45);
    color: var(--text);
    cursor: pointer;
    opacity: 0;
    transform: scale(0.8);
    transition:
      opacity 0.18s ease,
      transform 0.18s ease,
      background 0.15s,
      border-color 0.15s;
    z-index: 2;
    pointer-events: auto;
  }

  /* Show on parent hover */
  :global(.select-checkbox-host):hover .select-checkbox {
    opacity: 1;
    transform: scale(1);
  }

  /* Always show when checked */
  .select-checkbox-checked {
    opacity: 1 !important;
    transform: scale(1) !important;
    background: var(--accent);
    border-color: var(--accent);
    color: #000;
  }

  .select-checkbox:hover {
    border-color: var(--text-muted);
  }

  .select-checkbox-checked:hover {
    background: #e5e5e5;
    border-color: #e5e5e5;
  }

  /* Size variants */
  .select-checkbox-sm {
    width: 20px;
    height: 20px;
  }

  .select-checkbox-md {
    width: 24px;
    height: 24px;
  }

  .select-checkbox-lg {
    width: 28px;
    height: 28px;
  }
</style>
