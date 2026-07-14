<script lang="ts">
  import { fade, scale } from "svelte/transition";
  import { flip } from "svelte/animate";

  import { IconX } from "$lib/icons";
  import { Modal } from "$lib/components/floating/modal.core.svelte";
  import { ToastList } from "$lib/components/floating/toastList.core.svelte";
  import { hideToasts } from "$lib/components/floating/toast-events";
  import { toastCard } from "$lib/components/floating/Toast.svelte";
  import Button from "$lib/components/actions/Button.svelte";

  const toastList = new ToastList();

  const modal = new Modal({
    get open() {
      return toastList.open;
    },
    get onclose() {
      return hideToasts;
    },
  });

  function handleViewportClick(e: MouseEvent) {
    if (e.target === e.currentTarget) hideToasts();
  }

  const delay = $derived({
    toastIn: (i: number) => (i + 1) * 40,
    toastOut: (i: number) => Math.max((toastList.history.length - 1 - i) * 40, 0),
    fadeOut: toastList.history.length * 40,
  });
</script>

{#snippet list()}
  <div role="list">
    {#each toastList.history as item, i (item.id)}
      <div
        in:scale|global={{ duration: 150, start: 0.95, delay: delay.toastIn(i) }}
        out:scale|global={{ duration: 150, start: 0.95, delay: delay.toastOut(i) }}
        animate:flip={{ delay: 150, duration: 250 }}
      >
        {@render toastCard({
          message: item.message,
          variant: item.variant,
          progress: item.progress,
          onDismiss: () => toastList.dismiss(item.id),
          dismissLabel: "從歷史移除",
          alwaysShowClose: true,
          role: "listitem",
        })}
      </div>
    {/each}
  </div>
{/snippet}

{#snippet exit()}
  <div
    class="exit"
    in:scale={{ duration: 150, start: 0.95 }}
    out:scale={{ duration: 150, start: 0.95, delay: delay.fadeOut }}
  >
    <Button
      variant="outlined"
      padding="icon"
      aria-label="關閉通知歷史"
      onclick={hideToasts}
      style="padding: 0.5rem; border-radius: 9999px;"
    >
      <IconX size={18} />
    </Button>
  </div>
{/snippet}

<dialog bind:this={modal.dialogEl} data-open={toastList.open} aria-label="通知歷史" oncancel={modal.handleCancel}>
  {#if toastList.open}
    <div
      class="viewport"
      role="presentation"
      onclick={handleViewportClick}
      in:fade={{ duration: 150 }}
      out:fade={{ duration: 150, delay: delay.fadeOut }}
      onoutroend={modal.handleOutroEnd}
    >
      {@render exit()}
      {@render list()}
    </div>
  {/if}
</dialog>

<style>
  dialog {
    position: fixed;
    inset: 0;
    width: 100dvw;
    height: 100dvh;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: none;
    outline: none;
    background: transparent;
    overflow: visible;
  }

  dialog > .viewport {
    background-color: oklch(0 0 0 / 0.5);
    backdrop-filter: blur(2px);
    width: 100%;
    height: 100%;
    overflow-y: auto;
    overscroll-behavior: contain;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 4rem 1.5rem;
    padding-top: 0.5rem;
  }

  .exit,
  [role="list"] {
    width: 100%;
    max-width: 30rem;
  }

  .exit {
    display: flex;
    justify-content: center;
  }

  [role="list"] {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
</style>
