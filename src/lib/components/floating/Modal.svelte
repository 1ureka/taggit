<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";
  import { scale } from "svelte/transition";
  import { Modal } from "$lib/components/floating/modal.core.svelte";

  interface Props extends HTMLAttributes<HTMLDialogElement> {
    /** 開關狀態 */
    open: boolean;
    /** 關閉請求回呼，由 backdrop 點擊、Escape 鍵觸發 */
    onclose?: () => void;
    /** 對話框內容 */
    children: Snippet;
    /** 對話框內容容器的 props */
    containerProps?: HTMLAttributes<HTMLDivElement>;
  }

  let { open, onclose, children, containerProps, ...rest }: Props = $props();

  const modal = new Modal({
    get open() {
      return open;
    },
    get onclose() {
      return onclose;
    },
  });
</script>

<dialog
  bind:this={modal.dialogEl}
  class="modal"
  data-open={open}
  onclick={modal.handleClick}
  oncancel={modal.handleCancel}
  {...rest}
>
  {#if open}
    <div
      class="modal-content"
      in:scale={{ duration: 150, start: 0.95 }}
      out:scale={{ duration: 150, start: 0.95 }}
      onoutroend={modal.handleOutroEnd}
      {...containerProps}
    >
      {@render children()}
    </div>
  {/if}
</dialog>

<style>
  .modal {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 0;
    border: none;
    outline: none;
    background-color: transparent;
    overflow: visible;
  }

  .modal::backdrop {
    background-color: oklch(0 0 0 / 0.5);
    backdrop-filter: blur(2px);
    opacity: 1;
    transition: opacity 0.15s ease;
  }

  .modal[data-open="false"]::backdrop {
    opacity: 0;
  }

  @starting-style {
    .modal[open]::backdrop {
      opacity: 0;
    }
  }

  /* --- */

  .modal-content {
    max-width: min(90dvw, 480px);
    max-height: min(85dvh, 640px);
    overflow-y: auto;
    background-color: var(--color-bg-popover);
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 2.5);

    :global([data-theme="light"]) & {
      border-color: transparent;
    }
  }
</style>
