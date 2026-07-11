<script lang="ts">
  import { IconX, IconCheckFilled, IconAlertCircleFilled, IconInfoCircleFilled } from "$lib/ui/icons";
  import { Toast } from "./toast.svelte.js";

  const ui = new Toast({
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
  style="height: {ui.containerHeight}px;"
  onmouseenter={ui.handleContainerMouseEnter}
  onmouseleave={ui.handleContainerMouseLeave}
>
  {#each ui.items as toast, i (toast.id)}
    {@const c = ui.computed[i]}
    <div
      class="toast-item"
      class:removing={toast.removing}
      class:entering={c.isEntering}
      style="
        transform: translateY({c.isEntering ? '-100%' : `${c.y}px`}) scale({c.isEntering ? 1 : c.scale});
        opacity: {c.isEntering ? 0 : c.opacity};
        z-index: {ui.items.length - i};
      "
      role="status"
      aria-live="polite"
      ontransitionend={(e) => ui.handleTransitionEnd(e, toast)}
      use:ui.measureEl={toast.id}
    >
      <span class="toast-icon toast-icon-{toast.type}">
        {#if toast.type === "success"}
          <IconCheckFilled size={16} />
        {:else if toast.type === "error"}
          <IconAlertCircleFilled size={16} />
        {:else}
          <IconInfoCircleFilled size={16} />
        {/if}
      </span>
      <div class="toast-body">
        <span class="toast-msg">{toast.message}</span>
        {#if toast.progress !== undefined}
          <div class="toast-progress-track">
            <div class="toast-progress-fill" style="width:{toast.progress * 100}%"></div>
          </div>
        {/if}
      </div>
      {#if toast.progress === undefined}
        <button type="button" class="toast-close" aria-label="關閉" onclick={() => ui.handleCloseClick(toast.id)}>
          <IconX size={14} />
        </button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .toaster {
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-toast);
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
    font-size: var(--font-size-body2);
    line-height: 1.45;
    color: var(--text);
    background: var(--bg-card);
    border: var(--border-style);
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
  .toast-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .toast-msg {
    word-break: break-word;
  }

  .toast-progress-track {
    height: 3px;
    background: var(--bg-active);
    border-radius: 1.5px;
    overflow: hidden;
  }

  .toast-progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 1.5px;
    transition: width 200ms ease;
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
