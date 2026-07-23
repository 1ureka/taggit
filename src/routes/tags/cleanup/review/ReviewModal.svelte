<script lang="ts">
  import Modal from "$lib/components/floating/Modal.svelte";
  import ReviewFooter from "$lib/components/review/ReviewFooter.svelte";
  import ReviewHeader from "$lib/components/review/ReviewHeader.svelte";
  import ReviewList from "$lib/components/review/ReviewList.svelte";
  import ReviewItemTag from "$lib/components/review/ReviewItemTag.svelte";

  import { getReviewContext } from "../logic/review.svelte";
  import { getOperationsContext } from "../logic/operations.svelte";

  const review = getReviewContext();
  const operations = getOperationsContext();

  const containerStyle = "width: 42rem; max-width: min(90dvw, 42rem); display: flex; flex-direction: column;";
</script>

<Modal
  open={review.open}
  onclose={review.handleClose}
  aria-label="檢視待送出的標籤清理操作"
  containerProps={{ style: containerStyle }}
>
  <ReviewHeader />

  <ReviewList
    pending={operations.pending}
    checkedAll={review.bulkSelectionState}
    checkableCount={review.checkableCount}
    totalCount={review.entries.length}
    checkedCount={review.checkedCount}
    ontoggleall={review.handleToggleAll}
  >
    {#each review.entries as entry (entry.name)}
      {@const kind = entry.kind}
      {@const withExtraProps = kind === "merge"}
      {@const extraProps = withExtraProps
        ? { target: entry.to, mergedCount: entry.toCount + entry.count - entry.both }
        : undefined}
      <ReviewItemTag
        {kind}
        checkable={entry.checkable}
        checked={entry.checked}
        tag={entry.name}
        count={entry.count}
        problem={entry.problem}
        ontoggle={() => review.handleToggle(entry.name)}
        ondiscard={() => review.handleDiscard(entry.name)}
        {...extraProps}
      />
    {/each}
  </ReviewList>

  <ReviewFooter
    pending={operations.pending}
    count={review.checkedCount}
    oncancel={review.handleClose}
    onsubmit={review.handleSubmit}
  />
</Modal>
