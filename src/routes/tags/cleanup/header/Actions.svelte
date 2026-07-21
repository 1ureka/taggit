<script lang="ts">
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconReload } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import { getOperationsContext } from "../logic/operations.svelte";
  import { getScheduleContext } from "../logic/schedule.svelte";
  import { getReviewContext } from "../logic/review.svelte";

  const operations = getOperationsContext();
  const schedule = getScheduleContext();
  const review = getReviewContext();
</script>

<div>
  <Button
    variant="ghost"
    padding="icon"
    aria-label="重新整理"
    status={operations.pending ? "pending" : undefined}
    onclick={operations.handleRefresh}
    {@attach tooltip({ content: "重新整理" })}
  >
    <IconReload size={16} />
  </Button>

  <Button
    variant="primary"
    status={schedule.touchedCount === 0 || operations.pending ? "disabled" : undefined}
    onclick={review.handleOpen}
  >
    檢視變更 ({schedule.touchedCount})
  </Button>
</div>

<style>
  div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
