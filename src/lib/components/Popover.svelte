<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import type { Placement } from "@floating-ui/dom";
  import { fly } from "svelte/transition";
  import { Popover } from "$lib/ui/popover.svelte.js";

  interface Props extends HTMLAttributes<HTMLDivElement> {
    /** 開關狀態（由消費端控制） */
    open: boolean;
    /** 參照元素（定位錨點） */
    reference: HTMLElement | undefined;
    /** 內容 */
    children: Snippet;
    /** 偏好位置，預設 'bottom-start' */
    placement?: Placement;
    /** 是否匹配參照元素寬度，預設 true */
    matchWidth?: boolean;
  }

  let { open, reference, children, placement = "bottom-start", matchWidth = true, ...rest }: Props = $props();

  const ui = new Popover({
    get open() {
      return open;
    },
    get reference() {
      return reference;
    },
    get placement() {
      return placement;
    },
    get matchWidth() {
      return matchWidth;
    },
  });
</script>

<div
  bind:this={ui.popoverEl}
  popover="manual"
  style:left="{ui.coords.x}px"
  style:top="{ui.coords.y}px"
  style:width={matchWidth ? `${ui.coords.width}px` : undefined}
  {...rest}
>
  {#if open}
    <div transition:fly={{ duration: 120, opacity: 0, y: -8 }} onoutroend={ui.handleOutroEnd}>
      {@render children()}
    </div>
  {/if}
</div>

<style>
  div[popover="manual"] {
    position: fixed;
    border: none;
    outline: none;
    background: transparent;
    margin: 0;
    padding: 0;
    overflow: visible;
  }

  div[popover="manual"] > div {
    max-height: min(14rem, 100dvh);
    padding: 0.25rem 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--bg-card);
    border: var(--border-style);
    border-radius: var(--radius);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
  }
</style>
