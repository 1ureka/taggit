<script lang="ts">
  import type { ReviewEntry } from "../logic/review-entry";

  let { entry }: { entry: ReviewEntry } = $props();
</script>

{#if entry.kind === "rename" || entry.kind === "merge"}
  <span class="impact">
    <del>{entry.name}</del> → <ins>{entry.to}</ins>
    {#if entry.kind === "merge"}
      <span>（{entry.count} 張併入，合併後共 {entry.mergedCount ?? "..."} 張）</span>
    {:else}
      <span>（{entry.count} 張）</span>
    {/if}
  </span>
{:else if entry.kind === "delete"}
  <span class="impact">
    <del>{entry.name}</del>
    <span>（自 {entry.count} 張圖片移除）</span>
  </span>
{:else if entry.kind === "hidden"}
  <span class="impact">
    {entry.name}
    <span>（{entry.count} 張，查詢時將被遮蔽）</span>
  </span>
{:else if entry.kind === "visible"}
  <span class="impact">
    {entry.name}
    <span>（{entry.count} 張，恢復一般可見）</span>
  </span>
{/if}

<style>
  span.impact {
    font: var(--font-body2);
    color: var(--color-text-muted);
    overflow-wrap: anywhere;
  }

  span.impact > del {
    color: var(--color-text-muted);
    opacity: 0.7;
    text-decoration: line-through;
  }

  span.impact > ins {
    color: var(--color-text);
    text-decoration: none;
  }

  span.impact > span {
    color: var(--color-text-muted);
    font: var(--font-caption);
  }
</style>
