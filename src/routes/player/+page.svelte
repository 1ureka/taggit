<script lang="ts">
  import { tick } from "svelte";
  import { fly, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  import type { PageData } from "./$types.js";
  import type { ImageWithId } from "$lib/types.js";

  import { IconPlayerPause, IconPlayerPlay } from "$lib/icons";
  import { blurhashStyle } from "$lib/client/blurhash.js";
  import { imgSrc } from "$lib/client/api.js";
  import { Player } from "$lib/virtualizer/player.svelte.js";
  import { PlayerAutoHide } from "./playerAutoHide.svelte.js";

  let { data }: { data: PageData } = $props();

  /** 預先計算好 blurhash 樣式的圖片列表 */
  const imagesWithBlurhash: (ImageWithId & { blurhashStyle: string; src: string })[] = $derived(
    data.images.map((img) => ({
      ...img,
      blurhashStyle: blurhashStyle({ fit: "contain", blurhash: img.blurhash, width: img.width, height: img.height }),
      src: imgSrc(img.id, "md"),
    })),
  );

  // ---

  const player = new Player({
    get images() {
      return imagesWithBlurhash;
    },
  });

  const autoHide = new PlayerAutoHide();

  // ---

  /** 用於觸發播放/暫停反饋的瞬間信號 */
  let feedback = $state(false);

  $effect(() => {
    player.playing;
    feedback = true;
    tick().then(() => (feedback = false));
  });
</script>

<svelte:head>
  <title>播放器 — Taggit</title>
</svelte:head>

<svelte:window onkeydown={player.handleKeydown} />

{#snippet playIcon(size: number, asAction = false)}
  {@const showPlay = asAction ? !player.playing : player.playing}
  {#if showPlay}
    <IconPlayerPlay {size} />
  {:else}
    <IconPlayerPause {size} />
  {/if}
{/snippet}

<main aria-label="圖片播放器">
  <div class="player" role="presentation" style:transform={player.stripTransform} onclick={player.handlePlayerClick}>
    {#each player.visibleItems as item (item.key)}
      <img
        src={item.src}
        alt={item.name}
        style="{item.style}{item.blurhashStyle}"
        draggable="false"
        loading="lazy"
        decoding="async"
      />
    {/each}
  </div>

  {#if feedback}
    <div class="feedback" out:scale={{ start: 1.35, opacity: 0, duration: 550, easing: cubicOut }}>
      {@render playIcon(64)}
    </div>
  {/if}
</main>

{#if !autoHide.hideDock}
  <aside aria-label="圖片播放器控制區" transition:fly={{ y: 20, duration: 300, easing: cubicOut }}>
    <button type="button" class="btn-icon" aria-label="播放/暫停" onclick={player.handlePlayButtonClick}>
      {@render playIcon(18, true)}
    </button>

    <div class="progress">
      <input
        id="progress-input"
        aria-label="播放進度"
        type="range"
        min="0"
        max="1000"
        value={player.progress.progressValue}
        oninput={player.handleProgressInput}
        onchange={player.handleProgressChange}
      />
      <span>{player.progressText}</span>
    </div>

    <div class="speed">
      <label for="speed-input">速度</label>
      <input
        id="speed-input"
        type="range"
        min="-6"
        max="6"
        step="0.5"
        value={player.speed}
        oninput={player.handleSpeedInput}
      />
      <span>{player.speedDisplay}</span>
    </div>
  </aside>
{/if}

<style>
  main {
    position: fixed;
    inset: 0;
    height: 100vh;
    background: var(--bg);
    overflow: hidden;
  }

  main > .player {
    position: absolute;
    inset: 0;
    will-change: transform;
  }

  main > .player > img {
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
    padding: 1.5rem;
    display: grid;
    place-items: center;
    background-color: hsl(from var(--bg) h s l / 0.5);
    border-radius: 50%;
    pointer-events: none;
  }

  /* --- */

  aside {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    background-color: hsl(from var(--bg) h s l / 0.85);
    border-top: var(--border-style);
  }

  aside > .progress {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;

    & > span {
      font-size: var(--font-size-caption);
      color: var(--text-muted);
      white-space: nowrap;
      min-width: 4rem;
      text-align: right;
    }
  }

  aside > .speed {
    display: flex;
    align-items: center;
    gap: 0.375rem;

    & > label {
      font-size: var(--font-size-caption);
      color: var(--text-dim);
      white-space: nowrap;
    }

    & > span {
      font-size: var(--font-size-caption);
      color: var(--text-muted);
      min-width: 2.5rem;
      text-align: center;
    }
  }

  /* --- */

  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    height: 1.25rem;

    .progress & {
      width: 100%;
    }

    .speed & {
      width: 80px;
    }
  }

  input[type="range"]::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background-color: hsl(from var(--accent) h s l / 0.2);
  }

  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background-color: var(--accent);
    margin-top: -5px;
    border: none;
    box-shadow: 0px 0px 0px 0px hsl(from var(--accent) h s l / 0.25);
    transition: box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  input[type="range"]:hover::-webkit-slider-thumb {
    box-shadow: 0px 0px 0px 8px hsl(from var(--accent) h s l / 0.25);
  }

  input[type="range"]::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background-color: hsl(from var(--accent) h s l / 0.2);
    border: none;
  }

  input[type="range"]::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background-color: var(--accent);
    border: none;
  }
</style>
