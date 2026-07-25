<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import { IconChevronDown, IconChevronRightPipe } from "$lib/icons";

  type Props = {
    /** 目前批次 1-based，對外一律以「頁」稱呼 */
    batch: number;
    /** 總批次數，`<= 1` 時整列不出現 */
    batches: number;
    /** 跳到第一批 */
    onfirst: () => void;
    /** 跳到上一批 */
    onprev: () => void;
    /** 跳到下一批 */
    onnext: () => void;
    /** 跳到最後一批 */
    onlast: () => void;
  };

  const { batch, batches, onfirst, onprev, onnext, onlast }: Props = $props();

  const atFirst = $derived(batch <= 1);
  const atLast = $derived(batch >= batches);
</script>

{#if batches > 1}
  <li>
    <Button
      variant="ghost"
      padding="icon"
      aria-label="第一頁"
      status={atFirst ? "disabled" : undefined}
      onclick={onfirst}
    >
      <IconChevronRightPipe size={16} style="transform: rotate(180deg);" />
    </Button>
    <Button variant="ghost" padding="icon" aria-label="上一頁" status={atFirst ? "disabled" : undefined} onclick={onprev}>
      <IconChevronDown size={16} style="transform: rotate(90deg);" />
    </Button>

    <span>第 {batch} / {batches} 頁</span>

    <Button variant="ghost" padding="icon" aria-label="下一頁" status={atLast ? "disabled" : undefined} onclick={onnext}>
      <IconChevronDown size={16} style="transform: rotate(-90deg);" />
    </Button>
    <Button variant="ghost" padding="icon" aria-label="最後一頁" status={atLast ? "disabled" : undefined} onclick={onlast}>
      <IconChevronRightPipe size={16} />
    </Button>
  </li>
{/if}

<style>
  li {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.25rem 0px;
  }

  span {
    margin: 0 0.5rem;
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }
</style>
