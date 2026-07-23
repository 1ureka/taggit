<script lang="ts">
  import type { Snippet } from "svelte";

  const { children }: { children: Snippet } = $props();
</script>

<div class="container">
  {@render children()}
</div>

<style>
  div.container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0px 1rem;
    height: 3rem;
    border-bottom: var(--border-style);
  }
</style>
