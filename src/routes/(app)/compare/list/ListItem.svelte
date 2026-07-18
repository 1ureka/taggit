<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import { imgSrc } from "$lib/image/client";
  import { IconPinFilled, IconPinnedOff } from "$lib/icons";

  type Props = {
    /** 該項目要呈現的圖片紀錄 */
    item: ImageWithId;
    /** 該項目是否被釘選 */
    pinned: boolean;
    /** 列表項切換釘選事件 */
    ontoggle: () => void;
  };

  let { item, pinned, ontoggle }: Props = $props();
</script>

<button type="button" aria-pressed={pinned} title={pinned ? "自畫布移除" : "釘選到畫布"} onclick={ontoggle}>
  <img src={imgSrc(item.id, "sm")} alt={item.name} loading="lazy" decoding="async" />

  <span class="ellipsis">{item.name}</span>

  <span aria-hidden="true">
    {#if pinned}
      <span class="pin-on"><IconPinFilled size={16} /></span>
      <span class="pin-off"><IconPinnedOff size={16} /></span>
    {:else}
      <span class="pin-hover"><IconPinFilled size={16} /></span>
    {/if}
  </span>
</button>

<style>
  button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    height: 100%;
    padding: 0.25rem;
    text-align: left;
    border-radius: var(--border-radius);
    border: var(--border-style);
    border-color: transparent;
    transition: all 0.15s ease;

    &:active {
      transition: all 0.03s ease;
      transform: scale(0.97);
    }
  }

  button:hover {
    background-color: var(--color-bg-hover);
    border-color: var(--color-border-hover);
  }

  button[aria-pressed="true"] {
    background-color: hsl(from var(--color-accent) h s l / 0.15);
    border-color: hsl(from var(--color-accent) h s l / 0.35);
  }

  /* --- */

  button > img {
    width: 44px;
    height: 44px;
    object-fit: cover;
    border-radius: calc(var(--border-radius) / 1.5);
    background: var(--color-bg);
    flex-shrink: 0;
  }

  button > span.ellipsis {
    flex: 1;
    min-width: 0;
    font: var(--font-body2);
    color: var(--color-text-muted);
  }

  /* --- */

  span[aria-hidden="true"] {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 16px;
    height: 16px;
  }

  span[aria-hidden="true"] > span {
    position: absolute;
    transition: opacity 0.15s ease;
    opacity: 0;
    color: var(--color-text-muted);
  }

  span[aria-hidden="true"] > span.pin-on {
    color: var(--color-accent);
  }

  /* --- */

  button:hover,
  button:focus-visible {
    & .pin-off {
      opacity: 1;
    }
    & .pin-hover {
      opacity: 1;
    }
  }

  button[aria-pressed="true"] {
    & .pin-on {
      opacity: 1;
    }
  }
</style>
