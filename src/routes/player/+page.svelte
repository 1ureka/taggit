<script lang="ts">
  import { onMount } from "svelte";
  import { IconPlayerPause, IconPlayerPlay } from "@tabler/icons-svelte";
  import type { ImageWithId } from "$lib/types.js";
  import type { PageData } from "./$types.js";

  import { isInEditable } from "$lib/client/dom.js";
  import { blurhashStyle } from "$lib/client/blurhash.js";
  import { imgSrc } from "$lib/client/api.js";
  import { PlayerAutoHide } from "./playerAutoHide.svelte.js";
  import { debounce } from "$lib/utils.js";

  let { data }: { data: PageData } = $props();

  const autoHide = new PlayerAutoHide();

  // ─── Constants ──────────────────────────────────────────────────────────
  const BUFFER_PX = 2000;
  const UPDATE_THRESHOLD = 300;
  const DEBOUNCE_RESIZE = 150;

  // ─── Only two pieces of Svelte reactive state: dock visibility & play icon ─
  let playing = $state(true);
  let speedDisplay = $state("1.5");

  // ─── DOM refs ─────────────────────────────────────────────────────────
  let carouselEl: HTMLDivElement | undefined = $state();
  let sliderEl: HTMLInputElement | undefined = $state();
  let textEl: HTMLSpanElement | undefined = $state();
  let speedSliderEl: HTMLInputElement | undefined = $state();
  let playBtnEl: HTMLButtonElement | undefined = $state();
  let feedbackEl: HTMLDivElement | undefined = $state();

  // ---

  type CarouselLayout = { offsets: number[]; widths: number[]; stripWidth: number };

  function buildLayout(images: ImageWithId[]): CarouselLayout {
    const vh = window.innerHeight;

    const offsets = [];
    const widths = [];

    let x = 0;
    for (const img of images) {
      const ratio = img.width > 0 && img.height > 0 ? img.width / img.height : 1;
      const w = Math.round(vh * ratio);
      offsets.push(x);
      widths.push(w);
      x += w;
    }

    const stripWidth = x;
    return { offsets, widths, stripWidth };
  }

  // ---

  onMount(() => {
    const images: ImageWithId[] = data.images;
    if (!images.length || !carouselEl) return;

    let layout: CarouselLayout = { offsets: [], widths: [], stripWidth: 0 };
    let scrollX = 0;
    let isPlaying = true;
    let speed = 1.5;
    let lastTime = 0;
    let seeking = false;
    let rafId: number | null = null;
    let lastUpdateX = -Infinity;
    const renderedMap = new Map<string, { el: HTMLImageElement; left: number }>();

    function resetView() {
      carouselEl!.innerHTML = "";
      renderedMap.clear();
      lastUpdateX = -Infinity;
    }

    // ─── Virtualisation ──────────────────────────────────────────────────

    function updateVisibleImages({ offsets, widths, stripWidth }: CarouselLayout) {
      if (stripWidth <= 0 || images.length === 0 || !carouselEl) return;

      const vw = window.innerWidth;
      const leftEdge = scrollX - BUFFER_PX;
      const rightEdge = scrollX + vw + BUFFER_PX;
      const startCopy = Math.floor(leftEdge / stripWidth);
      const endCopy = Math.floor(rightEdge / stripWidth);

      // Determine needed image slots
      const needed = new Map<string, { imgIdx: number; left: number }>();
      for (let c = startCopy; c <= endCopy; c++) {
        for (let i = 0; i < images.length; i++) {
          const imgLeft = offsets[i] + c * stripWidth;
          const imgRight = imgLeft + widths[i];
          if (imgRight > leftEdge && imgLeft < rightEdge) {
            needed.set(`${c}_${i}`, { imgIdx: i, left: imgLeft });
          }
        }
      }

      // Remove unneeded elements
      for (const [key, { el }] of renderedMap) {
        if (!needed.has(key)) {
          el.remove();
          renderedMap.delete(key);
        }
      }

      // Update existing / create new (reuse from pool when possible)
      for (const [key, info] of needed) {
        const existing = renderedMap.get(key);
        if (existing) {
          if (existing.left !== info.left) {
            existing.el.style.left = info.left + "px";
            existing.left = info.left;
          }
          continue;
        }

        const img = images[info.imgIdx];
        const el = document.createElement("img");
        el.src = imgSrc(img.id);
        el.alt = img.name || "";
        el.draggable = false;
        el.dataset.idx = String(info.imgIdx);

        el.style.cssText = blurhashStyle({
          fit: "contain",
          blurhash: img.blurhash,
          width: img.width,
          height: img.height,
        });

        el.style.width = widths[info.imgIdx] + "px";
        el.style.left = info.left + "px";

        carouselEl.appendChild(el);
        renderedMap.set(key, { el, left: info.left });
      }

      lastUpdateX = scrollX;
    }

    function applyTransform() {
      carouselEl!.style.transform = `translateX(${-scrollX}px)`;
    }

    // ─── Progress ────────────────────────────────────────────────────────

    function updateProgress({ offsets, widths, stripWidth }: CarouselLayout) {
      if (stripWidth <= 0 || images.length === 0) return;

      // Update slider (0-1000) — direct DOM write
      if (!seeking && sliderEl) {
        sliderEl.value = String(Math.round((scrollX / stripWidth) * 1000));
      }

      // Current image index
      const pos = ((scrollX % stripWidth) + stripWidth) % stripWidth;
      let idx = images.length - 1;
      for (let i = 0; i < images.length; i++) {
        if (offsets[i] + widths[i] > pos) {
          idx = i;
          break;
        }
      }

      if (textEl) {
        textEl.textContent = `${idx + 1} / ${images.length}`;
      }
    }

    // ─── rAF Loop ────────────────────────────────────────────────────────

    function tick(ts: number) {
      if (!lastTime) lastTime = ts;
      const dt = ts - lastTime;
      lastTime = ts;

      if (isPlaying && layout.stripWidth > 0 && !seeking) {
        scrollX += speed * (dt / 16.667);

        let wrapped = false;
        if (scrollX >= layout.stripWidth) {
          scrollX -= layout.stripWidth;
          wrapped = true;
        }

        applyTransform();

        if (wrapped || Math.abs(scrollX - lastUpdateX) >= UPDATE_THRESHOLD) {
          updateVisibleImages(layout);
        }

        updateProgress(layout);
      }

      rafId = requestAnimationFrame(tick);
    }

    // ─── Playback Controls ───────────────────────────────────────────────

    function showFeedback(icon: "play" | "pause") {
      if (!feedbackEl) return;
      // SVG paths for play / pause icons
      const playSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M6 4l15 8-15 8z"/></svg>`;
      const pauseSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="white" stroke="none"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>`;
      feedbackEl.innerHTML = icon === "play" ? playSvg : pauseSvg;
      // Restart animation: remove → reflow → add
      feedbackEl.classList.remove("is-animating");
      void feedbackEl.offsetWidth; // force reflow
      feedbackEl.classList.add("is-animating");
    }

    function togglePlay() {
      isPlaying = !isPlaying;
      playing = isPlaying; // sync Svelte state for icon
      if (isPlaying) lastTime = 0;
      showFeedback(isPlaying ? "play" : "pause");
    }

    function handleProgressInput(e: Event) {
      seeking = true;
      const pct = parseInt((e.target as HTMLInputElement).value, 10) / 1000;
      scrollX = pct * layout.stripWidth;
      applyTransform();
      updateVisibleImages(layout);
      updateProgress(layout);
    }

    function handleProgressChange() {
      seeking = false;
      lastTime = 0;
    }

    function handleSpeedInput(e: Event) {
      speed = parseFloat((e.target as HTMLInputElement).value) || 1.5;
      speedDisplay = speed.toFixed(1);
    }

    function handleNavigateBack() {
      history.back();
    }

    // ─── Click ───────────────────────────────────────────────────────────

    function handleCarouselClick() {
      togglePlay();
    }

    carouselEl.addEventListener("click", handleCarouselClick);

    // ─── Keyboard ────────────────────────────────────────────────────────

    function handleKeydown(e: KeyboardEvent) {
      if (isInEditable(e.target)) return;

      if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleNavigateBack();
      }
    }

    window.addEventListener("keydown", handleKeydown);

    // ─── Resize ──────────────────────────────────────────────────────────

    const handleResize = debounce(() => {
      if (images.length === 0) return;
      const pct = layout.stripWidth > 0 ? scrollX / layout.stripWidth : 0;

      layout = buildLayout(images);
      resetView();

      scrollX = pct * layout.stripWidth;
      applyTransform();
      updateVisibleImages(layout);
      updateProgress(layout);
    }, DEBOUNCE_RESIZE);

    window.addEventListener("resize", handleResize);

    // ─── Bind slider events imperatively (avoids Svelte re-render) ───────

    if (sliderEl) {
      sliderEl.addEventListener("input", handleProgressInput);
      sliderEl.addEventListener("change", handleProgressChange);
    }
    if (speedSliderEl) {
      speedSliderEl.addEventListener("input", handleSpeedInput);
    }
    if (playBtnEl) {
      playBtnEl.addEventListener("click", togglePlay);
    }

    // ─── Start! ──────────────────────────────────────────────────────────

    layout = buildLayout(images);
    resetView();

    applyTransform();
    updateVisibleImages(layout);
    updateProgress(layout);
    rafId = requestAnimationFrame(tick);

    // ─── Cleanup ─────────────────────────────────────────────────────────

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);

      carouselEl?.removeEventListener("click", handleCarouselClick);
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("resize", handleResize);

      if (sliderEl) {
        sliderEl.removeEventListener("input", handleProgressInput);
        sliderEl.removeEventListener("change", handleProgressChange);
      }
      if (speedSliderEl) {
        speedSliderEl.removeEventListener("input", handleSpeedInput);
      }
      if (playBtnEl) {
        playBtnEl.removeEventListener("click", togglePlay);
      }

      for (const [, entry] of renderedMap) entry.el.remove();
      renderedMap.clear();
    };
  });
</script>

<svelte:head>
  <title>播放器 — Taggit</title>
</svelte:head>

<div class="browse-player">
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="browse-carousel" bind:this={carouselEl} aria-label="圖片播放區"></div>

  <!-- YouTube-style play/pause feedback -->
  <div class="browse-feedback" bind:this={feedbackEl}></div>

  <div class="browse-dock" class:is-hidden={!autoHide.show}>
    <!-- Play / Pause -->
    <button class="btn-icon" bind:this={playBtnEl}>
      {#if playing}
        <IconPlayerPause size={18} />
      {:else}
        <IconPlayerPlay size={18} />
      {/if}
    </button>

    <!-- Progress -->
    <div class="browse-dock-progress">
      <input bind:this={sliderEl} type="range" min="0" max="1000" value="0" />
      <span bind:this={textEl}>0 / 0</span>
    </div>

    <!-- Speed -->
    <div class="browse-dock-speed">
      <label for="browse-speed">速度</label>
      <input bind:this={speedSliderEl} id="browse-speed" type="range" min="0.2" max="6" step="0.1" value="1.5" />
      <span>{speedDisplay}</span>
    </div>
  </div>
</div>

<style>
  @import "./page.css";
</style>
