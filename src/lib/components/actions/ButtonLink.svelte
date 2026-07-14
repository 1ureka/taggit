<script lang="ts">
  import { link } from "$lib/components/actions/ButtonSnippets.svelte";
  import type { LinkProps } from "$lib/components/actions/ButtonSnippets.svelte";

  let props: LinkProps = $props();
</script>

{@render link(props)}
