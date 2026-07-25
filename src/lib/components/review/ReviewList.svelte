<script lang="ts">
  import type { Snippet } from "svelte";
  import CircularProgress from "$lib/components/display/CircularProgress.svelte";

  type Props = {
    /** 是否正在送出中 */
    pending: boolean;
    /** 清單目前呈現的項目數 */
    listCount: number;
    /** 清單頂部的一列，通常是 `ReviewListHeader` */
    header?: Snippet;
    /** 清單底部的一列，通常是 `ReviewListFooter` */
    footer?: Snippet;
    /** 清單實際內容 */
    children: Snippet;
  };

  const { listCount, pending, header, footer, children }: Props = $props();
</script>

{#if listCount <= 0}
  <p>目前沒有任何未送出的操作。</p>
{:else}
  <div class="container">
    <ul inert={pending} aria-busy={pending}>
      {@render header?.()}
      {@render children()}
      {@render footer?.()}
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

  div.container > div {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: hsl(from var(--color-bg-popover) h s l / 0.85);
    backdrop-filter: blur(1px);
  }
</style>
