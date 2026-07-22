<script lang="ts">
  import Rating from "$lib/components/inputs/Rating.svelte";

  type Props = {
    value?: number;
    max?: number;
    size?: "sm" | "md";
  };

  let { value = 0, max = 5, size = "sm" }: Props = $props();
</script>

<span>
  <Rating {value} {max} {size} readonly />
</span>

<style>
  span {
    position: relative;
    display: inline-flex;
    align-items: center;
    opacity: 0.75;
  }

  span::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    height: 2px;
    background-color: currentColor;
    pointer-events: none;
  }
</style>
