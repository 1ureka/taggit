<script lang="ts">
  import { page } from "$app/state";
  import type { ImageWithId } from "$lib/database";

  import { IconEditFilled, IconArrowBackUpDouble } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";
  import TagChips from "$lib/widgets/TagChips.svelte";

  type Props = {
    /** 卡片顯示的圖片紀錄 */
    record: ImageWithId;
    /** 全頁共用的操作鎖 */
    pending: boolean;
    /** 取消提交（退回暫存區） */
    onrevert: () => void;
  };

  let { record, pending, onrevert }: Props = $props();

  const href = $derived.by(() => {
    const params = new URLSearchParams(page.url.searchParams);
    params.delete("pinned");
    params.set("currentId", record.id);
    return `/editor?${params.toString()}`;
  });
</script>

<div class="info">
  <Rating value={record.rating} readonly size="md" />
  <TagChips tags={record.tags} nowrap />

  <div>
    <ButtonLink variant="primary" {href}>
      <IconEditFilled size={16} />
      <span>編輯</span>
    </ButtonLink>
    <Button variant="destructive" status={pending ? "pending" : undefined} onclick={onrevert}>
      <IconArrowBackUpDouble size={16} />
      <span>取消提交</span>
    </Button>
  </div>
</div>

<style>
  div.info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem;
    border-top: var(--border-style);
  }

  div.info > div {
    display: grid;
    grid-template-columns: 1fr 1fr;
    width: 100%;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
</style>
