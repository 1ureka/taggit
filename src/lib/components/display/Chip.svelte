<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { IconX } from "$lib/icons";

  type Props = HTMLAttributes<HTMLElement> & {
    variant?: "filled" | "outlined";
    status?: "default" | "disabled";
    removable?: boolean;
    children: Snippet;
  };

  let { variant = "filled", status = "default", removable = false, onclick, children, ...rest }: Props = $props();
</script>

{#if onclick}
  <button
    type="button"
    class={{ chip: true, removable, filled: variant === "filled", outlined: variant === "outlined" }}
    disabled={status === "disabled"}
    {onclick}
    {...rest}
  >
    {@render children()}
    {#if removable}
      <span class="remove-icon" aria-hidden="true"><IconX size="0.75rem" /></span>
      <span class="sr-only">, remove</span>
    {/if}
  </button>
{:else}
  <div
    class={{ chip: true, filled: variant === "filled", outlined: variant === "outlined" }}
    aria-disabled={status === "disabled"}
    {...rest}
  >
    {@render children()}
  </div>
{/if}

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    max-width: 100%;
    padding: 0.1875rem 0.625rem;
    font: var(--font-body2);
    border: var(--border-style);
    border-radius: 9999px;

    &.filled {
      color: hsl(from var(--color-text) h s l / 0.8);
      background: var(--color-bg-active);
      border-color: transparent;
    }

    &.outlined {
      color: hsl(from var(--color-text) h s l / 0.8);
      background: transparent;
      border-color: var(--color-border);
    }
  }

  div.chip[aria-disabled="true"] {
    opacity: 0.5;
    pointer-events: none;
  }

  /* --- */

  button.chip {
    appearance: none;
    font-family: inherit;
    cursor: pointer;
    user-select: none;
    will-change: transform;
    transition: all 0.15s ease;

    &:active {
      transition: all 0.03s ease;
      transform: scale(0.97);
    }

    &:disabled {
      opacity: 0.5;
      pointer-events: none;
    }
  }

  button.chip.filled {
    &:not(.removable):hover {
      background-color: var(--color-bg-hover);
    }

    &.removable:hover {
      color: var(--color-error);
      background: hsl(from var(--color-error) h s l / 0.25);
      border-color: transparent;
    }
  }

  button.chip.outlined {
    &:not(.removable):hover {
      background-color: var(--color-bg-hover);
      border-color: var(--color-border-hover);
    }

    &.removable:hover {
      color: var(--color-error);
      border-color: var(--color-error);
    }
  }

  /* --- */

  button.chip.removable {
    & > .remove-icon {
      display: inline-flex;
      flex-shrink: 0;
      opacity: 0.6;
      transition: opacity 0.15s ease;
    }

    &:hover > .remove-icon,
    &:focus-visible > .remove-icon {
      opacity: 1;
    }
  }
</style>
