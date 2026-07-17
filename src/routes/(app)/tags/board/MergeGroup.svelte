<script lang="ts">
  import type { MergeGroup } from "../logic/changeset";
  import MergeChips from "./MergeChips.svelte";
  import MergeZone from "./MergeZone.svelte";
  import MergeHead from "./MergeHead.svelte";

  type Props = {
    /** 合併堆（canonical 由內部 TextInput 直接綁定修改） */
    group: MergeGroup;
    /** 合併後的預估張數（來自預覽端點；尚未取得時為 undefined） */
    mergedCount: number | undefined;
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
  <MergeHead
    selected={selectedCount}
    tags={group.members.map((v) => v.name)}
    active={group.canonical}
    count={mergedCount}
    onadd={onaddselected}
    {ondissolve}
    oninput={oncanonicalinput}
  />

  <MergeChips
    tags={group.members.map((v) => ({ name: v.name, count: v.count, meta: { hidden: v.hidden } }))}
    active={canonical}
    onactive={(tag) => onsetcanonical(tag.name)}
    onremove={(tag) => onremovemember(tag.name)}
  />
</MergeZone>
