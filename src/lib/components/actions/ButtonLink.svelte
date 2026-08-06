<script lang="ts">
  import Button from "$lib/components/actions/ButtonSnippets.svelte";
  import type { LinkProps } from "$lib/components/actions/ButtonSnippets.svelte";

  let props: LinkProps = $props();
</script>

<Button link={props} />
