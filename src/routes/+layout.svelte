<script lang="ts">
  import "$lib/styles/app.css";
  import favicon from "$lib/assets/favicon.svg";
  import Toast from "$lib/components/Toast.svelte";
  import ConfirmModal from "$lib/components/ConfirmModal.svelte";

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<Toast />
<ConfirmModal />

<style>
  :global(body) {
    display: flex;
    flex-direction: column;
    min-width: var(--min-page-width, auto);
    height: 100dvh;
    align-items: stretch;
    overflow: hidden;
  }
</style>
