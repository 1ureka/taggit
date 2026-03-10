<script lang="ts">
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import type { PageData } from "./$types.js";

  import { SettingsContext, setSettingsContext } from "./context.svelte.js";
  import SettingsNav from "./SettingsNav.svelte";
  import SettingsCollection from "./SettingsCollection.svelte";
  import SettingsTagRename from "./SettingsTagRename.svelte";
  import SettingsImages from "./SettingsImages.svelte";
  import SettingsMaintenance from "./SettingsMaintenance.svelte";

  let { data }: { data: PageData } = $props();

  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();

  const proxy = {
    get collectionRoot() {
      return data.collectionRoot;
    },
    set collectionRoot(v: string) {
      data.collectionRoot = v;
    },
    get cacheStats() {
      return data.cacheStats;
    },
  };

  const ctx = setSettingsContext(new SettingsContext());
  ctx.collectionRoot = proxy.collectionRoot;
  ctx.alert = params.get("alert");
  ctx.cacheEntries = proxy.cacheStats.entries;
  ctx.cacheBytes = proxy.cacheStats.bytes;
</script>

<svelte:head>
  <title>Settings — Image Manager</title>
</svelte:head>

<div class="page">
  <header class="page-header">
    <a href="/" class="btn btn-ghost btn-sm">
      <IconArrowLeft size={16} />
      首頁
    </a>
    <span class="page-header-title">設定</span>
  </header>

  <div class="settings-layout">
    <SettingsNav />
    <main class="settings-main" id="settings-main">
      <div class="settings-inner slide-up">
        <SettingsCollection />
        {#if ctx.collectionRoot}
          <SettingsTagRename />
          <SettingsImages />
          <SettingsMaintenance />
        {/if}
      </div>
    </main>
  </div>
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .settings-layout {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .settings-main {
    flex: 1;
    overflow-y: auto;
    scrollbar-gutter: stable;
    min-height: 0;
  }

  .settings-inner {
    max-width: 720px;
    margin: 0 auto;
    padding: 2rem 2rem 6rem;
  }
</style>
