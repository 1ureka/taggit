<script lang="ts">
  import type { PageData } from "./$types";
  import { isInEditable } from "$lib/utils/dom";

  import { createPageDataContext } from "./logic/page-data.svelte";
  import { createPlaybackContext } from "./logic/playback.svelte";
  import { createPickContext } from "./logic/pick.svelte";
  import { createGestureContext } from "./logic/gesture.svelte";
  import { createDockContext } from "./logic/dock.svelte";

  import Strip from "./view/Strip.svelte";
  import Dock from "./view/Dock.svelte";
  import PickTooltip from "./view/PickTooltip.svelte";

  let { data }: { data: PageData } = $props();

  createPageDataContext(() => data);
  const playback = createPlaybackContext();
  const pick = createPickContext();
  const gesture = createGestureContext();
  createDockContext();

  function handleKeydown(e: KeyboardEvent) {
    // Ctrl 不會輸入字元，即使焦點還留在控制列的滑桿上也應該生效
    if (e.key === "Control") {
      pick.handleActivate();
      return;
    }

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

  function handleKeyup(e: KeyboardEvent) {
    if (e.key === "Control") pick.handleDeactivate();
  }
</script>

<svelte:head>
  <title>播放圖片 · Taggit</title>
</svelte:head>

<svelte:window
  onkeydown={handleKeydown}
  onkeyup={handleKeyup}
  onblur={pick.handleDeactivate}
  onpointerup={gesture.handlePointerUp}
  onpointercancel={gesture.handlePointerUp}
/>

<Strip />
<Dock />
<PickTooltip />
