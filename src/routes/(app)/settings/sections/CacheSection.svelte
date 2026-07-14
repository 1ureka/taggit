<script lang="ts">
  import { api } from "$lib/utils/request";
  import { formatSize } from "$lib/utils/shared";

  import { addToast } from "$lib/components/floating/toast-events";
  import { IconPhotoFilled, IconFilter } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import LinearProgress from "$lib/components/display/LinearProgress.svelte";
  import ToolCard from "./ToolCard.svelte";

  let { cacheStats }: { cacheStats: { entries: number; bytes: number } } = $props();

  // ---

  // 可覆寫的 derived，清空快取時覆寫為 0，load 重跑後回到伺服器統計
  let cacheEntries = $derived(cacheStats.entries);
  let cacheBytes = $derived(cacheStats.bytes);
  let cacheBusy = $state(false);

  const handleClearCache = async () => {
    cacheBusy = true;
    const res = await api.del<{ cleared: number }>("/api/settings/cache");
    cacheBusy = false;

    if (res.ok && res.data) {
      addToast({ message: `已清空 ${res.data.cleared} 筆快取`, variant: "success" });
      cacheEntries = 0;
      cacheBytes = 0;
    } else {
      addToast({ message: `清空快取失敗：${res.error ?? "未知錯誤"}`, variant: "error" });
    }
  };

  // ---

  /** 缺失元資料的圖片數量（-1 表示尚未檢查） */
  let metaMissing = $state(-1);
  let metaChecking = $state(false);
  let metaFixing = $state(false);

  const metaBusy = $derived(metaChecking || metaFixing);

  /** 檢查結果需持續可見（驅動「補算」按鈕），留在卡片內 */
  const metaResult = $derived.by(() => {
    if (metaMissing < 0) return undefined;
    if (metaMissing === 0) return "所有圖片的元資料皆完整";
    return `找到 ${metaMissing} 張圖片缺少元資料`;
  });

  const handleMetaCheck = async () => {
    metaChecking = true;
    const res = await api.get<{ missing: number }>("/api/settings/metadata");
    metaChecking = false;

    if (res.ok && res.data) {
      metaMissing = res.data.missing;
    } else {
      addToast({ message: `檢查失敗：${res.error ?? "未知錯誤"}`, variant: "error" });
    }
  };

  const handleMetaFix = async () => {
    metaFixing = true;
    const res = await api.post<{ updated: number }>("/api/settings/metadata");
    metaFixing = false;

    if (res.ok && res.data) {
      const { updated } = res.data;
      addToast({
        message: updated > 0 ? `已為 ${updated} 張圖片補上元資料` : "沒有圖片需要補算",
        variant: "success",
      });
      metaMissing = Math.max(0, metaMissing - updated);
    } else {
      addToast({ message: `補算失敗：${res.error ?? "未知錯誤"}`, variant: "error" });
    }
  };
</script>

<ToolCard
  Icon={IconPhotoFilled}
  title="圖片快取"
  description="系統會將處理過的縮圖結果暫存於記憶體中，加速後續存取。快取會在伺服器重啟時自動清空。"
>
  <dl>
    <div>
      <dt>圖片數量</dt>
      <dd>{cacheEntries} 張</dd>
    </div>
    <div>
      <dt>快取大小</dt>
      <dd>{formatSize(cacheBytes)}</dd>
    </div>
  </dl>

  {#snippet actions()}
    <Button variant="outlined" padding="sm" status={cacheBusy ? "pending" : undefined} onclick={handleClearCache}>
      清空快取
    </Button>
  {/snippet}
</ToolCard>

<ToolCard
  Icon={IconFilter}
  title="元資料完整性"
  description="檢查資料庫是否有已提交圖片缺少寬高或模糊預覽等資料，檢查後可選擇重新計算。"
  result={metaResult}
>
  {#if metaFixing}
    <LinearProgress size="sm" color="var(--color-accent)" />
  {/if}

  {#snippet actions()}
    <Button
      variant="outlined"
      padding="sm"
      status={metaBusy ? (metaChecking ? "pending" : "disabled") : undefined}
      onclick={handleMetaCheck}
    >
      開始檢查
    </Button>
    {#if metaMissing > 0}
      <Button
        variant="outlined"
        padding="sm"
        status={metaBusy ? (metaFixing ? "pending" : "disabled") : undefined}
        onclick={handleMetaFix}
      >
        補算 {metaMissing} 張
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
