<script lang="ts">
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconReload, IconArrowRight } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";

  type Props = {
    /** 全局共用的操作鎖 */
    pending: boolean;
    /** 可審查的標籤數量 */
    touchedCount: number;
    /** 點擊重新整理事件 */
    onrefresh: () => void;
    /** 前往審查流程事件 */
    onreview: () => void;
  };

  let { pending, touchedCount, onrefresh, onreview }: Props = $props();
</script>

<div>
  <Button
    variant="ghost"
    padding="icon"
    aria-label="重新整理"
    status={pending ? "pending" : undefined}
    onclick={onrefresh}
    {@attach tooltip({ content: "重新整理" })}
  >
    <IconReload size={16} />
  </Button>

  <ButtonLink variant="outlined" href="/tags/cleanup" status="disabled">
    <span>清理工具</span>
    <IconArrowRight size={16} />
  </ButtonLink>

  <Button variant="primary" status={touchedCount === 0 ? "disabled" : undefined} onclick={onreview}>
    檢視變更（{touchedCount}）
  </Button>
</div>

<style>
  div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
