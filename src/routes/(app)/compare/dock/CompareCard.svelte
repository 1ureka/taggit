<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import { imgSrc } from "$lib/image/client";

  import { IconEditFilled, IconPinnedOff, IconArrowBackUpDouble } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
  import ImageCanvas from "$lib/components/display/ImageCanvas.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";
  import TagChips from "$lib/widgets/TagChips.svelte";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";

  type Props = {
    /** 卡片顯示的圖片紀錄 */
    record: ImageWithId;
    /** 前往 editor 的連結（帶當下篩選參數） */
    editorHref: string;
    /** 全頁共用的操作鎖 */
    pending: boolean;
    /** 取消釘選（自畫布移除） */
    onunpin: () => void;
    /** 取消提交（退回暫存區） */
    ondelete: () => void;
  };

  let { record, editorHref, pending, onunpin, ondelete }: Props = $props();
</script>

<section class="card" aria-label={record.name}>
  <header>
    <h3 class="ellipsis">{record.name}</h3>
    <span class="file ellipsis" title={record.id}>{record.id}</span>
    <Button
      variant="ghost"
      padding="icon"
      aria-label="取消釘選 {record.id}"
      onclick={onunpin}
      {@attach tooltip({ content: "取消釘選" })}
    >
      <IconPinnedOff size={16} />
    </Button>
  </header>

  <div class="canvas">
    <ImageCanvas resetKey={record.id}>
      <img src={imgSrc(record.id, "xl")} alt={record.name} draggable="false" />
    </ImageCanvas>
  </div>

  <div class="info">
    <Rating value={record.rating} readonly size="sm" />
    <TagChips tags={record.tags} nowrap />

    <div class="actions">
      <ButtonLink variant="primary" href={editorHref}>
        <IconEditFilled size={16} />
        <span>編輯</span>
      </ButtonLink>
      <Button variant="destructive" status={pending ? "disabled" : undefined} onclick={ondelete}>
        <IconArrowBackUpDouble size={16} />
        <span>取消提交</span>
      </Button>
    </div>
  </div>
</section>

<style>
  .card {
    flex: 1 1 0;
    min-width: 320px;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-card);
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 2);
    overflow: hidden;
  }

  /* ─── header：名稱＋檔名＋取消釘選 ─── */

  .card > header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.375rem 0.375rem 0.75rem;
    border-bottom: var(--border-style);

    & > h3 {
      flex-shrink: 1;
      min-width: 0;
      font: var(--font-body1);
      font-weight: 500;
    }

    & > .file {
      flex: 1;
      min-width: 0;
      font: var(--font-caption);
      font-family: var(--font-family-mono);
      color: var(--color-text-muted);
    }
  }

  /* ─── 圖片區：填滿扣除其餘列的剩餘高度 ─── */

  .canvas {
    flex: 1;
    min-height: 160px;
    background: var(--color-bg);

    & img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      pointer-events: none;
    }
  }

  /* ─── info：等高（名稱在 header、標籤單行 mask，不允許換行撐高）─── */

  .info {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.75rem;
    border-top: var(--border-style);
  }

  .actions {
    display: flex;
    align-self: stretch;
    gap: 0.5rem;
    margin-top: 0.25rem;

    & > :global(*) {
      flex: 1;
    }
  }
</style>
