<script lang="ts">
  import type { PageData } from "./$types";
  import { isInEditable } from "$lib/utils/dom";

  import { createPageDataContext } from "./logic/page-data.svelte";
  import { createPlaybackContext } from "./logic/playback.svelte";
  import { createGestureContext } from "./logic/gesture.svelte";
  import { createDockContext } from "./logic/dock.svelte";

  import Strip from "./strip/Strip.svelte";
  import PlayerDock from "./control/Dock.svelte";

  let { data }: { data: PageData } = $props();

  createPageDataContext(() => data);
  const playback = createPlaybackContext();
  const gesture = createGestureContext();
  const dock = createDockContext();

  function handleKeydown(e: KeyboardEvent) {
    if (isInEditable(e.target)) return;

    if (e.key === " ") {
      e.preventDefault();
      playback.handleTogglePlay();
    }

    if (e.key === "Escape") {
      e.preventDefault();
      history.back();
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      playback.handleJump(1);
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      playback.handleJump(-1);
    }
  }
</script>

<svelte:head>
  <title>播放器 — Taggit</title>
</svelte:head>

<svelte:window
  onkeydown={handleKeydown}
  onpointerup={gesture.handlePointerUp}
  onpointercancel={gesture.handlePointerUp}
/>

<Strip />
{#if !dock.hideDock}
  <PlayerDock />
{/if}
