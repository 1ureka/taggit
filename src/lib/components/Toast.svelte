<!--
  Toast.svelte — Sonner-inspired stacked toast notifications.
  Pure CSS transitions for enter/exit/stack animations.
  Position: top-center, stacked & collapsible, expands on hover.
-->
<script lang="ts">
  import { tick } from "svelte";
  import { IconX, IconCircleCheck, IconAlertCircle, IconInfoCircle } from "@tabler/icons-svelte";
  import { toasts, dismissToast, finalizeRemoval, pauseAll, resumeAll } from "$lib/client/toast.js";
  import type { ToastItem } from "$lib/client/toast.js";

  const GAP = 8;
  const COLLAPSED_OFFSET = 8;
  const COLLAPSED_SCALE_STEP = 0.05;
  const COLLAPSED_OPACITY_STEP = 0.15;
  const MAX_VISIBLE = 5;

  let items: ToastItem[] = $state([]);
  let hovered = $state(false);
  let heights: Map<number, number> = $state(new Map());
  let entering: Set<number> = $state(new Set());

  toasts.subscribe((v) => {
    // Detect newly added toasts (items that weren't in the previous list)
    const prevIds = new Set(items.map((t) => t.id));
    const newIds = v.filter((t) => !prevIds.has(t.id)).map((t) => t.id);

    items = v;

    if (newIds.length > 0) {
      entering = new Set([...entering, ...newIds]);
      // Remove entering class after one frame so CSS transition kicks in
      tick().then(() => {
        requestAnimationFrame(() => {
          entering = new Set();
        });
      });
    }
  });

  function getOffset(index: number): number {
    if (hovered) {
      // Expanded: stack with actual heights + gap
      let y = 0;
      for (let i = 0; i < index; i++) {
        const h = heights.get(items[i]?.id ?? -1) ?? 48;
        y += h + GAP;
      }
      return y;
    }
    // Collapsed: small fixed offset per index
    return index * COLLAPSED_OFFSET;
  }

  function getScale(index: number): number {
    if (hovered) return 1;
    return Math.max(0.9, 1 - index * COLLAPSED_SCALE_STEP);
  }

  function getOpacity(index: number, toast: ToastItem): number {
    if (toast.removing) return 0;
    if (hovered) return index < MAX_VISIBLE ? 1 : 0;
    return Math.max(0, 1 - index * COLLAPSED_OPACITY_STEP);
  }

  function handleTransitionEnd(e: TransitionEvent, toast: ToastItem) {
    // Only react to opacity transition ending on the toast-item itself
    if (e.propertyName !== "opacity" || e.target !== e.currentTarget) return;
    if (toast.removing) {
      finalizeRemoval(toast.id);
    }
  }

  function measureHeight(id: number, el: HTMLDivElement | null) {
    if (!el) return;
    const h = el.offsetHeight;
    if (heights.get(id) !== h) {
      heights = new Map(heights).set(id, h);
    }
  }

  /** Svelte action: measure element height on mount & mutation */
  function measureEl(node: HTMLDivElement, id: number) {
    measureHeight(id, node);
    const ro = new ResizeObserver(() => measureHeight(id, node));
    ro.observe(node);
    return {
      destroy() {
        ro.disconnect();
        // Clean up height entry
        const m = new Map(heights);
        m.delete(id);
        heights = m;
      },
    };
  }

  /** Compute total container height so hover zone works (children are absolute) */
  function getContainerHeight(): number {
    const visibleItems = items.filter((t) => !t.removing);
    if (visibleItems.length === 0) return 0;

    if (hovered) {
      let total = 0;
      for (let i = 0; i < visibleItems.length && i < MAX_VISIBLE; i++) {
        total += (heights.get(visibleItems[i].id) ?? 48) + GAP;
      }
      return total - GAP; // remove trailing gap
    }

    // Collapsed: last item offset + its height
    const lastIdx = Math.min(visibleItems.length - 1, MAX_VISIBLE - 1);
    const lastH = heights.get(visibleItems[0]?.id ?? -1) ?? 48;
    return lastIdx * COLLAPSED_OFFSET + lastH;
  }
</script>

<!-- Viewport always mounted (no {#if}) so out-animations always run -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="toaster"
  class:toaster-active={items.length > 0}
  role="region"
  aria-label="通知"
  style="height: {getContainerHeight()}px;"
  onmouseenter={() => {
    hovered = true;
    pauseAll();
  }}
  onmouseleave={() => {
    hovered = false;
    resumeAll();
  }}
>
  {#each items as toast, i (toast.id)}
    {@const y = getOffset(i)}
    {@const scale = getScale(i)}
    {@const opacity = getOpacity(i, toast)}
    {@const isEntering = entering.has(toast.id)}
    <div
      class="toast-item"
      class:removing={toast.removing}
      class:entering={isEntering}
      style="
        transform: translateY({isEntering ? '-100%' : `${y}px`}) scale({isEntering ? 1 : scale});
        opacity: {isEntering ? 0 : opacity};
        z-index: {items.length - i};
      "
      role="status"
      aria-live="polite"
      ontransitionend={(e) => handleTransitionEnd(e, toast)}
      use:measureEl={toast.id}
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
