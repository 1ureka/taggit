<script lang="ts">
  import type { Snippet } from "svelte";

  const { upper, lower }: { upper: Snippet; lower: Snippet } = $props();
</script>

<aside>
  {@render upper()}
  <div>
    {@render lower()}
  </div>
</aside>

<style>
  aside {
    display: flex;
    flex-direction: column;
    width: 22rem;
    min-width: 22rem;
    min-height: 0;
    border-left: var(--border-style);
  }

  div {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
</style>
