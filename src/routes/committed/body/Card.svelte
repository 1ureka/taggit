<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import ImageRecordCardWrapper from "$lib/components/workflow/ImageRecordCardWrapper.svelte";
  import ImageRecordCardInfo from "$lib/components/workflow/ImageRecordCardInfo.svelte";

  import { getDraftsContext } from "../logic/drafts.svelte";
  import { getRevertMarkContext } from "../logic/reverts.svelte";
  import { getPointersContext } from "../logic/pointers.svelte";
  import { getSelectionContext } from "../logic/selection.svelte";

  const { record }: { record: ImageWithId } = $props();

  const drafts = getDraftsContext();
  const reverts = getRevertMarkContext();
  const pointers = getPointersContext();
  const selection = getSelectionContext();

  const info = $derived.by(() => {
    if (reverts.isMarked(record.id)) return "reverted";

    const draft = drafts.draftOf(record.id);
    if (!draft) return undefined;

    const kind: "not-ready" | "ready" = drafts.problemOf(record.id) ? "not-ready" : "ready";
    return { kind, name: draft.name, rating: draft.rating, tagCount: draft.tags.length };
  });

  const selected = $derived.by(() => {
    if (selection.active) return selection.isSelected(record.id);
    else return pointers.editing?.id === record.id;
  });

  const handleClick = () => {
    if (selection.active) selection.handleToggle(record.id);
    else pointers.handleSelect(record.id);
  };
</script>

<ImageRecordCardWrapper {record} {selected} selectable={selection.active} onclick={handleClick}>
  <ImageRecordCardInfo filename={record.id} {info} />
</ImageRecordCardWrapper>
