<script lang="ts">
  import { tick } from "svelte";
  import { fly, scale } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  import { IconPlayerPauseFilled, IconPlayerPlayFilled } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  import { blurhashStyle } from "$lib/client/blurhash.js";
  import { imgSrc } from "$lib/client/api.js";
  import { Player } from "$lib/virtualizer/player.svelte.js";
  import { PlayerAutoHide } from "./playerAutoHide.svelte.js";

  let { data }: { data: PageData } = $props();

  /** 預先計算好 blurhash 樣式的圖片列表 */
  const imagesWithBlurhash = $derived(
    data.images.map((img) => ({
      ...img,
      blurhashStyle: blurhashStyle({ fit: "contain", blurhash: img.blurhash, width: img.width, height: img.height }),
      src: imgSrc(img.id, "md"),
    })),
  );

  // ---

  const carousel = new Player({
    get images() {
      return imagesWithBlurhash;
    },
  });

  const autoHide = new PlayerAutoHide();

  // ---

  /** 用於觸發播放/暫停反饋的瞬間信號 */
  let feedback = $state(false);

  $effect(() => {
    carousel.playing;
    feedback = true;
    tick().then(() => (feedback = false));
  });
</script>

<svelte:head>
  <title>播放器 — Taggit</title>
</svelte:head>

<svelte:window onkeydown={carousel.handleKeydown} />

{#snippet playIcon(size: number)}
  {#if carousel.playing}
    <IconPlayerPlayFilled {size} />
  {:else}
    <IconPlayerPauseFilled {size} />
  {/if}
{/snippet}

<div class="browse-player">
  <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
  <div
    bind:this={carousel.trackEl}
    class="browse-carousel"
    onclick={carousel.handleCarouselClick}
    aria-label="圖片播放區"
  >
    {#each carousel.visibleItems as item (item.key)}
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
    <div class="browse-feedback" out:scale={{ start: 1.35, opacity: 0, duration: 550, easing: cubicOut }}>
      {@render playIcon(64)}
    </div>
  {/if}
</div>

{#if autoHide.show}
  <div class="browse-dock" transition:fly={{ y: 20, duration: 300, easing: cubicOut }}>
    <button class="btn-icon" onclick={carousel.handleTogglePlay}>
      {@render playIcon(18)}
    </button>

    <div class="browse-dock-progress">
      <input
        type="range"
        min="0"
        max="1000"
        value={carousel.progressValue}
        oninput={carousel.handleProgressInput}
        onchange={carousel.handleProgressChange}
      />
      <span>{carousel.progressText}</span>
    </div>

    <div class="browse-dock-speed">
      <label for="browse-speed">速度</label>
      <input
        id="browse-speed"
        type="range"
        min="0.2"
        max="6"
        step="0.1"
        value={carousel.speed}
        oninput={carousel.handleSpeedInput}
      />
      <span>{carousel.speedDisplay}</span>
    </div>
  </div>
{/if}

<style>
  @import "./page.css";
</style>
