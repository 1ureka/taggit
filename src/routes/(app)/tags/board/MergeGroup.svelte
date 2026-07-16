<script lang="ts">
  import { IconX, IconStarFilled, IconExternalLink } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
  import TextInput from "$lib/components/inputs/TextInput.svelte";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import type { MergeGroup } from "../logic/changeset";

  type Props = {
    /** 合併堆（canonical 由內部 TextInput 直接綁定修改） */
    group: MergeGroup;
    /** 合併後的預估張數（來自預覽端點；尚未取得時為 undefined） */
    mergedCount: number | undefined;
    /** 預估是否更新中 */
    previewPending: boolean;
    /** 是否為當前拖放目標 */
    dropping: boolean;
    /** 已選取的標籤數（點選備援按鈕用） */
    selectedCount: number;
    /** 以全部成員 AND 查詢回主頁的連結 */
    externalHref: string;
    /** 拖放目標事件 */
    ondragover: (e: DragEvent) => void;
    ondragleave: () => void;
    ondrop: (e: DragEvent) => void;
    /** 把已選取的標籤加入這一堆 */
    onaddselected: () => void;
    /** 解散這一堆 */
    ondissolve: () => void;
    /** 指定合併後的名稱 */
    onsetcanonical: (name: string) => void;
    /** 把成員移出這一堆 */
    onremovemember: (name: string) => void;
    /** canonical 輸入變動（觸發預估更新） */
    oncanonicalinput: () => void;
  };

  let {
    group,
    mergedCount,
    previewPending,
    dropping,
    selectedCount,
    externalHref,
    ondragover,
    ondragleave,
    ondrop,
    onaddselected,
    ondissolve,
    onsetcanonical,
    onremovemember,
    oncanonicalinput,
  }: Props = $props();

  const canonical = $derived(group.canonical.trim());
</script>

<div
  class="zone group"
  class:dropping
  role="group"
  aria-label={`合併堆 ${canonical}`}
  {ondragover}
  {ondragleave}
  {ondrop}
>
  <div class="head">
    <TextInput
      label="合併後的名稱"
      labelHidden
      maxlength={50}
      bind:value={group.canonical}
      oninput={oncanonicalinput}
      title="合併後的名稱（點成員上的星星可直接指定）"
      style="flex: 1; min-width: 0;"
    />
    <span class="merged-count" class:pending={previewPending} title="合併後的預估張數">
      → {mergedCount ?? "…"} 張
    </span>
    <ButtonLink
      variant="ghost"
      padding="icon"
      href={externalHref}
      target="_blank"
      rel="noopener"
      aria-label="以這些標籤 AND 查詢（新分頁）"
      {@attach tooltip({ content: "以這些標籤 AND 查詢（新分頁）" })}
    >
      <IconExternalLink size={14} />
    </ButtonLink>
    <Button
      variant="ghost"
      padding="icon"
      aria-label="解散這一堆"
      onclick={ondissolve}
      {@attach tooltip({ content: "解散這一堆" })}
    >
      <IconX size={14} />
    </Button>
  </div>

  <div class="members">
    {#each group.members as member (member.name)}
      <span class="member" class:is-canonical={member.name === canonical}>
        <button
          type="button"
          class="member-star"
          title="設為合併後的名稱"
          aria-label={`把 ${member.name} 設為合併後的名稱`}
          onclick={() => onsetcanonical(member.name)}
        >
          <IconStarFilled size={11} />
        </button>
        <span class="ellipsis">{member.name}</span>
        <span class="member-count">{member.count}</span>
        <button
          type="button"
          class="member-x"
          title="移出這一堆"
          aria-label={`把 ${member.name} 移出這一堆`}
          onclick={() => onremovemember(member.name)}
        >
          <IconX size={11} />
        </button>
      </span>
    {/each}
  </div>

  <Button variant="ghost" status={selectedCount === 0 ? "disabled" : undefined} onclick={onaddselected}>
    加入選取（{selectedCount}）
  </Button>
</div>

<style>
  .zone {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 0.625rem;
    border: 1.5px solid hsl(from var(--color-info) h s l / 0.45);
    border-radius: calc(var(--border-radius) * 1.5);
    background: var(--color-bg);
    transition: all 0.15s ease;

    &.dropping {
      border-color: var(--color-info);
      background: var(--color-bg-hover);
    }
  }

  .head {
    display: flex;
    align-items: center;
    align-self: stretch;
    gap: 0.375rem;
  }

  .merged-count {
    flex-shrink: 0;
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
    white-space: nowrap;
    transition: opacity 0.15s ease;

    &.pending {
      opacity: 0.5;
    }
  }

  .members {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
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

    &.is-canonical {
      border-color: hsl(from var(--color-info) h s l / 0.6);
      color: var(--color-text);

      & > .member-star {
        color: var(--color-info);
      }
    }
  }

  .member-star,
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

  .member-count {
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }
</style>
