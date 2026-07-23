<script lang="ts">
  import { fly } from "svelte/transition";
  import { IconArrowUp } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import Button from "$lib/components/actions/Button.svelte";

  let { viewportEl }: { viewportEl: HTMLElement | null } = $props();

  let popoverEl = $state<HTMLDivElement>();
  let scrollTop = $state(0);

  $effect(() => {
    const el = viewportEl;
    if (!el) return;

    const onScroll = () => (scrollTop = el.scrollTop);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  });

  // 超過 300px 即以 popover 升上 top-layer（position: fixed 相對視口，不受捲動容器影響）
  const show = $derived.by(() => {
    if (scrollTop > 300) {
      if (!popoverEl?.matches(":popover-open")) popoverEl?.showPopover();
      return true;
    } else {
      return false;
    }
  });

  const handleClick = () => {
    viewportEl?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleOutroEnd = () => {
    if (!show && popoverEl?.matches(":popover-open")) {
      popoverEl.hidePopover();
    }
  };
</script>

<div bind:this={popoverEl} popover="manual" role="presentation">
  {#if show}
    <div transition:fly={{ y: 16, duration: 200, opacity: 0 }} onoutroend={handleOutroEnd}>
      <Button
        aria-label="回到頂部"
        variant="primary"
        padding="icon"
        onclick={handleClick}
        style="padding: 0.625rem; width: auto; height: auto;"
        {@attach tooltip({ content: "回到頂部", placement: "left" })}
      >
        <IconArrowUp size={20} />
      </Button>
    </div>
  {/if}
</div>

<style>
  div[popover="manual"] {
    position: fixed;
    inset: auto 1.5rem 1.5rem auto;
    border: none;
    outline: none;
    background: transparent;
    margin: 0;
    padding: 0;
    overflow: visible;
  }

  div[popover="manual"] > div {
    transition: transform 0.15s ease;
    will-change: transform;

    &:hover {
      transform: scale(1.1);
    }

    &:active {
      transform: scale(1);
    }
  }
</style>
