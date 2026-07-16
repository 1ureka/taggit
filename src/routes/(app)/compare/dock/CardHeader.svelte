<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import { IconPinnedOff } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import Button from "$lib/components/actions/Button.svelte";

  let { record, onunpin }: { record: ImageWithId; onunpin: () => void } = $props();
</script>

<header>
  <h3 class="ellipsis">{record.name}</h3>
  <span class="ellipsis" title={record.id}>{record.id}</span>
  <Button
    variant="ghost"
    padding="icon"
    aria-label="取消釘選 {record.id}"
    onclick={onunpin}
    {@attach tooltip({ content: "取消釘選" })}
  >
    <IconPinnedOff size={16} />
  </Button>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem;
    padding-left: 0.75rem;
    border-bottom: var(--border-style);
  }

  header > h3 {
    flex-shrink: 1;
    min-width: 0;
    font: var(--font-body1);
    font-weight: 500;
  }

  header > span {
    flex: 1;
    min-width: 0;
    font: var(--font-caption);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }
</style>
