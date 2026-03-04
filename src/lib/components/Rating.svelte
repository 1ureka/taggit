<script lang="ts">
  import { IconStar, IconStarFilled } from "@tabler/icons-svelte";

  let {
    value = $bindable(0),
    size = "1.25rem",
    readonly = false,
    onchange,
  }: {
    value?: number;
    size?: string;
    /** When true the component is display-only — no hover, click or keyboard interaction. */
    readonly?: boolean;
    /** Called with the new value (0–5) whenever the user clicks a star. */
    onchange?: (v: number) => void;
  } = $props();

  // Convert CSS rem string → px for tabler icon size prop (assumes 16px root)
  const iconPx = $derived(Math.round(parseFloat(size) * 16));

  let hoveredValue = $state(0);
  let displayValue = $derived(hoveredValue || value);

  function handleClick(starValue: number) {
    const next = starValue === value ? 0 : starValue;
    value = next;
    onchange?.(next);
  }
</script>

{#if readonly}
  <div class="rating rating-readonly" role="img" aria-label="評分 {value}/5">
    {#each [1, 2, 3, 4, 5] as i}
      <span class="rating-star" class:active={i <= value}>
        {#if i <= value}
          <IconStarFilled size={iconPx} />
        {:else}
          <IconStar size={iconPx} />
        {/if}
      </span>
    {/each}
  </div>
{:else}
  <div class="rating" role="group" aria-label="評分" onmouseleave={() => (hoveredValue = 0)}>
    {#each [1, 2, 3, 4, 5] as i}
      <span
        class="rating-star"
        class:preview={i <= value}
        class:active={i <= displayValue}
        role="button"
        tabindex="0"
        onmouseenter={() => (hoveredValue = i)}
        onclick={() => handleClick(i)}
        onkeydown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick(i);
        }}
      >
        {#if i <= value}
          <IconStarFilled size={iconPx} />
        {:else}
          <IconStar size={iconPx} />
        {/if}
      </span>
    {/each}
  </div>
{/if}

<style>
  .rating {
    display: inline-flex;
    gap: 0.125rem;
    user-select: none;
  }

  .rating-star {
    display: inline-flex;
    cursor: pointer;
    color: var(--text-dim);
    transition:
      color 0.1s,
      transform 0.1s;
  }

  .rating-star:hover {
    transform: scale(1.15);
  }

  .rating-star.preview {
    color: var(--text-dim);
  }

  .rating-star.active {
    color: var(--text);
  }

  /* ─── Readonly mode ─────────────────────────────────────── */
  .rating-readonly .rating-star {
    cursor: default;
  }

  .rating-readonly .rating-star:hover {
    transform: none;
  }
</style>
