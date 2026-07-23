<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import WorkflowCardInfo from "$lib/components/widgets/WorkflowCardInfo.svelte";
  import WorkflowCardWrapper from "$lib/components/widgets/WorkflowCardWrapper.svelte";
  import { getDraftsContext } from "../logic/drafts.svelte";
  import { getRevertMarkContext } from "../logic/reverts.svelte";
  import { getPointersContext } from "../logic/pointers.svelte";

  const { record }: { record: ImageWithId } = $props();

  const drafts = getDraftsContext();
  const reverts = getRevertMarkContext();
  const pointers = getPointersContext();

  const info = $derived.by(() => {
    if (reverts.isMarked(record.id)) return "reverted";

    const draft = drafts.draftOf(record.id);
    if (!draft) return undefined;

    const kind: "not-ready" | "ready" = drafts.problemOf(record.id) ? "not-ready" : "ready";
    return { kind, name: draft.name, rating: draft.rating, tagCount: draft.tags.length };
  });
</script>

<WorkflowCardWrapper
  filename={record.id}
  selected={pointers.editing?.id === record.id}
  onclick={() => pointers.handleSelect(record.id)}
>
  <WorkflowCardInfo filename={record.id} {info} />
</WorkflowCardWrapper>
