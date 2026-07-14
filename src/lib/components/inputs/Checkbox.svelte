<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  type Props = Omit<HTMLInputAttributes, "size"> & {
    checked?: boolean;
    indeterminate?: boolean;
    label?: string;
    status?: "default" | "error" | "disabled";
    size?: "sm" | "md";
    input?: HTMLInputElement;
  };

  let {
    checked = $bindable(false),
    indeterminate = $bindable(false),
    label,
    status = "default",
    size = "md",
    input = $bindable(),
    ...rest
  }: Props = $props();

  $effect(() => {
    if (input) input.indeterminate = indeterminate ?? false;
  });
</script>

<label class="checkbox {size} {status}">
  <span class="control">
    <input
      type="checkbox"
      bind:checked
      bind:this={input}
      disabled={status === "disabled"}
      aria-invalid={status === "error"}
      {...rest}
    />
    <span class="box" aria-hidden="true">
      <svg viewBox="0 0 16 16">
        <path class="check" d="M3.5 8.5L6.5 11.5L12.5 4.5" />
        <path class="dash" d="M4 8H12" />
      </svg>
    </span>
  </span>
  {#if label}<span class="text">{label}</span>{/if}
</label>

<style>
  .checkbox {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
    font: var(--font-body1);
    color: var(--color-text);

    &.disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    &.sm {
      --box-size: 1rem;
    }
    &.md {
      --box-size: 1.25rem;
    }
  }

  /* --- */

  input ~ .box {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    border: var(--border-style);
    border-radius: calc(var(--border-radius) / 1.5);
    background: transparent;
  }

  input ~ .box {
    will-change: transform;
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease,
      transform 0.15s ease;
  }

  .checkbox:active input ~ .box {
    transform: scale(0.95);
    transition:
      background-color 0.15s ease,
      border-color 0.15s ease,
      transform 0.03s ease;
  }

  /* --- */

  input:not(:checked) ~ .box {
    .checkbox:hover & {
      background: hsl(from var(--color-border-hover) h s l / 0.25);
      border-color: var(--color-border-hover);
    }

    .checkbox.error & {
      background: transparent;
      border-color: hsl(from var(--color-error) h s l / 0.5);
    }

    .checkbox.error:hover & {
      background: hsl(from var(--color-error) h s l / 0.25);
      border-color: hsl(from var(--color-error) h s l / 0.75);
    }
  }

  input:checked ~ .box,
  input:indeterminate ~ .box {
    background: var(--color-accent);
    border-color: var(--color-accent);

    .checkbox:hover & {
      background: hsl(from var(--color-accent) h s l / 0.7);
      border-color: transparent;
    }

    .checkbox.error & {
      background: var(--color-error);
      border-color: var(--color-error);
    }

    .checkbox.error:hover & {
      background: hsl(from var(--color-error) h s l / 0.7);
      border-color: transparent;
    }
  }

  /* --- */

  .control {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    width: var(--box-size);
    height: var(--box-size);
  }

  .control > input[type="checkbox"] {
    position: absolute;
    inset: 0;
    margin: 0;
    appearance: none;
    opacity: 0;
    cursor: pointer;
  }

  .control > input[type="checkbox"]:disabled {
    cursor: default;
  }

  /* --- */

  .box > svg {
    width: 75%;
    height: 75%;
    fill: none;
    stroke: var(--color-bg);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .box .check,
  .box .dash {
    stroke-dasharray: 20;
    stroke-dashoffset: 20;
    transition: stroke-dashoffset 0.35s ease;
  }

  input:checked:not(:indeterminate) ~ .box .check {
    stroke-dashoffset: 0;
  }

  input:indeterminate ~ .box .dash {
    stroke-dashoffset: 0;
  }

  /* --- */

  .text {
    font: inherit;
  }
</style>
