<script lang="ts">
  import type { PageData } from "./$types";

  import { createPageDataContext } from "./logic/page-data.svelte";
  import { createPlaybackContext } from "./logic/playback.svelte";
  import { createDockContext } from "./logic/dock.svelte";

  import Strip from "./strip/Strip.svelte";
  import PlayerDock from "./control/Dock.svelte";

  let { data }: { data: PageData } = $props();

  createPageDataContext(() => data);
  const playback = createPlaybackContext();
  const dock = createDockContext();
</script>

<svelte:head>
  <title>播放器 — Taggit</title>
</svelte:head>

<svelte:window
  onkeydown={playback.player.handleKeydown}
  onpointerup={playback.handlePointerUp}
  onpointercancel={playback.handlePointerUp}
/>

<Strip />
{#if !dock.hideDock}
  <PlayerDock />
{/if}
