<script lang="ts">
  import "$lib/assets/app.css";
  import favicon from "$lib/assets/favicon.svg";
  import { page } from "$app/state";
  import type { Snippet } from "svelte";
  import type { LayoutData } from "./$types";

  import Modal from "$lib/components/floating/Modal.svelte";
  import Tooltip from "$lib/components/floating/Tooltip.svelte";
  import ToastStage from "$lib/components/floating/ToastStage.svelte";
  import ToastList from "$lib/components/floating/ToastList.svelte";
  import NavigationIndicator from "$lib/components/display/NavigationIndicator.svelte";
  import ConfirmDialog from "$lib/widgets/ConfirmDialog.svelte";

  import ModalHeader from "./(layout)/ModalHeader.svelte";
  import ModalLinks from "./(layout)/ModalLinks.svelte";
  import Header from "./(layout)/Header.svelte";

  let { data, children }: { data: LayoutData; children: Snippet } = $props();

  /** 該頁面是否是全螢幕模式（隱藏 header） */
  const fullscreen = $derived(page.url.pathname.includes("player"));

  let modalOpen = $state(false);
  const handleToggleNav = () => (modalOpen = !modalOpen);
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="layout">
  {#if !fullscreen}
    <Header {modalOpen} openModal={handleToggleNav} />
  {/if}
  {@render children()}
</div>

<Modal open={modalOpen} onclose={handleToggleNav} aria-label="導航面板">
  <div class="modal">
    <ModalHeader collectionName={data.collectionName} onnavigate={handleToggleNav} />
    <ModalLinks committedCount={data.committedCount} stagedCount={data.stagedCount} onnavigate={handleToggleNav} />
  </div>
</Modal>

<ConfirmDialog />
<Tooltip />
<ToastStage />
<ToastList />
<NavigationIndicator />

<style>
  .layout {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    height: 100dvh;
    overflow: hidden;
  }

  .modal {
    display: flex;
    flex-direction: column;
    width: 32rem;
    max-width: 100%;
    padding: 0.5rem;
  }
</style>
