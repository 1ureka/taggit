<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { page } from "$app/state";
  import { ImageQuery } from "$lib/query-spec";
  import { IconFilter } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";

  let props: HTMLButtonAttributes = $props();

  const query = $derived(ImageQuery.fromSearchParams(page.url.searchParams));

  /** 作用中的進階條件數 */
  const advancedCount = $derived(
    (query.where.includedTags.length > 0 ? 1 : 0) +
      (query.where.excludedTags.length > 0 ? 1 : 0) +
      (query.where.rating !== undefined ? 1 : 0),
  );
</script>

<Button variant="outlined" aria-label="進階篩選" {...props}>
  <IconFilter size={16} />
  <span>篩選</span>
  {#if advancedCount > 0}
    <span>
      <span class="badge">{advancedCount}</span>
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
