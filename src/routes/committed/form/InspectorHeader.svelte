<script lang="ts">
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconX } from "$lib/icons";

  import Button from "$lib/components/actions/Button.svelte";
  import Chip from "$lib/components/display/Chip.svelte";

  import { getPageDataContext } from "../logic/page-data.svelte";
  import { getPointersContext } from "../logic/pointers.svelte";
  import { getSelectionContext } from "../logic/selection.svelte";

  const pageData = getPageDataContext();
  const pointers = getPointersContext();
  const selection = getSelectionContext();

  const file = $derived(pointers.editing?.id ?? null);
  const total = $derived(pageData.value.items.length);
</script>

<header>
  {#if selection.active}
    <!-- TODO: 多選模式的 header -->
    <div>測試 header!</div>
  {:else if file !== null}
    <h3 class="ellipsis" title={pointers.editing?.id ?? ""}>{pointers.editing?.id}</h3>

    <Chip variant="outlined" style="font: var(--font-caption);">{`${pointers.editing?.index} / ${total}`}</Chip>

    <Button
      variant="ghost"
      padding="icon"
      aria-label="關閉表單"
      onclick={pointers.handleClose}
      {@attach tooltip({ content: "關閉表單" })}
    >
      <IconX size={16} />
    </Button>
  {/if}
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0px 0.75rem;
    height: 2.5rem;
    min-height: 2.5rem;
    border-bottom: var(--border-style);
  }

  h3 {
    flex: 1;
    font: var(--font-body2);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }
</style>
