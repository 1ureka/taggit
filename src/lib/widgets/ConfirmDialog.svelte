<script lang="ts">
  import Modal from "$lib/components/floating/Modal.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import { CONFIRM_REQUEST, type ConfirmRequestPayload } from "$lib/widgets/confirm-events";

  let open = $state(false);
  let message = $state("");
  let title = $state("確認");
  let action = $state("確認");

  let resolveRef: ((value: boolean) => void) | null = null;

  $effect(() => {
    const onRequest = (e: Event) => {
      const detail = (e as CustomEvent<ConfirmRequestPayload>).detail;
      // 若前一個請求尚未被回應（理論上不會發生），以取消收尾避免懸置的 Promise
      resolveRef?.(false);
      message = detail.message;
      title = detail.title ?? "確認";
      action = detail.action ?? "確認";
      resolveRef = detail.resolve;
      open = true;
    };

    window.addEventListener(CONFIRM_REQUEST, onRequest);
    return () => window.removeEventListener(CONFIRM_REQUEST, onRequest);
  });

  const settle = (value: boolean) => {
    resolveRef?.(value);
    resolveRef = null;
    open = false;
  };
</script>

<Modal {open} onclose={() => settle(false)} aria-label="確認對話框">
  <div class="body">
    <h2>{title}</h2>
    <p>{message}</p>
    <footer>
      <Button variant="ghost" onclick={() => settle(false)}>取消</Button>
      <Button variant="primary" onclick={() => settle(true)}>{action}</Button>
    </footer>
  </div>
</Modal>

<style>
  .body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 22rem;
    max-width: 100%;
    padding: 1.25rem;
  }

  h2 {
    font: var(--font-title1);
  }

  p {
    font: var(--font-body1);
    color: var(--color-text-muted);
    white-space: pre-line;
    overflow-wrap: anywhere;
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
</style>
