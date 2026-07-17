<script lang="ts">
  import { IconX } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import TextInput from "$lib/components/inputs/TextInput.svelte";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import type { MergeGroup } from "../logic/changeset";
  import GroupLink from "./GroupLink.svelte";
  import MergeChips from "./MergeChips.svelte";
  import MergeZone from "./MergeZone.svelte";

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

<MergeZone label={canonical} {dropping} {ondragover} {ondragleave} {ondrop}>
  <div class="head">
    <TextInput
      label="合併後的名稱"
      labelHidden
      maxlength={50}
      bind:value={group.canonical}
      oninput={oncanonicalinput}
      // 這裡應該改用 helperText，請參考 `src\routes\lab\(showcase)\(inputs)\type-field\+page` use case
      title="合併後的名稱（點成員上的星星可直接指定）"
      style="flex: 1; min-width: 0;"
    />
    <span class="merged-count" class:pending={previewPending} title="合併後的預估張數">
      → {mergedCount ?? "…"} 張
    </span>
    <GroupLink names={group.members.map((v) => v.name)} />
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

  <MergeChips
    tags={group.members.map((v) => ({ name: v.name, count: v.count, meta: { hidden: v.hidden } }))}
    active={canonical}
    onactive={(tag) => onsetcanonical(tag.name)}
    onremove={(tag) => onremovemember(tag.name)}
  />

  <Button variant="ghost" status={selectedCount === 0 ? "disabled" : undefined} onclick={onaddselected}>
    加入選取（{selectedCount}）
  </Button>
</MergeZone>

<style>
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
</style>
