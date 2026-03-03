<script lang="ts">
  import { untrack } from "svelte";

  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import TooSmallOverlay from "$lib/components/TooSmallOverlay.svelte";
  import type { PageData } from "./$types.js";

  import { TaggerState } from "./tagger-state.svelte.js";
  import TaggerHeader from "./TaggerHeader.svelte";
  import TaggerSidebar from "./TaggerSidebar.svelte";
  import TaggerPreview from "./TaggerPreview.svelte";
  import TaggerTagPanel from "./TaggerTagPanel.svelte";
  import TaggerToolsModal from "./TaggerToolsModal.svelte";

  let { data }: { data: PageData } = $props();

  const tagger = new TaggerState(
    untrack(() => data.stagedFiles),
    untrack(() => data.allTags),
  );

  // Component refs (UI-only side-effects)
  let sidebarRef = $state<TaggerSidebar>();
  let previewRef = $state<TaggerPreview>();
  let tagPanelRef = $state<TaggerTagPanel>();

  // Viewport guard
  let windowWidth = $state(900);
  let windowHeight = $state(600);
  const MIN_WIDTH = 860;
  const MIN_HEIGHT = 500;
  let tooSmall = $derived(windowWidth < MIN_WIDTH || windowHeight < MIN_HEIGHT);

  // Wire UI callbacks once
  $effect(() => {
    tagger.onNavigate = () => {
      sidebarRef?.scrollToActive(tagger.cursor);
      previewRef?.resetZoom();
    };
    tagger.onFocusInput = () => tagPanelRef?.focusInput();
  });

  // Select first image when list loads
  $effect(() => {
    if (tagger.files.length > 0 && tagger.cursor < 0) {
      tagger.select(0);
    }
  });
</script>

<svelte:head>
  <title>Tagger — Image Manager</title>
</svelte:head>

<svelte:window onkeydown={tagger.handleKeydown} bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} />

<TaggerHeader
  progressPct={tagger.progressPct}
  progressLabel={tagger.progressLabel}
  onopentools={() => (tagger.toolsOpen = true)}
/>

{#if tooSmall}
  <TooSmallOverlay
    minWidth={MIN_WIDTH}
    minHeight={MIN_HEIGHT}
    currentWidth={windowWidth}
    currentHeight={windowHeight}
    label="Tagger"
  />
{:else}
  <main class="tagger-main">
    <TaggerSidebar bind:this={sidebarRef} {tagger} />

    <TaggerPreview
      bind:this={previewRef}
      currentFilename={tagger.currentFile}
      previewSrc={tagger.previewUrl}
      selectedCount={tagger.selectedCount}
    />

    <TaggerTagPanel bind:this={tagPanelRef} {tagger} />
  </main>
{/if}

<TaggerToolsModal
  bind:show={tagger.toolsOpen}
  allTags={tagger.knownTags}
  ontagschanged={() => tagger.refreshKnownTags()}
/>

{#if tagger.pendingConfirm}
  <ConfirmModal
    message={tagger.pendingConfirm.message}
    onconfirm={() => tagger.resolveConfirm(true)}
    oncancel={() => tagger.resolveConfirm(false)}
  />
{/if}

<style>
  .tagger-main {
    display: flex;
    height: calc(100vh - 3rem);
    margin-top: 3rem;
  }
</style>
