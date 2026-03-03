<script lang="ts">
  let {
    value = $bindable(0),
    size = "1.25rem",
  }: {
    value?: number;
    size?: string;
  } = $props();

  function handleClick(starValue: number) {
    value = starValue === value ? 0 : starValue;
  }
</script>

<div class="rating" style="font-size:{size}">
  {#each [1, 2, 3, 4, 5] as i}
    <span
      class="rating-star"
      class:active={i <= value}
      role="button"
      tabindex="0"
      onclick={() => handleClick(i)}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleClick(i);
      }}
    >
      {i <= value ? "★" : "☆"}
    </span>
  {/each}
</div>
