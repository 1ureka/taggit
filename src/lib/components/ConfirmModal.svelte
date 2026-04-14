<script lang="ts">
  import Modal from "./Modal.svelte";
  import { ConfirmModal } from "$lib/ui/confirmModal.svelte.js";

  const ui = new ConfirmModal();
</script>

<Modal bind:open={ui.open} onclose={ui.handleModalClose} label="確認對話框">
  {#snippet children()}
    <h2>{ui.title}</h2>
    <p>{ui.message}</p>
    <div class="actions">
      <button type="button" class="btn-outlined" onclick={ui.handleCancelClick}><span>取消</span></button>
      <button type="button" class="btn-primary" onclick={ui.handleConfirmClick}><span>{ui.action}</span></button>
    </div>
  {/snippet}
</Modal>

<style>
  h2 {
    font-size: var(--font-size-title2);
    font-weight: 600;
    margin-bottom: 0.75rem;
  }

  p {
    font-size: var(--font-size-body1);
    color: var(--text-muted);
    margin-bottom: 1.25rem;
    line-height: 1.6;
    white-space: pre-line;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
