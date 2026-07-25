<script lang="ts">
  import ImageRecordPanel from "$lib/components/workflow/ImageRecordPanel.svelte";
  import ImageRecordPanelHeader from "$lib/components/workflow/ImageRecordPanelHeader.svelte";
  import ImageRecordPanelImage from "$lib/components/workflow/ImageRecordPanelImage.svelte";
  import ImageRecordPanelFooter from "$lib/components/workflow/ImageRecordPanelFooter.svelte";
  import ImageRecordFields from "$lib/components/workflow/ImageRecordFields.svelte";
  import ImageRecordFieldsRevert from "$lib/components/workflow/ImageRecordFieldsRevert.svelte";
  import ImageRecordFieldsBatch from "$lib/components/workflow/ImageRecordFieldsBatch.svelte";

  import { getPageDataContext } from "../logic/page-data.svelte";
  import { getPointersContext } from "../logic/pointers.svelte";
  import { getDraftsContext } from "../logic/drafts.svelte";
  import { getRevertMarkContext } from "../logic/reverts.svelte";
  import { getSelectionContext } from "../logic/selection.svelte";
  import { getSelectionDraftContext } from "../logic/selection-draft.svelte";
  import { getQueryContext } from "../logic/query.svelte";

  const pageData = getPageDataContext();
  const pointers = getPointersContext();
  const drafts = getDraftsContext();
  const reverts = getRevertMarkContext();
  const selection = getSelectionContext();
  const selectionDraft = getSelectionDraftContext();
  const query = getQueryContext();

  const pointer = $derived(pointers.editing);
</script>

{#if selection.active}
  <ImageRecordPanel>
    {#snippet upper()}
      <ImageRecordPanelHeader
        variant="batch"
        checkedAll={selection.bulkSelectionState}
        checkedCount={selection.count}
        ontoggleall={selection.handleToggleAll}
        onclose={selection.handleExit}
      />
    {/snippet}
    {#snippet lower()}
      <ImageRecordFieldsBatch
        checked={selectionDraft.checked}
        revert={selectionDraft.revert}
        locked={selectionDraft.locked}
        rating={selectionDraft.rating}
        addTags={selectionDraft.addTags}
        removeTags={selectionDraft.removeTags}
        facetScope={query.facetScope}
        oncheck={selectionDraft.handleCheck}
        onmark={selectionDraft.handleRevertChange}
        onrating={selectionDraft.handleRatingChange}
        onchangetags={selectionDraft.handleTagsChange}
      />

      <ImageRecordPanelFooter
        variant="batch"
        applicable={selection.count > 0 && !!selectionDraft.dirty}
        count={selection.count}
        onapply={selectionDraft.handleApply}
      />
    {/snippet}
  </ImageRecordPanel>
{:else if pointer !== null}
  <ImageRecordPanel>
    {#snippet upper()}
      <ImageRecordPanelHeader
        variant="single"
        title={pointer.id}
        index={pointer.index}
        total={pageData.value.items.length}
        onclose={pointers.handleClose}
      />

      <ImageRecordPanelImage file={pointer.id} onopen={() => pointers.handleLightboxOpen(pointer.id)} />
    {/snippet}
    {#snippet lower()}
      {@const view = drafts.viewOf(pointer.id)}
      {#if reverts.isMarked(pointer.id)}
        <ImageRecordFieldsRevert {...view} />

        <ImageRecordPanelFooter variant="single-revert" oncancel={() => reverts.handleUnmark([pointer.id])} />
      {:else}
        {@const handleDiscard = () => drafts.handleDiscardDraft([pointer.id])}
        {@const handleRevert = () => reverts.handleMark([pointer.id])}
        <ImageRecordFields
          name={view.name}
          rating={view.rating}
          tags={view.tags}
          problem={drafts.problemOf(pointer.id)}
          onchangename={(v) => drafts.handleSetName([pointer.id], v)}
          onchangerating={(v) => drafts.handleSetRating([pointer.id], v)}
          onchangetags={(v) => drafts.handleSetTags([pointer.id], v)}
        />

        <ImageRecordPanelFooter variant="single" ondiscard={handleDiscard} onrevert={handleRevert} />
      {/if}
    {/snippet}
  </ImageRecordPanel>
{/if}
