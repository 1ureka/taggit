<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import Menu from "$lib/components/floating/Menu.svelte";

  let canvasEl = $state<HTMLElement>();
  let anchorEl = $state<HTMLElement>();
  let pos = $state({ x: 0, y: 0 });
  let open = $state(false);

  const handleContext = (e: MouseEvent) => {
    if (!canvasEl) return;
    e.preventDefault();
    const rect = canvasEl.getBoundingClientRect();
    pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    open = true;
  };

  const close = () => (open = false);

  const items = [
    { type: "label", content: "Quick actions", props: { style: "min-width: 10rem" } },
    { type: "button", content: "Cut", props: { onclick: close } },
    { type: "button", content: "Copy", props: { onclick: close } },
    { type: "button", content: "Paste", props: { onclick: close } },
    { type: "separator" },
    {
      type: "submenu",
      key: "transform",
      content: "Transform",
      items: [
        { type: "button", content: "Rotate 90°", props: { onclick: close, style: "min-width: 10rem" } },
        { type: "button", content: "Flip horizontal", props: { onclick: close } },
        { type: "button", content: "Flip vertical", props: { onclick: close } },
      ],
    },
    { type: "separator" },
    { type: "button", content: "Delete", props: { onclick: close, style: "color: var(--color-error);" } },
  ] as const;
</script>

<svelte:head>
  <title>Menu — Context menu</title>
</svelte:head>

{#snippet preview()}
  <PreviewCanvas>
    <div class="canvas" bind:this={canvasEl} oncontextmenu={handleContext} role="presentation">
      <span bind:this={anchorEl} class="anchor" style:left="{pos.x}px" style:top="{pos.y}px" aria-hidden="true"></span>
      <span class="hint">right-click anywhere</span>
    </div>

    <Menu
      id={{ ariaSkipped: true, reason: "context menu has no associated trigger button" }}
      labelledBy={{ label: "Context menu" }}
      {open}
      reference={anchorEl}
      {items}
      onclose={close}
    />
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="Menu"
  label="Context menu"
  guide="Right-click somewhere else without closing first. The menu **flies** to the new point."
  {preview}
/>

<style>
  .canvas {
    position: relative;
    width: 100%;
    height: 16rem;
    border-radius: calc(var(--border-radius) * 2);
    border: var(--border-style);
    overflow: hidden;

    &::before {
      content: "";
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.05), transparent 55%),
        radial-gradient(circle at 75% 80%, rgba(255, 255, 255, 0.035), transparent 55%), var(--color-bg-card);
      filter: blur(10px);
      pointer-events: none;
    }
  }

  .hint {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font: var(--font-body2);
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .anchor {
    position: absolute;
    width: 1px;
    height: 1px;
    background: transparent;
    pointer-events: none;
  }
</style>
