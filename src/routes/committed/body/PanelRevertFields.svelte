<script lang="ts">
  import Alert from "$lib/components/display/Alert.svelte";
  import Chip from "$lib/components/display/Chip.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";

  type Props = {
    /** 名稱欄位值 */
    name: string;
    /** 評等欄位值 */
    rating: number;
    /** 標籤欄位值 */
    tags: string[];
  };

  const { name, rating, tags }: Props = $props();
</script>

<div class="container">
  <Alert status="error" message="送出後這筆紀錄會消失、檔案回到暫存區。" />

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
          <Chip variant="outlined" style="font: var(--font-body2);">{tag}</Chip>
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

  div.container > div {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    font: var(--font-body2);
    color: var(--color-text-muted);
    opacity: 0.7;
  }

  div.tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
  }
</style>
