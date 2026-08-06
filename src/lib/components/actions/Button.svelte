<script lang="ts">
  import Button from "$lib/components/actions/ButtonSnippets.svelte";
  import type { ButtonProps } from "$lib/components/actions/ButtonSnippets.svelte";

  let props: ButtonProps = $props();
</script>

<Button button={props} />
