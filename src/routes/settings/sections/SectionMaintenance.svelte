<script lang="ts">
  import { formatDate, formatSize } from "$lib/utils/shared";
  import { IconAlertCircleFilled, IconDatabase, IconInfoCircleFilled } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ToolCard from "./ToolCard.svelte";
  import { getMissingContext } from "../logic/missing.svelte";
  import { getBackupContext } from "../logic/backup.svelte";
  import { getPageDataContext } from "../logic/page-data.svelte";

  const missing = getMissingContext();
  const backup = getBackupContext();
  const pageData = getPageDataContext();
  const fileStats = $derived(pageData.value.databaseFileStats);
</script>

{#if fileStats}
  <ToolCard
    Icon={IconInfoCircleFilled}
    title="資料庫狀態"
    description="db.json 紀錄檔目前的大小與最後一次寫入磁碟的時間，設定頁面載入時更新。"
  >
    {#snippet actions()}
      <dl>
        <div>
          <dt>最後修改於</dt>
          <dd>{formatDate(fileStats.mtimeMs)}</dd>
        </div>
        <div>
          <dt>目前大小</dt>
          <dd>{formatSize(fileStats.size)}</dd>
        </div>
      </dl>
    {/snippet}
  </ToolCard>
{/if}

<ToolCard
  Icon={IconAlertCircleFilled}
  title="缺失檔案檢查"
  description="找出資料庫有記錄但對應檔案已不存在的項目，通常因曾手動刪除檔案而產生，檢查後可選擇移除這些失效的記錄。"
  result={missing.result}
>
  {#snippet actions()}
    <Button variant="outlined" status={missing.pending ? "pending" : undefined} onclick={missing.handleCheck}>
      開始檢查
    </Button>
    {#if missing.records !== null && missing.records.length > 0}
      <Button variant="destructive" status={missing.pending ? "pending" : undefined} onclick={missing.handleDelete}>
        刪除 {missing.records.length} 個缺失記錄
      </Button>
    {/if}
  {/snippet}
</ToolCard>

<ToolCard Icon={IconDatabase} title="備份" description="將目前的圖片集打包為 ZIP 備份檔，下載至你的裝置。">
  {#snippet actions()}
    <Button variant="outlined" status={backup.pending ? "pending" : undefined} onclick={backup.handleDownload}>
      下載備份
    </Button>
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
