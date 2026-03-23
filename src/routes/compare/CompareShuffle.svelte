<script lang="ts">
  import { IconArrowsShuffle } from "@tabler/icons-svelte";
  import { CompareShuffle } from "./compareShuffle.svelte.js";

  const ui = new CompareShuffle();
</script>

<svelte:window onkeydown={ui.handleWindowKeydown} />

<button class="btn-primary" class:pending={ui.disabled} onclick={ui.handleShuffleClick} disabled={ui.disabled}>
  <IconArrowsShuffle size={18} />
  <span>換一組</span><span class="kbd">Space</span>
</button>
