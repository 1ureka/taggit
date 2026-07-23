<script lang="ts">
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconReload } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";

  const { pending, onrefresh }: { pending: boolean; onrefresh: () => void } = $props();
</script>

<Button
  variant="ghost"
  padding="icon"
  aria-label="重新整理"
  status={pending ? "pending" : undefined}
  onclick={onrefresh}
  {@attach tooltip({ content: "重新整理" })}
>
  <IconReload size={16} />
</Button>
