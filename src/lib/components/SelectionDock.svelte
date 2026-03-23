<script lang="ts">
  import type { Snippet } from "svelte";
  import { fly } from "svelte/transition";
  import { IconX } from "@tabler/icons-svelte";

  type Props = {
    count: number;
    onclose: () => void;
    children: Snippet;
  };

  let { count, onclose, children }: Props = $props();
</script>

{#if count > 0}
  <div class="selection-dock" transition:fly={{ y: 20, duration: 200, opacity: 0 }}>
    <div class="dock-inner">
      <button class="btn-ghost btn-sm dock-close" onclick={onclose} title="取消選取">
        <IconX size={16} />
      </button>

      <span class="dock-count">已選取 {count} 張</span>

      <div class="dock-separator"></div>

      {@render children()}
    </div>
  </div>
{/if}

<style>
  .selection-dock {
    position: fixed;
    bottom: 1.25rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-dock);
    pointer-events: auto;
  }

  .dock-inner {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    background: var(--text);
    color: var(--bg);
    border: 1px solid hsl(from var(--bg) h s l / 0.12);
    border-radius: calc(var(--radius) * 2);
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.14),
      0 1px 4px rgba(0, 0, 0, 0.08);
  }

  .dock-close {
    padding: 0.25rem;
    color: color-mix(in oklch, var(--bg) 65%, var(--text));
    background: transparent;
    border-color: transparent;
  }

  .dock-close:hover {
    background: hsl(from var(--bg) h s l / 0.07);
    border-color: transparent;
    color: var(--bg);
  }

  .dock-count {
    font-size: 0.8125rem;
    font-weight: 500;
    color: color-mix(in oklch, var(--bg) 65%, var(--text));
    white-space: nowrap;
  }

  .dock-separator {
    width: 1px;
    height: 1.25rem;
    background: hsl(from var(--bg) h s l / 0.15);
    flex-shrink: 0;
  }
</style>
