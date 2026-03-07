<script lang="ts">
  import { untrack } from "svelte";

  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import TooSmallOverlay from "$lib/components/TooSmallOverlay.svelte";
  import type { PageData } from "./$types.js";

  import { uiStore } from "./stores.svelte.js";
  import { initTagger, handleKeydown, resolveConfirm } from "./actions.js";
  import TaggerHeader from "./TaggerHeader.svelte";
  import TaggerSidebar from "./TaggerSidebar.svelte";
  import TaggerPreview from "./TaggerPreview.svelte";
  import TaggerTagPanel from "./TaggerTagPanel.svelte";

  let { data }: { data: PageData } = $props();

  // Initialize all stores from server-loaded data (once, untracked)
  untrack(() => initTagger(data.stagedFiles));

  // Viewport guard (page-local, not business state)
  let windowWidth = $state(900);
  let windowHeight = $state(600);
  const MIN_WIDTH = 860;
  const MIN_HEIGHT = 500;
  let tooSmall = $derived(windowWidth < MIN_WIDTH || windowHeight < MIN_HEIGHT);
</script>

<svelte:head>
  <title>Tagger — Image Manager</title>
</svelte:head>

<svelte:window onkeydown={handleKeydown} bind:innerWidth={windowWidth} bind:innerHeight={windowHeight} />

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
    <TaggerHeader />
    <main class="tagger-main">
      <TaggerSidebar />
      <TaggerPreview />
      <TaggerTagPanel />
    </main>
  </div>
{/if}

{#if uiStore.pendingConfirm}
  <ConfirmModal
    message={uiStore.pendingConfirm.message}
    onconfirm={() => resolveConfirm(true)}
    oncancel={() => resolveConfirm(false)}
  />
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
</style>
