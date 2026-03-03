<script lang="ts">
  let {
    src,
    alt = "",
  }: {
    src: string;
    alt?: string;
  } = $props();

  let scale = $state(1);
  let panX = $state(0);
  let panY = $state(0);
  let dragging = $state(false);
  let startX = 0;
  let startY = 0;
  let startPanX = 0;
  let startPanY = 0;

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    scale = Math.min(10, Math.max(0.2, scale + delta * scale));
  }

  function handleMousedown(e: MouseEvent) {
    if (e.button !== 0) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startPanX = panX;
    startPanY = panY;
  }

  function handleMousemove(e: MouseEvent) {
    if (!dragging) return;
    panX = startPanX + (e.clientX - startX);
    panY = startPanY + (e.clientY - startY);
  }

  function handleMouseup() {
    dragging = false;
  }

  function handleDblclick() {
    scale = 1;
    panX = 0;
    panY = 0;
  }
</script>

<svelte:window onmousemove={handleMousemove} onmouseup={handleMouseup} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="image-preview"
  style="
    overflow: hidden;
    width: 100%;
    height: 100%;
    cursor: {dragging ? 'grabbing' : 'grab'};
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg);
  "
  onwheel={handleWheel}
  onmousedown={handleMousedown}
  ondblclick={handleDblclick}
  role="img"
>
  <img
    {src}
    {alt}
    style="
      transform: translate({panX}px, {panY}px) scale({scale});
      transform-origin: center center;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      pointer-events: none;
    "
    draggable="false"
  />
</div>
