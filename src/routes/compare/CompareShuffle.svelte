<script lang="ts">
  import { IconArrowsShuffle } from "@tabler/icons-svelte";
  import { CompareShuffle } from "./compareShuffle.svelte.js";

  const ui = new CompareShuffle();
</script>

<svelte:window onkeydown={ui.handleWindowKeydown} />

<button
  class="btn btn-primary defer-dim"
  class:pending={ui.disabled}
  onclick={ui.handleShuffleClick}
  disabled={ui.disabled}
>
  <IconArrowsShuffle size={18} />
  換一組 <span class="kbd">Space</span>
</button>
