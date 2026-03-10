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

<Toast />
<ConfirmModal />
{@render children()}
