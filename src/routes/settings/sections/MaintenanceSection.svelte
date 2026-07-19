<script lang="ts">
  import { getMissingContext } from "../logic/missing.svelte";
  import { getBackupContext } from "../logic/backup.svelte";

  import { IconAlertCircleFilled, IconDatabase } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ToolCard from "./ToolCard.svelte";

  const missing = getMissingContext();
  const backup = getBackupContext();
</script>

<ToolCard
  Icon={IconAlertCircleFilled}
  title="缺失檔案檢查"
  description="找出資料庫有記錄但對應檔案已不存在的項目，通常因曾手動刪除檔案而產生，檢查後可選擇移除這些失效的記錄。"
  result={missing.result}
>
  {#snippet actions()}
    <Button
      variant="outlined"
      padding="sm"
      status={missing.checking ? "pending" : missing.checkLocked ? "disabled" : undefined}
      onclick={missing.handleCheck}
    >
      開始檢查
    </Button>
    {#if missing.records !== null && missing.records.length > 0}
      <Button
        variant="destructive"
        padding="sm"
        status={missing.deleting ? "pending" : missing.checking ? "disabled" : undefined}
        onclick={missing.handleDelete}
      >
        刪除 {missing.records.length} 個缺失記錄
      </Button>
    {/if}
  {/snippet}
</ToolCard>

<ToolCard Icon={IconDatabase} title="備份" description="將目前的圖片集打包為 ZIP 備份檔，下載至你的裝置。">
  {#snippet actions()}
    <Button
      variant="outlined"
      padding="sm"
      status={backup.busy ? "pending" : undefined}
      onclick={backup.handleDownload}
    >
      下載備份
    </Button>
  {/snippet}
</ToolCard>
