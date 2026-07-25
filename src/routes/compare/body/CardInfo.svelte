<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import { IconEditFilled, IconArrowBackUpDouble } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";
  import TagsWithMask from "$lib/components/widgets/TagsWithMask.svelte";

  import { getQueryContext } from "../logic/query.svelte";
  import { getRevertContext } from "../logic/revert.svelte";

  let { record }: { record: ImageWithId } = $props();

  const query = getQueryContext();
  const revert = getRevertContext();

  const href = $derived.by(() => {
    const params = query.query.toSearchParams();
    params.set("currentId", record.id);
    return `/committed?${params.toString()}`;
  });
</script>

<div class="container">
  <Rating value={record.rating} readonly size="md" />
  <TagsWithMask tags={record.tags} />

  <div>
    <ButtonLink variant="outlined" {href}>
      <IconEditFilled size={16} />
      <span>編輯</span>
    </ButtonLink>
    <Button
      variant="destructive"
      status={revert.pending ? "pending" : undefined}
      onclick={() => revert.handleRevert(record.id)}
    >
      <IconArrowBackUpDouble size={16} />
      <span>取消提交</span>
    </Button>
  </div>
</div>

<style>
  div.container {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.25rem;
    padding-top: 0.75rem;
    padding-bottom: 1.5rem;
  }

  div.container > div {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
    gap: 0.5rem;
  }
</style>
