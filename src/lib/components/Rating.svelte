<script lang="ts">
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

  let hoveredValue = $state(0);
  let displayValue = $derived(hoveredValue || value);

  function handleClick(starValue: number) {
    const next = starValue === value ? 0 : starValue;
    value = next;
    onchange?.(next);
  }
</script>

<div class="rating" style="font-size:{size}" role="group" aria-label="評分" onmouseleave={() => (hoveredValue = 0)}>
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
      {i <= value ? "★" : "☆"}
    </span>
  {/each}
</div>
