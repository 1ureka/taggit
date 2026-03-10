<script lang="ts">
  import type { Snippet } from "svelte";
  import { createModal } from "$lib/client/modal.svelte.js";

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

  const ui = createModal({
    get open() {
      return open;
    },
    get onclose() {
      return onclose;
    },
  });
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-overlay" onclick={ui.handleOverlayClick} onkeydown={ui.handleOverlayKeydown}>
    <div class="modal scale-in" role="dialog" aria-modal="true" aria-label={label} bind:this={ui.dialogEl}>
      {@render children()}
    </div>
  </div>
{/if}
