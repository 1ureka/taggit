<script lang="ts">
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import TooSmallOverlay from "$lib/components/TooSmallOverlay.svelte";
  import type { PageData } from "./$types.js";

  import TaggerProgress from "./TaggerProgress.svelte";
  import TaggerLoading from "./TaggerLoading.svelte";
  import TaggerRefresh from "./TaggerRefresh.svelte";
  import TaggerList from "./TaggerList.svelte";
  import TaggerUpload from "./TaggerUpload.svelte";
  import TaggerPreview from "./TaggerPreview.svelte";
  import TaggerForm from "./TaggerForm.svelte";

  let { data }: { data: PageData } = $props();

  // ---

  let currentFile = $state<string | null>(null);
  let selectedFiles = $state<Set<string>>(new Set());
  let loading = $state(false);
  let imageLoading = $state(false);
  let progress = $state(0);

  // ---

  $effect(() => {
    const list = data.stagedFiles;

    // 第一幀或剛上傳 (0 => N)
    if (currentFile === null && list.length > 0) {
      currentFile = list[0];
      selectedFiles = new Set([list[0]]);
      return;
    }

    // 波動 (N => N)
    if (currentFile !== null && list.length > 0) {
      if (!list.includes(currentFile)) {
        currentFile = list[0];
      }
      const next = new Set([...selectedFiles].filter((f) => list.includes(f)));
      if (next.size === 0) {
        selectedFiles = new Set([currentFile]);
      } else if (next.size !== selectedFiles.size) {
        selectedFiles = next;
      }
      return;
    }

    // 全數審查完 (N => 0)
    if (currentFile !== null && list.length <= 0) {
      currentFile = null;
      selectedFiles = new Set();
      return;
    }
  });

  // Viewport guard
  let windowWidth = $state(900);
  let windowHeight = $state(600);
  const MIN_WIDTH = 860;
  const MIN_HEIGHT = 500;
  let tooSmall = $derived(windowWidth < MIN_WIDTH || windowHeight < MIN_HEIGHT);
</script>

<svelte:head>
  <title>Tagger — Image Manager</title>
</svelte:head>

<svelte:window bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} />

{#if tooSmall}
  <TooSmallOverlay
    minWidth={MIN_WIDTH}
    minHeight={MIN_HEIGHT}
    currentWidth={windowWidth}
    currentHeight={windowHeight}
    label="Tagger"
  />
{:else}
  <div class="page">
    <header class="page-header">
      <a href="/" class="btn btn-ghost btn-sm">
        <IconArrowLeft size={16} />
        首頁
      </a>
      <TaggerProgress stagedFiles={data.stagedFiles} {progress} />
      <TaggerLoading {loading} {imageLoading} />
    </header>

    <main class="tagger-main">
      <aside class="tagger-files-panel">
        <TaggerRefresh stagedFiles={data.stagedFiles} {selectedFiles} bind:loading />
        <TaggerList stagedFiles={data.stagedFiles} bind:currentFile bind:selectedFiles />
        <TaggerUpload bind:loading />
      </aside>

      <TaggerPreview {currentFile} bind:imageLoading />

      <aside class="tagger-form-panel">
        <TaggerForm {currentFile} bind:selectedFiles bind:loading bind:progress />

        <div class="separator"></div>

        <div class="tagger-shortcuts">
          {#snippet key(label: string, keys: string[])}
            <div>
              <div>
                {#each keys as k}
                  <span class="kbd">{k}</span>
                {/each}
              </div>
              {label}
            </div>
          {/snippet}
          {@render key("切換圖片", ["←", "→"])}
          {@render key("評等", ["1", "-", "5"])}
          {@render key("聚焦標籤", ["T"])}
          {@render key("提交", ["Enter"])}
        </div>
      </aside>
    </main>
  </div>
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
  }

  .tagger-main {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .tagger-files-panel {
    width: 220px;
    min-width: 220px;
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border);
    background: var(--bg-card);
    overflow: hidden;
  }

  .tagger-form-panel {
    width: 280px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    border-left: 1px solid var(--border);
    background: var(--bg-card);
    overflow-y: auto;
  }

  .tagger-shortcuts {
    display: grid;
    grid-template-columns: max-content 1fr max-content 1fr;
    gap: 0.25rem 2rem;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  .tagger-shortcuts > div {
    grid-column: span 2;
    display: grid;
    grid-template-columns: subgrid;
    align-items: center;
    gap: 0.25rem;
  }
</style>
