<script lang="ts">
  import Chip from "$lib/components/display/Chip.svelte";
  import { IconInfoCircleFilled } from "$lib/icons";

  let { checkedCount, tags }: { checkedCount: number; tags: string[] } = $props();
</script>

{#snippet tag(t: string)}
  {@const fontStyle = "color: var(--color-success); font: var(--font-caption); "}
  {@const borderStyle = "border-color: hsl(from var(--color-success) h s l / 0.5); "}
  {@const backgroundStyle = "background: hsl(from var(--color-success) h s l / 0.08);"}
  <Chip style={fontStyle + borderStyle + backgroundStyle}>
    <span class="sign">+</span>{t}
  </Chip>
{/snippet}

<div>
  <IconInfoCircleFilled size={16} />
  {#if checkedCount === 0}
    <span>尚未勾選任何項目。</span>
  {:else if tags.length === 0}
    <span>此次變動不會產生新標籤。</span>
  {:else}
    <span>此次提交將建立 {tags.length} 個新標籤：</span>
    {#each tags as t (t)}{@render tag(t)}{/each}
  {/if}
</div>

<style>
  div {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.25rem;
    font: var(--font-caption);
    color: var(--color-text-muted);
  }

  .sign {
    font-family: var(--font-family-mono);
  }
</style>
