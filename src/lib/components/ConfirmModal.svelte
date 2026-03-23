<script lang="ts">
  import Modal from "./Modal.svelte";
  import { ConfirmModal } from "$lib/ui/confirmModal.svelte.js";

  const ui = new ConfirmModal();
</script>

<Modal bind:open={ui.open} onclose={ui.handleModalClose} label="確認對話框">
  {#snippet children()}
    <div class="modal-title">確認</div>
    <div class="modal-body">{ui.message}</div>
    <div class="modal-actions">
      <button class="btn-outlined" onclick={ui.handleCancelClick}><span>取消</span></button>
      <button class="btn-primary" onclick={ui.handleConfirmClick}><span>確認</span></button>
    </div>
  {/snippet}
</Modal>

<style>
  .modal-title {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }

  .modal-body {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-bottom: 1.25rem;
    line-height: 1.6;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
