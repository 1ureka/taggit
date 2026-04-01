<script lang="ts">
  import type { Snippet } from "svelte";
  import { fade, fly, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { Modal } from "$lib/ui/modal.svelte.js";

  type Props = {
    /** 是否開啟 Modal */
    open: boolean;
    /** 當 Modal 關閉時觸發的回調 */
    onclose: () => void;
    /** Modal 內容 */
    children: Snippet;
    /** Modal 標籤，用於輔助技術描述對話框內容 */
    label?: string;
    /** Modal 樣式 */
    style?: string;
    /** Modal transition，用於自訂過渡效果 */
    transition?: "scale" | "fly";
  };

  let { open = $bindable(), onclose, children, label = "對話框", style, transition = "scale" }: Props = $props();

  /** 用於避免重複寫 transition 的包裝 */
  function dynamicTransition(node: HTMLElement, options: { type: "scale" | "fly" }) {
    if (options.type === "scale") {
      return scale(node, { duration: 200, start: 0.95, easing: cubicOut });
    }
    return fly(node, { duration: 200, y: -35, easing: cubicOut });
  }

  const ui = new Modal({
    get open() {
      return open;
    },
    get onclose() {
      return onclose;
    },
  });
</script>

{#if open}
  <div
    class="modal-overlay"
    role="presentation"
    tabindex="-1"
    bind:this={ui.overlayEl}
    onclick={ui.handleOverlayClick}
    onkeydown={ui.handleOverlayKeydown}
    transition:fade={{ duration: 150 }}
  >
    <div
      class="modal"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      bind:this={ui.dialogEl}
      transition:dynamicTransition={{ type: transition }}
      {style}
    >
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    backdrop-filter: blur(3px) brightness(0.75);
    display: grid;
    place-items: center;
    z-index: var(--z-modal);
  }

  .modal {
    background: var(--bg-card);
    border: var(--border-style);
    border-radius: calc(var(--radius) * 2);
    padding: 1.5rem;
    max-width: 28rem;
    width: 90%;
    max-height: 80vh;
    overflow: auto;
  }
</style>
