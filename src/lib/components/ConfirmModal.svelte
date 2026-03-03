<script lang="ts">
  let {
    message,
    onconfirm,
    oncancel,
  }: {
    message: string;
    onconfirm: () => void;
    oncancel: () => void;
  } = $props();

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) oncancel();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") oncancel();
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="modal-overlay" onclick={handleOverlayClick}>
  <div class="modal scale-in">
    <div class="modal-title">確認</div>
    <div class="modal-body">{message}</div>
    <div class="modal-actions">
      <button class="btn" onclick={oncancel}>取消</button>
      <button class="btn btn-primary" onclick={onconfirm}>確認</button>
    </div>
  </div>
</div>
