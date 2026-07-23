<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { IconFilter } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import { getQueryContext } from "../logic/query.svelte";

  let props: HTMLButtonAttributes = $props();

  const query = getQueryContext();
</script>

<Button variant="outlined" aria-label="進階篩選" {...props}>
  <IconFilter size={16} />
  <span>篩選</span>
  {#if query.advancedCount > 0}
    <span>
      <span class="badge">{query.advancedCount}</span>
    </span>
  {/if}
</Button>

<style>
  span:has(.badge) {
    display: flex;
    align-items: center;
    height: 0px;
    overflow: visible;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.125rem;
    height: 1.125rem;
    padding: 0 0.25rem;
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    color: var(--color-bg);
    background: var(--color-text);
    border-radius: 9999px;
  }
</style>
