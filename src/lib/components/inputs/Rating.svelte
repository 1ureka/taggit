<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { IconStar, IconStarFilled } from "$lib/icons";

  type Props = Omit<HTMLAttributes<HTMLDivElement>, "onchange"> & {
    value?: number;
    max?: number;
    readonly?: boolean;
    size?: "sm" | "md";
    status?: "default" | "disabled";
    name?: string;
    onchange?: (value: number) => void;
  };

  let {
    value = $bindable(0),
    max = 5,
    readonly = false,
    size = "md",
    status = "default",
    name,
    id,
    onchange,
    ...rest
  }: Props = $props();

  const interactive = $derived(!readonly && status !== "disabled");
  const stars = $derived(Array.from({ length: max }, (_, i) => i + 1));
  const iconSize = $derived(size === "sm" ? "1rem" : "1.25rem");

  let hovered = $state(0);
  const displayValue = $derived(hovered > 0 ? hovered : value);

  function commit(next: number) {
    if (!interactive) return;
    value = next;
    onchange?.(next);
  }

  function handleStarEnter(i: number) {
    if (interactive) hovered = i;
  }

  function handleContainerLeave() {
    hovered = 0;
  }

  function handleStarClick(i: number) {
    commit(i === value ? 0 : i);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!interactive) return;

    if (e.key.length === 1 && e.key >= "0" && e.key <= "9") {
      const next = parseInt(e.key, 10);
      if (next > max) return;
      e.preventDefault();
      commit(next);
      return;
    }

    switch (e.key) {
      case "ArrowRight":
      case "ArrowUp":
        e.preventDefault();
        commit(Math.min(value + 1, max));
        break;

      case "ArrowLeft":
      case "ArrowDown":
        e.preventDefault();
        commit(Math.max(value - 1, 0));
        break;

      case "Home":
        e.preventDefault();
        commit(0);
        break;

      case "End":
        e.preventDefault();
        commit(max);
        break;
    }
  }
</script>

{#if name}
  <input type="hidden" {name} {value} />
{/if}

<div
  {id}
  class="rating {size} {status}"
  role="spinbutton"
  aria-valuenow={value}
  aria-valuemin={0}
  aria-valuemax={max}
  aria-valuetext={value === 0 ? "Unrated" : `${value} out of ${max}`}
  aria-disabled={status === "disabled"}
  aria-readonly={readonly}
  tabindex={interactive ? 0 : -1}
  onkeydown={handleKeydown}
  onmouseleave={handleContainerLeave}
  {...rest}
>
  {#each stars as i}
    <span
      class="star"
      class:bright={i <= displayValue}
      aria-hidden="true"
      onmouseenter={() => handleStarEnter(i)}
      onclick={() => handleStarClick(i)}
    >
      {#if i <= value}
        <IconStarFilled size={iconSize} />
      {:else}
        <IconStar size={iconSize} />
      {/if}
    </span>
  {/each}
</div>

<style>
  .rating {
    display: inline-flex;
    gap: 0.125rem;
    border-radius: calc(var(--border-radius) / 3);
    user-select: none;
  }

  .rating.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .rating:not(.disabled):not([aria-readonly="true"]) > .star {
    cursor: pointer;
  }

  .star {
    display: inline-flex;
    color: var(--color-text-muted);
    transition:
      color 0.15s ease,
      transform 0.15s ease;
  }

  .rating:not(.disabled):not([aria-readonly="true"]) > .star:hover {
    transform: scale(1.15);
  }

  .star.bright {
    color: var(--color-text);
  }
</style>
