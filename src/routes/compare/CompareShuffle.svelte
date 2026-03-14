<script lang="ts">
  import { IconArrowsShuffle } from "@tabler/icons-svelte";
  import { CompareShuffle } from "./compareShuffle.svelte.js";

  const ui = new CompareShuffle();
</script>

<svelte:window onkeydown={ui.handleWindowKeydown} />

<button class="btn btn-primary" onclick={ui.handleShuffleClick} disabled={ui.disabled}>
  <IconArrowsShuffle size={18} />
  換一組 <span class="kbd">Space</span>
</button>

<style>
  .btn.btn-primary {
    transition: opacity 0s step-start;

    &:disabled {
      opacity: 0.4;
      pointer-events: none;
      transition: opacity 0.2s step-end;
    }
  }
</style>
