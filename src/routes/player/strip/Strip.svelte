<script lang="ts">
  import { scale, fade } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  import type { ImageWithId } from "$lib/database";
  import { imgSrc } from "$lib/image/client";
  import { IconPlayerPlayFilled, IconPlayerPauseFilled, IconChevronDown } from "$lib/icons";

  import { getPlaybackContext } from "../logic/playback.svelte";
  import { getGestureContext } from "../logic/gesture.svelte";
  import { findClosestToMiddle } from "../logic/findMiddle";

  const playback = getPlaybackContext();
  const gesture = getGestureContext();

  const matchesGif = (item: ImageWithId) => item.id.toLowerCase().endsWith(".gif");

  // 只讓最靠近畫面中央的 GIF 播放動畫，其餘用靜態縮圖以維持流暢
  const animatedIndex = $derived(findClosestToMiddle(playback.visibleItems, matchesGif));
</script>

<main aria-label="圖片播放器">
  <div
    class="strip"
    role="presentation"
    style:transform={playback.stripTransform}
    onpointerdown={gesture.handlePointerDown}
  >
    {#each playback.visibleItems as item, i (item.key)}
      <img
        src={imgSrc(item.id, "md", i === animatedIndex)}
        alt={item.name}
        style="{item.style}{item.blurhash}"
        draggable="false"
        loading="lazy"
        decoding="async"
      />
    {/each}
  </div>

  {#if gesture.feedback}
    <div class="feedback" out:scale={{ start: 1.35, opacity: 0, duration: 550, easing: cubicOut }}>
      {#if playback.playing}
        <IconPlayerPlayFilled size={48} />
      {:else}
        <IconPlayerPauseFilled size={48} />
      {/if}
    </div>
  {/if}

  {#if playback.boostDirection !== null}
    <div class="boost" transition:fade={{ duration: 150 }}>
      {playback.boostDirection === 1 ? "▶▶ 2X" : "◀◀ 2X"}
    </div>
  {/if}

  {#if playback.jumpFeedback}
    {#key playback.jumpFeedback.token}
      <div
        class="jump {playback.jumpFeedback.direction === -1 ? 'left' : 'right'}"
        in:scale={{ start: 0.7, duration: 200, easing: cubicOut }}
        out:fade={{ duration: 250 }}
      >
        {#if playback.jumpFeedback.direction === -1}
          <span class="chevron"><IconChevronDown size={16} /></span>
          <span>-{playback.jumpStep}</span>
        {:else}
          <span>+{playback.jumpStep}</span>
          <span class="chevron"><IconChevronDown size={16} /></span>
        {/if}
      </div>
    {/key}
  {/if}
</main>

<style>
  main {
    position: fixed;
    inset: 0;
    height: 100vh;
    background: var(--color-bg);
    overflow: hidden;
  }

  main > .strip {
    position: absolute;
    inset: 0;
    will-change: transform;
  }

  main > .strip > img {
    position: absolute;
    top: 0;
    height: 100vh;
    object-fit: contain;
  }

  main > .feedback {
    position: absolute;
    top: 50%;
    left: 50%;
    translate: -50% -50%;
    padding: 1rem;
    display: grid;
    place-items: center;
    color: var(--color-text);
    background-color: hsl(from var(--color-bg) h s l / 0.5);
    border-radius: 50%;
    pointer-events: none;
  }

  main > .boost {
    position: absolute;
    top: 1rem;
    left: 50%;
    translate: -50% 0;
    padding: 0.375rem 0.75rem;
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    letter-spacing: 0.05em;
    color: var(--color-text);
    background-color: hsl(from var(--color-bg) h s l / 0.5);
    border-radius: var(--border-radius);
    pointer-events: none;
  }

  main > .jump {
    position: absolute;
    top: 50%;
    translate: 0 -50%;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.625rem 0.875rem;
    font: var(--font-body1);
    font-family: var(--font-family-mono);
    letter-spacing: 0.05em;
    color: var(--color-text);
    background-color: hsl(from var(--color-bg) h s l / 0.5);
    border-radius: var(--border-radius);
    pointer-events: none;
  }

  main > .jump .chevron {
    display: flex;
  }

  main > .jump {
    &.left {
      left: 1rem;
    }

    &.left > .chevron {
      animation: jump-nudge-left 0.4s ease-in-out 2;
    }

    &.right {
      right: 1rem;
    }

    &.right .chevron {
      animation: jump-nudge-right 0.4s ease-in-out 2;
    }
  }

  @keyframes jump-nudge-left {
    0% {
      transform: rotate(90deg) translateY(0);
    }
    100% {
      transform: rotate(90deg) translateY(8px);
    }
  }

  @keyframes jump-nudge-right {
    0% {
      transform: rotate(-90deg) translateY(0);
    }
    100% {
      transform: rotate(-90deg) translateY(8px);
    }
  }
</style>
