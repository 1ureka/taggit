<script lang="ts">
  import ImageRecordPanel from "$lib/components/workflow/ImageRecordPanel.svelte";
  import ImageRecordPanelHeader from "$lib/components/workflow/ImageRecordPanelHeader.svelte";
  import ImageRecordPanelImage from "$lib/components/workflow/ImageRecordPanelImage.svelte";

  import PanelFooter from "./PanelFooter.svelte";
  import PanelFields from "./PanelFields.svelte";
  import PanelBatchFields from "./PanelBatchFields.svelte";

  import { getPageDataContext } from "../logic/page-data.svelte";
  import { getPointersContext } from "../logic/pointers.svelte";
  import { getDraftsContext, stripExt } from "../logic/drafts.svelte";
  import { getDeletionContext } from "../logic/deletion.svelte";
  import { getSelectionContext } from "../logic/selection.svelte";
  import { getSelectionDraftContext } from "../logic/selection-draft.svelte";

  const pageData = getPageDataContext();
  const pointers = getPointersContext();
  const drafts = getDraftsContext();
  const deletion = getDeletionContext();
  const selection = getSelectionContext();
  const selectionDraft = getSelectionDraftContext();

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
      <PanelBatchFields
        checked={selectionDraft.checked}
        rating={selectionDraft.rating}
        addTags={selectionDraft.addTags}
        removeTags={selectionDraft.removeTags}
        oncheck={selectionDraft.handleCheck}
        onrating={selectionDraft.handleRatingChange}
        onchangetags={selectionDraft.handleTagsChange}
      />

      <PanelFooter
        variant="batch"
        applicable={selection.count > 0 && selectionDraft.dirty}
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
        total={pageData.value.stagedFiles.length}
        onclose={pointers.handleClose}
      />

      <ImageRecordPanelImage file={pointer.id} onopen={() => pointers.handleLightboxOpen(pointer.id)} />
    {/snippet}
    {#snippet lower()}
      {@const view = drafts.viewOf(pointer.id)}
      {@const handleDiscard = () => drafts.handleDiscardDraft([pointer.id])}
      {@const handleDelete = () => deletion.handleDelete(pointer.id)}
      <PanelFields
        name={view.name}
        rating={view.rating}
        tags={view.tags}
        problem={drafts.problemOf(pointer.id)}
        placeholder={stripExt(pointer.id)}
        onchangename={(v) => drafts.handleSetName([pointer.id], v)}
        onchangerating={(v) => drafts.handleSetRating([pointer.id], v)}
        onchangetags={(v) => drafts.handleSetTags([pointer.id], v)}
      />

      <PanelFooter variant="single" pending={deletion.pending} ondiscard={handleDiscard} ondelete={handleDelete} />
    {/snippet}
  </ImageRecordPanel>
{/if}
