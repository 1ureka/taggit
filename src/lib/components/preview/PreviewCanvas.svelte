<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type Props = HTMLAttributes<HTMLDivElement> & { children: Snippet };

  let { children, ...rest }: Props = $props();
</script>

<div {...rest}>
  {@render children()}
</div>

<style>
  div {
    position: relative;
    min-height: 250px;
    padding: 3rem;

    display: flex;
    align-items: center;
    justify-content: center;

    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 2);
    overflow: hidden;
  }
</style>
