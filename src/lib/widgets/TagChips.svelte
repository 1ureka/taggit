<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { IconAlertTriangleFilled } from "$lib/icons";
  import Chip from "$lib/components/display/Chip.svelte";

  type TagLike = string | { name: string; count?: number; hidden?: boolean };

  type Props = Omit<HTMLAttributes<HTMLDivElement>, "onselect"> & {
    /** 標籤列表；物件形式可帶 count 與 hidden 徽章 */
    tags: TagLike[];
    /** 單行呈現，超出以 mask 漸屈收尾 */
    nowrap?: boolean;
    /** 提供時 chips 可點擊；點擊行為（如導向篩選）由呼叫端決定 */
    onselect?: (name: string) => void;
  };

  let { tags, nowrap = false, onselect, ...rest }: Props = $props();

  const normalized = $derived(tags.map((t) => (typeof t === "string" ? { name: t } : t)));
</script>

<div class={{ tags: true, nowrap }} {...rest}>
  {#each normalized as tag (tag.name)}
    <Chip onclick={onselect ? () => onselect(tag.name) : undefined} style={nowrap ? "flex-shrink: 0;" : undefined}>
      <span class="ellipsis">{tag.name}</span>
      {#if tag.hidden || tag.count !== undefined}
        <span class="tag-meta">
          {#if tag.hidden}
            <IconAlertTriangleFilled size="0.75rem" />
          {/if}
          {#if tag.count !== undefined}
            <span class="tag-count">{tag.count}</span>
          {/if}
        </span>
      {/if}
    </Chip>
  {/each}
</div>

<style>
  .tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.375rem;
    max-width: 100%;
  }

  .tag-meta {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--color-text-muted);
  }

  .tag-count {
    font: var(--font-caption);
    font-family: var(--font-family-mono);
  }

  .tags.nowrap {
    width: 100%;
    flex-wrap: nowrap;
    overflow: hidden;
  }

  @supports (mask-image: linear-gradient(to right, black, transparent)) {
    .tags.nowrap {
      mask-image: linear-gradient(to right, black calc(100% - 3rem), transparent);
    }
  }
</style>
