<script lang="ts">
  import { fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import type { ImageWithId } from "$lib/database";
  import type { Player } from "$lib/virtualizer/player.svelte";

  import { IconPlayerPlayFilled, IconPlayerPauseFilled } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import DockProgress from "./DockProgress.svelte";

  let { player }: { player: Player<ImageWithId> } = $props();
</script>

<aside aria-label="圖片播放器控制區" transition:fly={{ y: 20, duration: 300, easing: cubicOut }}>
  <Button variant="outlined" padding="icon" aria-label="播放/暫停" onclick={player.handlePlayButtonClick}>
    {#if player.playing}
      <IconPlayerPauseFilled size={18} />
    {:else}
      <IconPlayerPlayFilled size={18} />
    {/if}
  </Button>

  <div class="progress">
    <DockProgress
      aria-label="播放進度"
      type="range"
      min="0"
      max="1000"
      value={player.progress.progressValue}
      oninput={player.handleProgressInput}
      onchange={player.handleProgressChange}
      style="width: 100%;"
    />
    <span>{player.progressText}</span>
  </div>

  <div class="speed">
    <label for="player-speed">速度</label>
    <DockProgress
      id="player-speed"
      min="-6"
      max="6"
      step="0.5"
      value={player.speed}
      oninput={player.handleSpeedInput}
      style="width: 80px;"
    />
    <span>{player.speedDisplay}</span>
  </div>
</aside>

<style>
  aside {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 1rem;
    background-color: hsl(from var(--color-bg) h s l / 0.85);
    backdrop-filter: blur(8px);
    border-top: var(--border-style);
  }

  aside > .progress {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;

    & > span {
      font: var(--font-caption);
      font-family: var(--font-family-mono);
      color: var(--color-text-muted);
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
      font: var(--font-caption);
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    & > span {
      font: var(--font-caption);
      font-family: var(--font-family-mono);
      color: var(--color-text-muted);
      min-width: 2.5rem;
      text-align: center;
    }
  }
</style>
