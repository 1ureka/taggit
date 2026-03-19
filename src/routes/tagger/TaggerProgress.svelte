<script lang="ts">
  import { TaggerProgress } from "./taggerProgress.svelte.js";

  type Props = {
    stagedFiles: string[];
    progress: number;
  };

  let { stagedFiles, progress }: Props = $props();

  const ui = new TaggerProgress({
    get stagedFiles() {
      return stagedFiles;
    },
    get progress() {
      return progress;
    },
  });
</script>

<div class="tagger-progress">
  <div class="progress-bar">
    <div class="progress-bar-fill" style="width:{ui.progressPct}%"></div>
  </div>
  <span class="tagger-progress-text">{ui.progressLabel}</span>
</div>

<style>
  .tagger-progress {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: 24rem;
  }

  .tagger-progress-text {
    font-size: 0.75rem;
    color: var(--text-muted);
    white-space: nowrap;
    min-width: 3.5rem;
    text-align: right;
  }
</style>
