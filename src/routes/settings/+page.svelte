<script lang="ts">
  import { IconArrowLeft } from "@tabler/icons-svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";
  import type { PageData } from "./$types.js";

  import { SettingsContext, setSettingsContext } from "./context.svelte.js";
  import SettingsNav from "./SettingsNav.svelte";
  import SettingsCollection from "./SettingsCollection.svelte";
  import SettingsTagRename from "./SettingsTagRename.svelte";
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
  };

  const ctx = setSettingsContext(new SettingsContext());
  ctx.collectionRoot = proxy.collectionRoot;
  ctx.alert = params.get("alert");
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
          <SettingsMaintenance />
        {/if}
      </div>
    </main>
  </div>
</div>

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
