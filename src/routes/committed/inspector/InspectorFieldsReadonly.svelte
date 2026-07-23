<script lang="ts">
  import Chip from "$lib/components/display/Chip.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";

  type Props = { name: string; rating: number; tags: string[] };

  const { name, rating, tags }: Props = $props();
</script>

<div class="container">
  <p>送出後這筆紀錄會消失、檔案回到暫存區。</p>

  <div>
    <span>名稱</span>
    <span>{name}</span>
  </div>

  <div>
    <span>評等</span>
    <Rating value={rating} readonly />
  </div>

  <div>
    <span>標籤</span>
    {#if tags.length > 0}
      <div class="tags">
        {#each tags as tag (tag)}
          <Chip variant="outlined" style="font: var(--font-caption);">{tag}</Chip>
        {/each}
      </div>
    {:else}
      <span>（無）</span>
    {/if}
  </div>
</div>

<style>
  div.container {
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    gap: 0.75rem;
  }

  div.container > p {
    font: var(--font-caption);
    color: var(--color-error);
    line-height: 1.5;
  }

  div.container > div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font: var(--font-body2);
    color: var(--color-text-muted);
    opacity: 0.7;

    & > span:first-child {
      font: var(--font-caption);
    }
  }

  div.tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
</style>
