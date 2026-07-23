<script lang="ts">
  import type { HTMLAttributes } from "svelte/elements";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconReload } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";

  type Props = { pending: boolean; onrefresh: () => void } & HTMLAttributes<HTMLButtonElement>;

  const { pending, onrefresh, ...rest }: Props = $props();
</script>

<Button
  variant="ghost"
  padding="icon"
  aria-label="重新整理"
  status={pending ? "pending" : undefined}
  onclick={onrefresh}
  {@attach tooltip({ content: "重新整理" })}
  {...rest}
>
  <IconReload size={16} />
</Button>
