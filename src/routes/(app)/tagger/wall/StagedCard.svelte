<script lang="ts">
  import { imgSrc } from "$lib/image/client";
  import { IconCheckFilled, IconAlertCircleFilled } from "$lib/icons";
  import { emptyDraft, isTouched, problemOf, type Draft } from "../inspector/draft";

  type Props = {
    /** 暫存圖片的檔名 */
    filename: string;
    /** 暫存圖片的本地草稿 */
    drafts: Record<string, Draft>;
    /** 目前編輯中的暫存圖片 */
    activeFile: string | null;
    /** 點擊卡片事件 */
    onselect: (file: string) => void;
  };

  let { filename, drafts, activeFile, onselect }: Props = $props();

  const draft = $derived(drafts[filename] ?? emptyDraft());
  const touched = $derived(isTouched(draft));
  const problem = $derived(problemOf(draft));
</script>

<button type="button" class:active={filename === activeFile} onclick={() => onselect(filename)}>
  <img src={imgSrc(filename, "sm")} alt={filename} loading="lazy" />

  <div class="info">
    <span class="name ellipsis">{filename}</span>
    {#if touched}
      <span class="mark" title={problem ?? "可提交"}>
        {#if problem === null}
          <IconCheckFilled size={14} color="var(--color-success)" />
        {:else}
          <IconAlertCircleFilled size={14} color="var(--color-warning)" />
        {/if}
      </span>
    {/if}
  </div>

  {#if touched}
    <div class="draft">
      {#if draft.rating > 0}<span>★{draft.rating}</span>{/if}
      {#if draft.tags.length > 0}<span>{draft.tags.length} 標籤</span>{/if}
      {#if draft.name}<span class="ellipsis">「{draft.name.trim()}」</span>{/if}
    </div>
  {/if}
</button>

<style>
  button {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    border: var(--border-style);
    border-radius: var(--border-radius);
    background: var(--color-bg-card);
    overflow: hidden;
    text-align: left;
    transition: all 0.15s ease;

    &:hover {
      border-color: var(--color-border-hover);
    }

    &.active {
      border-color: var(--color-accent);
    }

    &:active {
      transition: all 0.03s ease;
      transform: scale(0.98);
    }
  }

  img {
    display: block;
    width: 100%;
    flex: 1;
    min-height: 0;
    object-fit: cover;
    background: var(--color-bg);
  }

  .info {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem;

    & > .name {
      flex: 1;
      min-width: 0;
      font: var(--font-caption);
      color: var(--color-text-muted);
    }

    & > .mark {
      display: inline-flex;
      flex-shrink: 0;
    }
  }

  .draft {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    padding: 0 0.5rem 0.375rem;
    font: var(--font-caption);
    color: var(--color-text-muted);

    & > span:not(:nth-of-type(3)) {
      flex-shrink: 0;
    }
  }
</style>
