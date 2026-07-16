<script lang="ts">
  import { imgSrc } from "$lib/image/client";
  import { emptyDraft, isTouched, problemOf, type Draft } from "../inspector/draft";
  import StagedCardInfo from "./StagedCardInfo.svelte";

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
  <StagedCardInfo {filename} {touched} {problem} name={draft.name} rating={draft.rating} tagCount={draft.tags.length} />
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
</style>
