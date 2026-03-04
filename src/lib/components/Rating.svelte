<script lang="ts">
  import { IconStar, IconStarFilled } from "@tabler/icons-svelte";

  let {
    value = $bindable(0),
    size = "1.25rem",
    onchange,
  }: {
    value?: number;
    size?: string;
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
