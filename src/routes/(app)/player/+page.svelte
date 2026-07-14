<script lang="ts">
  import { tick } from "svelte";
  import { scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { PageData } from "./$types";

  import type { ImageWithId } from "$lib/database";
  import { blurhashStyle, imgSrc } from "$lib/image/client";
  import { IconPlayerPlayFilled, IconPlayerPauseFilled } from "$lib/icons";
  import { Player } from "$lib/virtualizer/player.svelte";

  import { findClosestToMiddle } from "./control/findMiddle";
  import { AutoHide } from "./control/autoHide.svelte";
  import PlayerDock from "./control/Dock.svelte";

  let { data }: { data: PageData } = $props();

  const images: (ImageWithId & { blurhash: string })[] = $derived(
    data.images.map((img) => ({
      ...img,
      blurhash: blurhashStyle({ fit: "contain", blurhash: img.blurhash, width: img.width, height: img.height }),
    })),
  );

  const player = new Player({
    get images() {
      return images;
    },
  });

  const autoHide = new AutoHide();

  /** 用於觸發播放/暫停反饋的瞬間信號 */
  let feedback = $state(false);

  $effect(() => {
    player.playing;
    feedback = true;
    tick().then(() => (feedback = false));
  });

  const matchesGif = (item: ImageWithId) => item.id.toLowerCase().endsWith(".gif");

  // 只讓最靠近畫面中央的 GIF 播放動畫，其餘用靜態縮圖以維持流暢
  const animatedIndex = $derived(findClosestToMiddle(player.visibleItems, matchesGif));
</script>

<svelte:head>
  <title>播放器 — Taggit</title>
</svelte:head>

<svelte:window onkeydown={player.handleKeydown} />

<main aria-label="圖片播放器">
  <div class="strip" role="presentation" style:transform={player.stripTransform} onclick={player.handlePlayerClick}>
    {#each player.visibleItems as item, i (item.key)}
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

  {#if feedback}
    <div class="feedback" out:scale={{ start: 1.35, opacity: 0, duration: 550, easing: cubicOut }}>
      {#if player.playing}
        <IconPlayerPlayFilled size={64} />
      {:else}
        <IconPlayerPauseFilled size={64} />
      {/if}
    </div>
  {/if}
</main>

{#if !autoHide.hideDock}
  <PlayerDock {player} />
{/if}

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
    padding: 1.5rem;
    display: grid;
    place-items: center;
    color: var(--color-text);
    background-color: hsl(from var(--color-bg) h s l / 0.5);
    border-radius: 50%;
    pointer-events: none;
  }
</style>
