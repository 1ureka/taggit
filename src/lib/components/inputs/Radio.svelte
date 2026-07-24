<script lang="ts">
  import type { HTMLInputAttributes } from "svelte/elements";

  type Props = Omit<HTMLInputAttributes, "size" | "type" | "checked" | "onchange"> & {
    checked: boolean;
    variant?: "default" | "error";
    label?: string;
    status?: "default" | "disabled";
    size?: "sm" | "md";
    onchange?: (checked: boolean) => void;
  };

  let { checked, variant = "default", label, status = "default", size = "md", onchange, ...rest }: Props = $props();

  function handleChange(e: Event & { currentTarget: HTMLInputElement }) {
    onchange?.(e.currentTarget.checked);
  }
</script>

<label class="root {size} {variant} {status}">
  <span class="control">
    <input type="radio" {checked} disabled={status === "disabled"} onchange={handleChange} {...rest} />
    <span class="dot" aria-hidden="true"></span>
  </span>
  {#if label}<span class="text">{label}</span>{/if}
</label>

<style>
  .root {
    display: inline-flex;
    align-items: center;
    gap: 0.1rem;
    cursor: pointer;
    user-select: none;
    font: var(--font-input);
    color: hsl(from var(--color-text) h s l / 0.8);

    &.disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    &.sm {
      --dot-size: 1.5rem;
    }
    &.md {
      --dot-size: 2rem;
    }

    & {
      --color-dot: var(--color-accent);
    }
    &.error {
      --color-dot: var(--color-error);
    }
  }

  .root {
    border-radius: 50%;
    outline: var(--border-style);
    outline-color: transparent;
    outline-width: 0px;
    transition:
      outline-width 0.15s ease,
      outline-color 0.15s ease;

    &:has(input:focus-visible) {
      outline-color: var(--color-ring);
      outline-width: 3.5px;
    }
  }

  /* --- */

  .control {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: var(--dot-size);
    height: var(--dot-size);
    border-radius: 50%;
    background-color: transparent;
    will-change: transform;
    transition:
      background-color 0.15s ease,
      transform 0.15s ease;
  }

  :active .control {
    transform: scale(0.95);
    transition:
      background-color 0.15s ease,
      transform 0.03s ease;
  }

  .control > input[type="radio"] {
    position: absolute;
    inset: 0;
    margin: 0;
    appearance: none;
    opacity: 0;
    cursor: pointer;
  }

  .control > input[type="radio"]:disabled {
    cursor: default;
  }

  /* --- */

  .dot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 55%;
    height: 55%;
    border: var(--border-style);
    border-radius: 50%;
    transition: border-color 0.15s ease;
  }

  .dot::after {
    content: "";
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background-color: var(--color-dot);
    transform: scale(0);
    transition: transform 0.15s ease;
  }

  input:checked ~ .dot::after {
    transform: scale(0.6);
  }

  /* --- */

  .root input:not(:checked) ~ .dot {
    border-color: var(--color-border);
  }

  .root:hover > .control:has(input:not(:checked)) {
    background-color: hsl(from var(--color-border-hover) h s l / 0.35);
  }

  .root:hover input:not(:checked) ~ .dot {
    border-color: hsl(from var(--color-text) h s l / 0.35);
  }

  .root:hover > .control:has(input:checked) {
    background-color: hsl(from var(--color-dot) h s l / 0.25);
  }

  .root input:checked ~ .dot {
    border-color: var(--color-dot);
  }

  /* --- */

  .text {
    font: inherit;
  }
</style>
