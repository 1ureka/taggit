<script lang="ts">
  import type { Tag } from "$lib/database";
  import { IconX, IconStarFilled } from "$lib/icons";

  type Props = {
    /** 要呈現的標籤資料 */
    tag: Tag;
    /** 是否為啟用中 */
    active: boolean;
    /** 點擊啟用事件 */
    onactive: () => void;
    /** 點擊移除事件 */
    onremove: () => void;
  };

  let { tag, active, onactive, onremove }: Props = $props();
</script>

<div class:active>
  <button type="button" title="設為合併後的名稱" aria-label={`把 ${tag.name} 設為合併後的名稱`} onclick={onactive}>
    <IconStarFilled size={11} />
  </button>

  <span class="ellipsis">{tag.name}</span>
  <span class="count">{tag.count}</span>

  <button type="button" title="移出這一堆" aria-label={`把 ${tag.name} 移出這一堆`} onclick={onremove}>
    <IconX size={11} />
  </button>
</div>

<style>
  div {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    max-width: 100%;
    padding: 0.1875rem 0.625rem;
    font: var(--font-body2);
    color: var(--color-text-muted);
    background: var(--color-bg-card);
    border: var(--border-style);
    border-radius: 9999px;
  }

  div.active {
    border-color: hsl(from var(--color-info) h s l / 0.6);
    color: var(--color-text);

    & > button[title="設為合併後的名稱"] {
      color: var(--color-info);
    }
  }

  button {
    display: inline-flex;
    align-items: center;
    padding: 0.0625rem;
    color: var(--color-text-muted);
    transition: color 0.15s ease;

    &:hover {
      color: var(--color-text);
    }
  }

  .count {
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }
</style>
