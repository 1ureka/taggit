<script lang="ts">
  import Popover from "$lib/components/floating/Popover.svelte";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconX } from "$lib/icons";
  import { getStampContext } from "../logic/stamp.svelte";

  let { reference }: { reference: HTMLElement | undefined } = $props();

  const stamp = getStampContext();
</script>

<Popover open={stamp.isActive} {reference} placement="bottom" offset={0}>
  <button type="button" class="badge" onclick={stamp.handleExit} {@attach tooltip({ content: "離開圖章模式" })}>
    <span class="dot" aria-hidden="true"></span>
    <span class="ellipsis">圖章模式・{stamp.summary}</span>
    <IconX size={13} />
  </button>
</Popover>

<style>
  button.badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    max-width: min(20rem, calc(100vw - 2rem));
    padding: 0.375rem 0.75rem;
    border: none;
    border-radius: var(--border-radius);
    background: var(--color-accent);
    color: var(--color-bg);
    font: var(--font-body2);
    font-weight: 600;
    cursor: pointer;
  }

  button.badge {
    will-change: transform;
    transition: all 0.15s ease;

    &:active {
      transition: all 0.03s ease;
      transform: scale(0.97);
    }
  }

  button.badge {
    color: var(--color-bg);
    background-color: var(--color-accent);
    border-color: var(--color-accent);

    &:hover {
      background-color: hsl(from var(--color-accent) h s calc(l - 25));
      border-color: hsl(from var(--color-accent) h s calc(l - 25));
    }
  }

  span.dot {
    flex-shrink: 0;
    width: 0.4rem;
    height: 0.4rem;
    margin-right: 0.4rem;
    border-radius: 50%;
    background: currentColor;
  }
</style>
