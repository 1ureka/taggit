<script lang="ts">
  import { untrack } from "svelte";
  import type { PageData } from "./$types.js";

  import { initBrowse } from "./actions.js";
  import BrowseFilter from "./BrowseFilter.svelte";

  let { data }: { data: PageData } = $props();

  untrack(() => initBrowse(data.allTags));
</script>

<svelte:head>
  <title>Browse — Image Manager</title>
</svelte:head>

<BrowseFilter />
