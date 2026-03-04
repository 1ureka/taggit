/**
 * @file use-zoom-pan.svelte.ts
 * Reusable zoom / pan state for image preview containers.
 *
 * Usage:
 * ```
 * const zp = useZoomPan();
 * // bind zp.handlers.wheel/mousedown to container
 * // bind zp.handlers.windowMousemove/windowMouseup to <svelte:window>
 * // use zp.transform on the <img> style
 * // call zp.reset() when navigating to a new image
 * ```
 */

export function useZoomPan(opts?: { minScale?: number; maxScale?: number }) {
  const minScale = opts?.minScale ?? 0.2;
  const maxScale = opts?.maxScale ?? 10;

  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let isDragging = $state(false);

  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPanX = 0;
  let dragStartPanY = 0;

  function reset() {
    scale = 1;
    panX = 0;
    panY = 0;
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    scale = Math.max(minScale, Math.min(maxScale, scale + delta * scale));
  }

  function onMousedown(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartPanX = panX;
    dragStartPanY = panY;
  }

  function onWindowMousemove(e: MouseEvent) {
    if (!isDragging) return;
    panX = dragStartPanX + (e.clientX - dragStartX);
    panY = dragStartPanY + (e.clientY - dragStartY);
  }

  function onWindowMouseup() {
    isDragging = false;
  }

  return {
    get scale() {
      return scale;
    },
    get panX() {
      return panX;
    },
    get panY() {
      return panY;
    },
    get isDragging() {
      return isDragging;
    },
    get transform() {
      return `translate(${panX}px,${panY}px) scale(${scale})`;
    },
    reset,
    onWheel,
    onMousedown,
    onWindowMousemove,
    onWindowMouseup,
  };
}
