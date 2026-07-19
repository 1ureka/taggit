<script lang="ts">
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconX } from "$lib/icons";
  import Button from "$lib/components/actions/Button.svelte";
  import Chip from "$lib/components/display/Chip.svelte";

  import { getPageDataContext } from "../logic/page-data.svelte";
  import { getEditorContext } from "../logic/editor.svelte";

  const pageData = getPageDataContext();
  const editor = getEditorContext();

  const fileCount = $derived(pageData.value.stagedFiles.length);
</script>

<header>
  <h3 class="ellipsis" title={editor.activeFile ?? ""}>{editor.activeFile}</h3>
  <Chip variant="outlined" style="font: var(--font-caption);">{`${editor.activeIndex} / ${fileCount}`}</Chip>
  <Button
    variant="ghost"
    padding="icon"
    aria-label="關閉表單"
    onclick={editor.handleClose}
    {@attach tooltip({ content: "關閉表單" })}
  >
    <IconX size={16} />
  </Button>
</header>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
