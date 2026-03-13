<script lang="ts">
  import type { Snippet } from "svelte";
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
  };

  let { open = $bindable(), onclose, children, label = "對話框" }: Props = $props();

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
  <div class="modal-overlay" role="presentation" onclick={ui.handleOverlayClick} onkeydown={ui.handleOverlayKeydown}>
    <div class="modal scale-in" role="dialog" aria-modal="true" aria-label={label} bind:this={ui.dialogEl}>
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: var(--z-modal);
    animation: fadeIn 0.15s ease-out;
  }

  .modal {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 2);
    padding: 1.5rem;
    max-width: 28rem;
    width: 90%;
  }
</style>
