<!--
  Toast.svelte — Sonner-inspired toast notifications.
  Uses Svelte transitions for enter/exit and animate:flip for smooth reordering.
-->
<script lang="ts">
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import { flip } from "svelte/animate";
  import { IconX, IconCircleCheck, IconAlertCircle, IconInfoCircle } from "@tabler/icons-svelte";
  import { toasts, dismissToast } from "$lib/client/toast.js";
  import type { ToastItem } from "$lib/client/toast.js";

  let items: ToastItem[] = $state([]);

  toasts.subscribe((v) => (items = v));
</script>

{#if items.length > 0}
  <div class="toast-viewport" role="region" aria-label="通知">
    {#each items as toast (toast.id)}
      <div
        class="toast"
        role="status"
        aria-live="polite"
        in:fly={{ y: 16, duration: 250, easing: cubicOut }}
        out:fly={{ y: -12, duration: 180, easing: cubicOut }}
        animate:flip={{ duration: 200, easing: cubicOut }}
      >
        <span class="toast-icon toast-icon-{toast.type}">
          {#if toast.type === "success"}
            <IconCircleCheck size={16} stroke={1.5} />
          {:else if toast.type === "error"}
            <IconAlertCircle size={16} stroke={1.5} />
          {:else}
            <IconInfoCircle size={16} stroke={1.5} />
          {/if}
        </span>
        <span class="toast-msg">{toast.message}</span>
        <button class="toast-close" aria-label="關閉" onclick={() => dismissToast(toast.id)}>
          <IconX size={14} stroke={2} />
        </button>
      </div>
    {/each}
  </div>
{/if}

<style>
  /* ─── Viewport ─────────────────────────────────────────────────── */
  .toast-viewport {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    pointer-events: none;
    max-width: 22rem;
    width: 100%;
  }

  /* ─── Individual toast ─────────────────────────────────────────── */
  .toast {
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    padding: 0.75rem 0.75rem 0.75rem 0.875rem;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: var(--text);
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow:
      0 4px 12px rgba(0, 0, 0, 0.25),
      0 1px 3px rgba(0, 0, 0, 0.15);
    pointer-events: auto;
    will-change: transform, opacity;
  }

  /* ─── Icon ─────────────────────────────────────────────────────── */
  .toast-icon {
    flex-shrink: 0;
    display: inline-flex;
    margin-top: 1px;
  }

  .toast-icon-success {
    color: var(--color-success);
  }
  .toast-icon-error {
    color: var(--destructive);
  }
  .toast-icon-info {
    color: var(--color-info);
  }

  /* ─── Message ──────────────────────────────────────────────────── */
  .toast-msg {
    flex: 1;
    min-width: 0;
    word-break: break-word;
  }

  /* ─── Close button ─────────────────────────────────────────────── */
  .toast-close {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.375rem;
    height: 1.375rem;
    padding: 0;
    margin-top: -1px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--text-dim);
    cursor: pointer;
    opacity: 0;
    transition:
      opacity 0.15s,
      background 0.15s,
      color 0.15s;
  }

  .toast:hover .toast-close {
    opacity: 1;
  }

  .toast-close:hover {
    background: var(--bg-hover);
    color: var(--text-muted);
  }

  /* ─── Responsive ───────────────────────────────────────────────── */
  @media (max-width: 480px) {
    .toast-viewport {
      right: 0.75rem;
      left: 0.75rem;
      bottom: 0.75rem;
      max-width: none;
    }
  }
</style>
