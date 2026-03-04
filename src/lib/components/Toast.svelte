<script lang="ts">
  import { IconX, IconCircleCheck, IconAlertCircle, IconInfoCircle } from "@tabler/icons-svelte";
  import { toasts, dismissToast } from "$lib/client/toast.js";
  import type { ToastItem } from "$lib/client/toast.js";

  let items: ToastItem[] = $state([]);
  let fading = $state(new Set<number>());

  toasts.subscribe((v) => {
    // detect removals to trigger fade-out
    const currentIds = new Set(v.map((t) => t.id));
    for (const item of items) {
      if (!currentIds.has(item.id) && !fading.has(item.id)) {
        fading.add(item.id);
        fading = new Set(fading);
        setTimeout(() => {
          items = items.filter((t) => t.id !== item.id);
          fading.delete(item.id);
          fading = new Set(fading);
        }, 200);
      }
    }
    // add new ones
    for (const t of v) {
      if (!items.find((i) => i.id === t.id)) {
        items = [...items, t];
      }
    }
  });

  function iconColor(type: ToastItem["type"]) {
    return type === "success" ? "var(--color-success)" : type === "error" ? "var(--destructive)" : "var(--color-info)";
  }
</script>

{#if items.length > 0}
  <div class="toast-container">
    {#each items as toast (toast.id)}
      <div class="toast toast-{toast.type}" class:is-fading={fading.has(toast.id)} role="status" aria-live="polite">
        <span class="toast-icon" style="color: {iconColor(toast.type)}">
          {#if toast.type === "success"}
            <IconCircleCheck size={16} stroke={1.5} />
          {:else if toast.type === "error"}
            <IconAlertCircle size={16} stroke={1.5} />
          {:else}
            <IconInfoCircle size={16} stroke={1.5} />
          {/if}
        </span>
        <span class="toast-message">{toast.message}</span>
        <button class="toast-close" aria-label="關閉" onclick={() => dismissToast(toast.id)}>
          <IconX size={14} stroke={2} />
        </button>
        <div class="toast-progress toast-progress-{toast.type}" style="animation-duration: {toast.duration}ms"></div>
      </div>
    {/each}
  </div>
{/if}

<style>
  @import "../styles/Toast.css";
</style>
