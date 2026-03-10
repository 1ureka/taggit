<script lang="ts">
  import { IconX, IconCircleCheck, IconAlertCircle, IconInfoCircle } from "@tabler/icons-svelte";
  import { createToast } from "$lib/ui/toast.svelte.js";

  const ui = createToast({
    gap: 8,
    collapsedOffset: 8,
    collapsedScaleStep: 0.05,
    collapsedOpacityStep: 0.15,
    maxVisible: 5,
  });
</script>

<div
  class="toaster"
  class:toaster-active={ui.items.length > 0}
  role="region"
  aria-label="通知"
  style="height: {ui.getContainerHeight()}px;"
  onmouseenter={ui.handleContainerMouseEnter}
  onmouseleave={ui.handleContainerMouseLeave}
>
  {#each ui.items as toast, i (toast.id)}
    {@const y = ui.getOffset(i)}
    {@const scale = ui.getScale(i)}
    {@const opacity = ui.getOpacity(i, toast)}
    {@const isEntering = ui.entering.has(toast.id)}
    <div
      class="toast-item"
      class:removing={toast.removing}
      class:entering={isEntering}
      style="
        transform: translateY({isEntering ? '-100%' : `${y}px`}) scale({isEntering ? 1 : scale});
        opacity: {isEntering ? 0 : opacity};
        z-index: {ui.items.length - i};
      "
      role="status"
      aria-live="polite"
      ontransitionend={(e) => ui.handleTransitionEnd(e, toast)}
      use:ui.measureEl={toast.id}
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
      <button class="toast-close" aria-label="關閉" onclick={() => ui.handleCloseClick(toast.id)}>
        <IconX size={14} stroke={2} />
      </button>
    </div>
  {/each}
</div>

<style>
  .toaster {
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2000;
    width: 22rem;
    pointer-events: none;
  }

  /* When there are toast items, enable pointer events on the container
     so mouseenter/mouseleave fire for hover-expand */
  .toaster-active {
    pointer-events: auto;
  }

  .toast-item {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    transform-origin: top center;
    transition:
      transform 300ms cubic-bezier(0.16, 1, 0.3, 1),
      opacity 200ms ease;
    pointer-events: auto;
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
    will-change: transform, opacity;
  }

  /* Entering: applied for one frame, then removed so transition fires */
  .toast-item.entering {
    transition: none;
  }

  /* Removing: slide up + fade out */
  .toast-item.removing {
    pointer-events: none;
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

  .toast-item:hover .toast-close {
    opacity: 1;
  }

  .toast-close:hover {
    background: var(--bg-hover);
    color: var(--text-muted);
  }

  /* ─── Responsive ───────────────────────────────────────────────── */
  @media (max-width: 480px) {
    .toaster {
      width: calc(100% - 1.5rem);
    }
  }
</style>
