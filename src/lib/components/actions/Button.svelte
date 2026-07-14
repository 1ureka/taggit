<script lang="ts">
  import { button } from "$lib/components/actions/ButtonSnippets.svelte";
  import type { ButtonProps } from "$lib/components/actions/ButtonSnippets.svelte";

  let props: ButtonProps = $props();
</script>

{@render button(props)}
