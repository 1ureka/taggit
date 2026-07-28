<script lang="ts">
  import ImageRecordCardWrapper from "$lib/components/workflow/ImageRecordCardWrapper.svelte";
  import ImageRecordCardInfo from "$lib/components/workflow/ImageRecordCardInfo.svelte";

  import { getDraftsContext } from "../logic/drafts.svelte";
  import { getPointersContext } from "../logic/pointers.svelte";
  import { getSelectionContext } from "../logic/selection.svelte";

  const { filename }: { filename: string } = $props();

  const drafts = getDraftsContext();
  const pointers = getPointersContext();
  const selection = getSelectionContext();

  const info = $derived.by(() => {
    const draft = drafts.draftOf(filename);
    if (!draft) return undefined;

    const kind: "not-ready" | "ready" = drafts.problemOf(filename) ? "not-ready" : "ready";
    return { kind, name: draft.name, rating: draft.rating, tagCount: draft.tags.length };
  });

  const selected = $derived.by(() => {
    if (selection.active) return selection.isSelected(filename);
    else return pointers.editing?.id === filename;
  });

  const handleClick = () => {
    if (selection.active) selection.handleToggle(filename);
    else pointers.handleSelect(filename);
  };
</script>

<ImageRecordCardWrapper record={filename} {selected} selectable={selection.active} onclick={handleClick}>
  <ImageRecordCardInfo {filename} {info} />
</ImageRecordCardWrapper>
