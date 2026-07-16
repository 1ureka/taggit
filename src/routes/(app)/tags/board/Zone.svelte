<script lang="ts">
  import { IconX, IconExternalLink } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import type { TagSnapshot } from "../logic/changeset";

  type Props = {
    /** 區塊種類：刪除區 / 顯隱切換區 */
    kind: "delete" | "toggle";
    /** 已排入的標籤 */
    items: TagSnapshot[];
    /** 是否為當前拖放目標 */
    dropping: boolean;
    /** 已選取的標籤數（點選備援按鈕用） */
    selectedCount: number;
    /** 以區塊內全部標籤 AND 查詢回主頁的連結 */
    externalHref: string;
    /** 拖放目標事件 */
    ondragover: (e: DragEvent) => void;
    ondragleave: () => void;
    ondrop: (e: DragEvent) => void;
    /** 把已選取的標籤加入本區 */
    onaddselected: () => void;
    /** 把標籤移出本區 */
    onremove: (name: string) => void;
  };

  let {
    kind,
    items,
    dropping,
    selectedCount,
    externalHref,
    ondragover,
    ondragleave,
    ondrop,
    onaddselected,
    onremove,
  }: Props = $props();

  const label = $derived(kind === "delete" ? "刪除區" : "顯隱切換區");
  const description = $derived(
    kind === "delete" ? "拖進來的標籤會自所有圖片移除" : "可見的變隱藏、隱藏的恢復可見",
  );
</script>

<div
  class="zone"
  class:delete-zone={kind === "delete"}
  class:toggle-zone={kind === "toggle"}
  class:dropping
  role="group"
  aria-label={label}
  {ondragover}
  {ondragleave}
  {ondrop}
>
  <div class="head">
    <p><b>{label}</b>——{description}</p>
    <ButtonLink
      variant="ghost"
      padding="icon"
      href={externalHref}
      target="_blank"
      rel="noopener"
      status={items.length === 0 ? "disabled" : undefined}
      aria-label="以這些標籤 AND 查詢（新分頁）"
      {@attach tooltip({ content: "以這些標籤 AND 查詢（新分頁）" })}
    >
      <IconExternalLink size={14} />
    </ButtonLink>
    <Button variant="ghost" status={selectedCount === 0 ? "disabled" : undefined} onclick={onaddselected}>
      加入選取
    </Button>
  </div>

  <div class="items">
    {#each items as item (item.name)}
      <span class="member" class:del={kind === "delete"} class:tog={kind === "toggle"}>
        <span class="ellipsis">{item.name}</span>
        {#if kind === "toggle"}
          <span class="member-note">{item.hidden ? "→ 可見" : "→ 隱藏"}</span>
        {:else}
          <span class="member-note">{item.count}</span>
        {/if}
        <button
          type="button"
          class="member-x"
          title="移出{label}"
          aria-label={`把 ${item.name} 移出${label}`}
          onclick={() => onremove(item.name)}
        >
          <IconX size={11} />
        </button>
      </span>
    {:else}
      <span class="zone-empty">（空）</span>
    {/each}
  </div>
</div>

<style>
  .zone {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.625rem;
    border: 1.5px dashed var(--color-border);
    border-radius: calc(var(--border-radius) * 1.5);
    background: var(--color-bg);
    font: var(--font-body2);
    color: var(--color-text-muted);
    transition: all 0.15s ease;

    &.dropping {
      background: var(--color-bg-hover);
    }

    &.delete-zone.dropping {
      border-color: var(--color-error);
    }

    &.toggle-zone.dropping {
      border-color: var(--color-warning);
    }
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.375rem;

    & > p {
      flex: 1;
      min-width: 0;
    }
  }

  .items {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .zone-empty {
    font: var(--font-caption);
    color: var(--color-text-muted);
  }

  .member {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    max-width: 100%;
    padding: 0.125rem 0.375rem;
    font: var(--font-caption);
    color: var(--color-text-muted);
    background: var(--color-bg-card);
    border: var(--border-style);
    border-radius: 9999px;

    &.del {
      border-color: hsl(from var(--color-error) h s l / 0.5);
      color: var(--color-error);
    }

    &.tog {
      border-color: hsl(from var(--color-warning) h s l / 0.5);
    }
  }

  .member-note {
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }

  .member-x {
    display: inline-flex;
    align-items: center;
    padding: 0.0625rem;
    color: var(--color-text-muted);
    transition: color 0.15s ease;

    &:hover {
      color: var(--color-text);
    }
  }
</style>
