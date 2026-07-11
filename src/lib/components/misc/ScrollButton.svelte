<script lang="ts">
  import { fly } from "svelte/transition";
  import { IconArrowUp } from "$lib/ui/icons/index.js";
  import { ScrollButton } from "./scrollButton.svelte.js";

  type Props = {
    /** 滾動容器 DOM 引用 */
    viewportEl: HTMLElement | null;
  };

  let { viewportEl }: Props = $props();

  const ui = new ScrollButton({
    get viewportEl() {
      return viewportEl;
    },
  });
</script>

{#if ui.show}
  <button
    type="button"
    aria-label="回到頂部"
    onclick={ui.handleFabClick}
    transition:fly={{ y: 16, duration: 200, opacity: 0 }}
  >
    <IconArrowUp size={20} />
  </button>
{/if}

<style>
  button {
    position: absolute;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    bottom: 1.5rem;
    right: 1.5rem;

    display: grid;
    place-items: center;
    background: var(--accent);
    color: var(--bg);

    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
    transition: transform 0.15s;

    &:hover {
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }

    &:focus-visible {
      outline: 2px solid hsl(from var(--bg) h s l / 0.5);
      outline-offset: -3px;
    }
  }
</style>
