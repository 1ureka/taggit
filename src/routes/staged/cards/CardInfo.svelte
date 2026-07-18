<script lang="ts">
  import { IconAlertCircleFilled, IconCheckFilled } from "$lib/icons";

  type Props = {
    /** 暫存圖片的檔名 */
    filename: string;
    /** 暫存圖片是否有編輯過草稿 */
    touched: boolean;
    /** 暫存圖片的草稿是否有問題 */
    problem: string | null;
    /** 暫存圖片草稿的名稱 */
    name: string;
    /** 暫存圖片草稿的評分 */
    rating: number;
    /** 暫存圖片草稿的標籤數量 */
    tagCount: number;
  };

  let { filename, touched, problem, name, rating, tagCount }: Props = $props();
</script>

<div class="container">
  <div>
    <span class="ellipsis">{filename}</span>
    {#if touched}
      <span class="mark" title={problem ?? "可提交"}>
        {#if problem === null}
          <IconCheckFilled size={14} color="var(--color-success)" />
        {:else}
          <IconAlertCircleFilled size={14} color="var(--color-warning)" />
        {/if}
      </span>
    {/if}
  </div>

  {#if touched}
    <div>
      {#if rating > 0}<span>★{rating}</span>{/if}
      {#if tagCount > 0}<span>{tagCount} 標籤</span>{/if}
      {#if name}<span class="ellipsis">「{name.trim()}」</span>{/if}
    </div>
  {/if}
</div>

<style>
  div.container {
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    padding-bottom: 0.375rem;
    gap: 0.5rem;
    min-width: 0;
  }

  div.container > div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  div.container > div:nth-of-type(1) {
    & > span.ellipsis {
      flex: 1;
      font: var(--font-caption);
      color: var(--color-text-muted);
    }

    & > span.mark {
      display: inline-flex;
      flex-shrink: 0;
    }
  }

  div.container > div:nth-of-type(2) {
    font: var(--font-caption);
    color: var(--color-text-muted);

    & > span:not(.ellipsis) {
      flex-shrink: 0;
    }
  }
</style>
