<script lang="ts">
  import { IconArrowUp } from "@tabler/icons-svelte";
  import { fly } from "svelte/transition";
  import { ScrollFab } from "./scrollFab.svelte.js";

  type Props = { pageContentEl: HTMLElement | null };
  let { pageContentEl }: Props = $props();

  const ui = new ScrollFab({
    get pageContentEl() {
      return pageContentEl;
    },
  });
</script>

{#if ui.showFab}
  <button
    class="fab"
    onclick={ui.handleFabClick}
    aria-label="回到頂部"
    transition:fly={{ y: 16, duration: 200, opacity: 0 }}
  >
    <IconArrowUp size={20} />
  </button>
{/if}

<style>
  .fab {
    position: fixed;
    bottom: 1.5rem;
    right: 1.5rem;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--accent);
    color: var(--bg);
    border: none;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
    transition:
      transform 0.15s,
      box-shadow 0.15s;

    &:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    }

    &:active {
      transform: scale(0.95);
    }
  }
</style>
