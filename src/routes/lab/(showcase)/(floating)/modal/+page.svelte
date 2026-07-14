<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import Modal from "$lib/components/floating/Modal.svelte";
  import { IconAlertTriangleFilled, IconX } from "$lib/icons";

  let basicOpen = $state(false);

  // ---

  let confirmOpen = $state(false);
  let deleting = $state(false);
  let deleteTimer: ReturnType<typeof setTimeout>;

  $effect(() => {
    return () => clearTimeout(deleteTimer);
  });

  const closeConfirm = () => {
    if (deleting) return;
    confirmOpen = false;
  };

  const handleDelete = () => {
    deleting = true;
    clearTimeout(deleteTimer);
    deleteTimer = setTimeout(() => {
      deleting = false;
      confirmOpen = false;
    }, 1000);
  };
</script>

<svelte:head>
  <title>Dialog — Modal</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      <section>
        <h4>Basic</h4>
        <Button onclick={() => (basicOpen = true)}>Open modal</Button>
      </section>

      <section>
        <h4>Confirm flow</h4>
        <Button variant="destructive" onclick={() => (confirmOpen = true)}>Delete project</Button>
      </section>
    </div>
  </PreviewCanvas>

  <Modal open={basicOpen} onclose={() => (basicOpen = false)} aria-label="Update available">
    <div class="modal-body">
      <header>
        <h2>Update available</h2>
        <Button variant="ghost" padding="icon" onclick={() => (basicOpen = false)}>
          <IconX size={16} />
          <span class="sr-only">Close</span>
        </Button>
      </header>
      <p>A new version is ready. Refreshing picks up the latest fixes and features.</p>
      <footer>
        <Button variant="ghost" onclick={() => (basicOpen = false)}>Later</Button>
        <Button variant="primary" onclick={() => (basicOpen = false)}>Refresh</Button>
      </footer>
    </div>
  </Modal>

  <Modal open={confirmOpen} onclose={closeConfirm} aria-label="Delete project">
    <div class="modal-body confirm">
      <header>
        <span class="warn-icon"><IconAlertTriangleFilled size={24} /></span>
        <h2>Delete project?</h2>
      </header>
      <p>This permanently removes the project and all of its data. This action cannot be undone.</p>
      <footer>
        <Button variant="ghost" status={deleting ? "disabled" : undefined} onclick={closeConfirm}>Cancel</Button>
        <Button variant="destructive" status={deleting ? "pending" : undefined} onclick={handleDelete}>Delete</Button>
      </footer>
    </div>
  </Modal>
{/snippet}

<PreviewLayout
  component="Dialog"
  label="Modal"
  guide="Built on the native `<dialog>`, so focus trap, [[Escape]], and focus return all come from the browser instead of hand-rolled JS. Modal itself stays basic — the **Confirm flow** demo shows how to compose a Cancel/Delete pair from `Modal` + `Button` for a business-level confirm dialog."
  {preview}
/>

<style>
  .container {
    display: flex;
    gap: 1.5rem;
  }

  section {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  section > h4 {
    font: var(--font-body1);
    color: var(--color-text-muted);
  }

  /* --- */

  .modal-body {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 22rem;
    max-width: 100%;
    padding: 1.25rem;
  }

  .modal-body > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .modal-body h2 {
    font: var(--font-title1);
  }

  .modal-body p {
    font: var(--font-body1);
    color: var(--color-text-muted);
  }

  .modal-body > footer {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  /* --- */

  .modal-body.confirm {
    align-items: flex-start;
  }

  .warn-icon {
    display: grid;
    place-items: center;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    color: var(--color-error);
    background-color: hsl(from var(--color-error) h s l / 0.1);
  }
</style>
