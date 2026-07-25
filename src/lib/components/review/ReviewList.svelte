<script lang="ts">
  import type { Snippet } from "svelte";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";
  import CircularProgress from "$lib/components/display/CircularProgress.svelte";

  type Props = {
    /** 是否正在送出中 */
    pending: boolean;
    /** 全選勾的狀態 */
    checkedAll?: "checked" | "indeterminate" | string;
    /** 清單項目總數 */
    totalCount: number;
    /** 可勾選的總數 */
    checkableCount: number;
    /** 勾選的總數 */
    checkedCount: number;
    /** 全選勾的點擊事件 */
    ontoggleall: () => void;
    /** 清單實際內容 */
    children: Snippet;
  };

  const { checkedAll, totalCount, checkableCount, checkedCount, pending, ontoggleall, children }: Props = $props();
</script>

{#snippet toggleAll()}
  <li>
    <Checkbox
      checked={checkedAll === "checked"}
      indeterminate={checkedAll === "indeterminate"}
      status={checkableCount === 0 ? "disabled" : "default"}
      onchange={ontoggleall}
      aria-label="全選可送出的操作"
    />
    <span>全選</span>
    <span>{checkedCount} / {checkableCount} 可送出操作已選取</span>
  </li>
{/snippet}

{#if totalCount <= 0}
  <p>目前沒有任何未送出的操作。</p>
{:else}
  <div class="container">
    <ul inert={pending} aria-busy={pending}>
      {@render toggleAll()}
      {@render children()}
    </ul>

    {#if pending}
      <div>
        <CircularProgress size={24} color="var(--color-text-muted)" />
      </div>
    {/if}
  </div>
{/if}

<style>
  div.container {
    position: relative;
  }

  p {
    font: var(--font-body2);
    color: var(--color-text-muted);
    padding: 5rem 1rem;
    text-align: center;
  }

  div.container > ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    max-height: 50vh;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.5rem 1rem;
    background-color: var(--color-bg-popover);
  }

  li {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.25rem 0px;
  }

  li > span:nth-of-type(1) {
    font: var(--font-body2);
  }

  li > span:nth-of-type(2) {
    margin-left: auto;
    font: var(--font-caption);
    color: var(--color-text-muted);
  }

  div.container > div {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: hsl(from var(--color-bg-popover) h s l / 0.85);
    backdrop-filter: blur(1px);
  }
</style>
