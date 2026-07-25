<script lang="ts">
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconX } from "$lib/icons";

  import Button from "$lib/components/actions/Button.svelte";
  import Chip from "$lib/components/display/Chip.svelte";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";

  type BatchProps = {
    variant: "batch";
    /** 全選框的狀態 */
    checkedAll: string;
    /** 勾選的總數 */
    checkedCount: number;
    /** 全選勾的點擊事件 */
    ontoggleall: () => void;
    /** 關閉事件 */
    onclose: () => void;
  };

  type SingleProps = {
    variant: "single";
    /** 當前項目的名稱 */
    title: string;
    /** 當前項目的指標 */
    index: number;
    /** 項目總數 */
    total: number;
    /** 關閉事件 */
    onclose: () => void;
  };

  const props: { variant: null } | BatchProps | SingleProps = $props();
</script>

<header>
  {#if props.variant === "batch"}
    <div style="flex: 1;">
      <Checkbox
        checked={props.checkedAll === "checked"}
        indeterminate={props.checkedAll === "indeterminate"}
        label="全選圖片"
        onchange={props.ontoggleall}
      />
    </div>

    <Chip variant="outlined" style="font: var(--font-caption);">{`已選取 ${props.checkedCount} 張`}</Chip>

    <Button
      variant="ghost"
      padding="icon"
      aria-label="取消多選"
      onclick={props.onclose}
      {@attach tooltip({ content: "取消多選" })}
    >
      <IconX size={16} />
    </Button>
  {:else if props.variant === "single"}
    <h3 class="ellipsis" title={props.title}>{props.title}</h3>

    <Chip variant="outlined" style="font: var(--font-caption);">{`${props.index} / ${props.total}`}</Chip>

    <Button
      variant="ghost"
      padding="icon"
      aria-label="關閉表單"
      onclick={props.onclose}
      {@attach tooltip({ content: "關閉表單" })}
    >
      <IconX size={16} />
    </Button>
  {/if}
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0px 0.75rem;
    height: 2.5rem;
    min-height: 2.5rem;
    border-bottom: var(--border-style);
  }

  h3 {
    flex: 1;
    font: var(--font-body2);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }
</style>
