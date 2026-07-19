<script lang="ts">
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconReload, IconArrowRight } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
  import { getOperationsContext } from "../logic/operations.svelte";
  import { getBoardContext } from "../logic/board.svelte";
  import { getReviewContext } from "../logic/review.svelte";

  const operations = getOperationsContext();
  const board = getBoardContext();
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

  <ButtonLink variant="outlined" href="/tags/cleanup" status="disabled">
    <span>清理工具</span>
    <IconArrowRight size={16} />
  </ButtonLink>

  <Button
    variant="primary"
    status={board.touchedCount === 0 || operations.pending ? "disabled" : undefined}
    onclick={review.handleOpen}
  >
    檢視變更 ({board.touchedCount})
  </Button>
</div>

<style>
  div {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
</style>
