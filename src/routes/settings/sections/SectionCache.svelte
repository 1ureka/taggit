<script lang="ts">
  import { formatSize } from "$lib/utils/shared";
  import { IconPhotoFilled, IconFilter } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ToolCard from "./ToolCard.svelte";
  import { getCacheContext } from "../logic/cache.svelte";
  import { getMetadataContext } from "../logic/metadata.svelte";

  const cache = getCacheContext();
  const metadata = getMetadataContext();
</script>

<ToolCard
  Icon={IconPhotoFilled}
  title="圖片快取"
  description="系統會將處理過的縮圖結果暫存於記憶體中，加速後續存取。快取會在伺服器重啟時自動清空。"
>
  <dl>
    <div>
      <dt>圖片數量</dt>
      <dd>{cache.entries} 張</dd>
    </div>
    <div>
      <dt>快取大小</dt>
      <dd>{formatSize(cache.bytes)}</dd>
    </div>
  </dl>

  {#snippet actions()}
    <Button variant="outlined" status={cache.pending ? "pending" : undefined} onclick={cache.handleClear}>
      清空快取
    </Button>
  {/snippet}
</ToolCard>

<ToolCard
  Icon={IconFilter}
  title="元資料完整性"
  description="檢查資料庫是否有已提交圖片缺少寬高或模糊預覽等資料，檢查後可選擇重新計算。"
  result={metadata.result}
>
  {#snippet actions()}
    <Button variant="outlined" status={metadata.pending ? "pending" : undefined} onclick={metadata.handleCheck}>
      開始檢查
    </Button>
    {#if metadata.missing > 0}
      <Button variant="outlined" status={metadata.pending ? "pending" : undefined} onclick={metadata.handleFix}>
        修復 {metadata.missing} 張
      </Button>
    {/if}
  {/snippet}
</ToolCard>

<style>
  dl {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font: var(--font-body1);
    color: var(--color-text);
  }

  dl > div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  dl > div:not(:last-child)::after {
    content: "·";
    margin: 0 0.5rem;
    color: var(--color-text);
  }
</style>
