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
  import TaggerToolsModal from "./TaggerModalTools.svelte";
  import RenameTagModal from "./TaggerModalRename.svelte";

  let { data }: { data: PageData } = $props();

  // Initialize all stores from server-loaded data (once, untracked)
  untrack(() => initTagger(data.stagedFiles, data.allTags));

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

<TaggerHeader />

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
    <TaggerSidebar />
    <TaggerPreview />
    <TaggerTagPanel />
  </main>
{/if}

<TaggerToolsModal />
<RenameTagModal />

{#if uiStore.pendingConfirm}
  <ConfirmModal
    message={uiStore.pendingConfirm.message}
    onconfirm={() => resolveConfirm(true)}
    oncancel={() => resolveConfirm(false)}
  />
{/if}

<style>
  .tagger-main {
    display: flex;
    height: calc(100vh - 3rem);
    margin-top: 3rem;
  }
</style>
