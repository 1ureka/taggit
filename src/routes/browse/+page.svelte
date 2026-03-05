<script lang="ts">
  import { initBrowse } from "./actions.js";
  import BrowseFilter from "./BrowseFilter.svelte";
  initBrowse();
</script>

<svelte:head>
  <title>Browse — Image Manager</title>
</svelte:head>

<BrowseFilter />
