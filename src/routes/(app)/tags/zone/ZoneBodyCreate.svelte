<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";

  type Props = {
    /** 目前選取標籤的數量 */
    selected: number;
    /** 點擊創建堆事件 */
    oncreate: () => void;
  };

  let { selected, oncreate }: Props = $props();
</script>

<p>拖曳到這裡建立<b>合併堆</b></p>

<Button
  variant="outlined"
  status={selected === 0 ? "disabled" : undefined}
  onclick={oncreate}
  style="font: var(--font-caption)"
>
  從選取中建立
</Button>
