<script lang="ts">
  import { fly } from "svelte/transition";
  import { ToastStage } from "$lib/components/floating/toastStage.core.svelte";
  import Toast from "$lib/components/floating/Toast.svelte";

  const stage = new ToastStage();

  let stageEl = $state<HTMLDivElement>();

  $effect(() => {
    const node = stageEl;
    if (node && stage.items.length > 0 && !node.matches(":popover-open")) {
      node.showPopover();
    }
  });

  function handleItemOutroEnd() {
    if (stage.items.length === 0 && stageEl?.matches(":popover-open")) {
      stageEl.hidePopover();
    }
  }
</script>

<div
  bind:this={stageEl}
  popover="manual"
  class:active={stage.items.length > 0}
  role="region"
  aria-label="通知"
  style:height="{stage.layout.containerHeight}px"
  onmouseenter={stage.handleContainerMouseEnter}
  onmouseleave={stage.handleContainerMouseLeave}
>
  {#each stage.items as item, i (item.id)}
    {@const c = stage.layout.computed[i]}
    <div
      style:transform="translateY({c.y}px) scale({c.scale})"
      style:opacity={c.opacity}
      style:z-index={stage.items.length - i}
      use:stage.layout.measureEl={item.id}
    >
      <div in:fly={{ y: -16, duration: 200 }} out:fly={{ y: -16, duration: 200 }} onoutroend={handleItemOutroEnd}>
        <Toast
          message={item.message}
          variant={item.variant}
          progress={item.progress}
          ondismiss={item.progress === undefined ? () => stage.dismiss(item.id) : undefined}
          dismissLabel="關閉通知"
          role="status"
          aria-live="polite"
        />
      </div>
    </div>
  {/each}
</div>

<style>
  [popover="manual"] {
    position: fixed;
    top: 1rem;
    left: 50%;
    transform: translateX(-50%);
    width: 22rem;
    max-width: calc(100dvw - 1.5rem);
    border: none;
    background: transparent;
    margin: 0;
    padding: 0;
    overflow: visible;

    pointer-events: none;
    &.active {
      pointer-events: auto;
    }
  }

  [popover="manual"] > div {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    pointer-events: auto;
    transform-origin: top center;
    will-change: transform, opacity;
    transition:
      transform 300ms cubic-bezier(0.16, 1, 0.3, 1),
      opacity 200ms ease;
  }
</style>
