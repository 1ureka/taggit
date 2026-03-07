<script lang="ts">
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import TooSmallOverlay from "$lib/components/TooSmallOverlay.svelte";
  import type { PageData } from "./$types.js";

  import { TaggerContext, setTaggerContext } from "./context.svelte.js";
  import TaggerProgress from "./TaggerProgress.svelte";
  import TaggerSidebar from "./TaggerSidebar.svelte";
  import TaggerPreview from "./TaggerPreview.svelte";
  import TaggerPanel from "./TaggerPanel.svelte";

  let { data }: { data: PageData } = $props();

  const proxy = {
    get list() {
      return data.stagedFiles;
    },
    set list(v: string[]) {
      data.stagedFiles = v;
    },
  };

  const ctx = setTaggerContext(new TaggerContext());
  ctx.list = proxy.list;
  ctx.total = proxy.list.length;

  // 自動選取第一張圖片
  if (ctx.list.length > 0) {
    ctx.cursor = 0;
    ctx.selected = new Set([0]);
  }

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
    <TaggerProgress />
    <main class="tagger-main">
      <TaggerSidebar />
      <TaggerPreview />
      <TaggerPanel />
    </main>
  </div>
{/if}

{#if ctx.pendingConfirm}
  <ConfirmModal
    message={ctx.pendingConfirm.message}
    onconfirm={() => {
      ctx.pendingConfirm?.resolve(true);
      ctx.pendingConfirm = null;
    }}
    oncancel={() => {
      ctx.pendingConfirm?.resolve(false);
      ctx.pendingConfirm = null;
    }}
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
