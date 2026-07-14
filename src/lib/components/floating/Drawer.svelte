<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { Drawer } from "$lib/components/floating/drawer.core.svelte";

  interface Props extends HTMLAttributes<HTMLDialogElement> {
    /** 開關狀態 */
    open: boolean;
    /** 抽屜滑入方向，預設 'right' */
    side?: "top" | "bottom" | "left" | "right";
    /**
     * 關閉請求回呼。
     * 由 backdrop 點擊、Escape 鍵、拖曳過閾值三種情境觸發。
     * 組件本身不直接修改 open，遵循受控元件哲學。
     */
    onclose?: () => void;
    /** 抽屜內容 */
    children: Snippet;
    /**
     * 僅 side='top' | 'bottom' 有效。
     * 限制抽屜在水平方向的最大寬度（自動水平居中）。
     */
    maxWidth?: string;
  }

  let { open, side = "right", onclose, children, maxWidth = "720px", ...rest }: Props = $props();

  const drawer = new Drawer({
    get open() {
      return open;
    },
    get side() {
      return side;
    },
    get onclose() {
      return onclose;
    },
  });
</script>

<dialog
  bind:this={drawer.dialogEl}
  class="drawer"
  data-side={side}
  style:--spring={drawer.spring.current}
  style:--max-width={side === "top" || side === "bottom" ? maxWidth : undefined}
  style:pointer-events={drawer.interactable ? "auto" : "none"}
  onclick={drawer.handleClick}
  onkeydown={(e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onclose?.();
    }
  }}
  {...rest}
>
  <div bind:this={drawer.innerEl} class="drawer-inner">
    <div
      class="drawer-handle"
      aria-hidden="true"
      onpointerdown={drawer.handlePointerDown}
      onpointermove={drawer.handlePointerMove}
      onpointerup={drawer.handlePointerUp}
      onpointercancel={drawer.handlePointerCancel}
    >
      <span></span>
    </div>

    <div class="drawer-content">
      {@render children()}
    </div>
  </div>
</dialog>

<style>
  .drawer {
    position: fixed;
    border: none;
    outline: none;
    margin: 0;
    padding: 0;
    max-height: none;
    max-width: none;
    will-change: transform;
    background-color: var(--color-bg-popover);
    border: var(--border-style);
    overflow: visible;
    --drawer-radius: calc(var(--border-radius) * 2.5);
  }

  .drawer::backdrop {
    --opacity: clamp(0, calc(var(--spring, 0) * 0.5), 0.75);
    background-color: oklch(0 0 0 / var(--opacity));
  }

  /* --- */
  /* positioning */

  .drawer[data-side="right"] {
    top: 0;
    left: 100dvw;
    height: 100dvh;
    width: max-content;
    min-width: 280px;
    border-right: none;
    border-radius: var(--drawer-radius) 0 0 var(--drawer-radius);
    transform: translateX(calc(var(--spring) * -100%));
  }

  .drawer[data-side="left"] {
    top: 0;
    left: 0;
    height: 100dvh;
    width: max-content;
    min-width: 280px;
    border-left: none;
    border-radius: 0 var(--drawer-radius) var(--drawer-radius) 0;
    transform: translateX(calc((var(--spring) - 1) * 100%));
  }

  .drawer[data-side="bottom"] {
    top: 100dvh;
    left: 0;
    width: 100dvw;
    height: max-content;
    max-width: min(var(--max-width, 480px), 100dvw);
    margin-inline: auto;
    border-bottom: none;
    border-radius: var(--drawer-radius) var(--drawer-radius) 0 0;
    transform: translateY(calc(var(--spring) * -100%));
  }

  .drawer[data-side="top"] {
    top: 0;
    left: 0;
    width: 100dvw;
    height: max-content;
    max-width: min(var(--max-width, 480px), 100dvw);
    margin-inline: auto;
    border-top: none;
    border-radius: 0 0 var(--drawer-radius) var(--drawer-radius);
    transform: translateY(calc((var(--spring) - 1) * 100%));
  }

  /* --- */
  /* over extended gap fill */

  .drawer::before {
    content: "";
    position: absolute;
    width: 100%;
    height: 100%;
    background-color: var(--color-bg-popover);
    pointer-events: none;
    box-sizing: content-box;
  }

  .drawer[data-side="right"]::before {
    width: 100dvw;
    top: -2px;
    left: calc(100% - 5px);
    border-top: var(--border-style);
    border-bottom: var(--border-style);
  }

  .drawer[data-side="left"]::before {
    width: 100dvw;
    top: -2px;
    right: calc(100% - 5px);
    border-top: var(--border-style);
    border-bottom: var(--border-style);
  }

  .drawer[data-side="bottom"]::before {
    height: 100dvh;
    left: -2px;
    top: calc(100% - 5px);
    border-left: var(--border-style);
    border-right: var(--border-style);
  }

  .drawer[data-side="top"]::before {
    height: 100dvh;
    left: -2px;
    bottom: calc(100% - 5px);
    border-left: var(--border-style);
    border-right: var(--border-style);
  }

  /* --- */
  /* layout */

  .drawer-inner {
    display: flex;
    flex: 1;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .drawer[data-side="right"] > .drawer-inner {
    flex-direction: row;
  }
  .drawer[data-side="left"] > .drawer-inner {
    flex-direction: row-reverse;
  }
  .drawer[data-side="bottom"] > .drawer-inner {
    flex-direction: column;
  }
  .drawer[data-side="top"] > .drawer-inner {
    flex-direction: column-reverse;
  }

  /* --- */

  .drawer-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem;
    cursor: grab;
    touch-action: none;
    flex-shrink: 0;

    &:active {
      cursor: grabbing;
    }
  }

  .drawer[data-side="left"] .drawer-handle,
  .drawer[data-side="right"] .drawer-handle {
    padding: 0.75rem 0.5rem;
  }

  .drawer-handle > span {
    display: block;
    width: 2rem;
    height: 0.25rem;
    border-radius: 9999px;
    background-color: currentColor;
    opacity: 0.3;
  }

  .drawer[data-side="left"] .drawer-handle > span,
  .drawer[data-side="right"] .drawer-handle > span {
    width: 0.25rem;
    height: 2rem;
  }

  /* --- */

  .drawer-content {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
</style>
