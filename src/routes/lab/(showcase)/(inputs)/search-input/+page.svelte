<script lang="ts">
  import PreviewLayout from "$lib/components/preview/PreviewLayout.svelte";
  import PreviewCanvas from "$lib/components/preview/PreviewCanvas.svelte";
  import TextInput from "$lib/components/inputs/TextInput.svelte";
  import Popover from "$lib/components/floating/Popover.svelte";
  import Chip from "$lib/components/display/Chip.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import { IconSearch, IconX } from "$lib/icons";
  import { addToast } from "$lib/components/floating/toast-events";

  const MAX_HISTORY = 8;

  let value = $state("");
  let inputEl = $state<HTMLInputElement>();
  let inputRoot = $state<HTMLDivElement>();
  let panelRef = $state<HTMLDivElement>();

  let history = $state<string[]>([
    "svelte 5 runes",
    "floating-ui anchor positioning",
    "aria combobox pattern",
    "this is a deliberately long search term meant to overflow the popover and get truncated with an ellipsis",
  ]);

  let open = $state(false);
  const popoverOpen = $derived(open && history.length > 0);

  function addToHistory(term: string) {
    const next = term.trim();
    if (!next) return;
    history = [next, ...history.filter((h) => h.toLowerCase() !== next.toLowerCase())].slice(0, MAX_HISTORY);
  }

  function submitSearch(term: string) {
    const next = term.trim();
    if (!next) return;
    addToHistory(next);
    value = next;
    open = false;
    addToast({ message: `Searching for "${next}"` });
    inputEl?.blur();
  }

  function clearValue() {
    value = "";
    inputEl?.focus();
  }

  function clearHistory() {
    history = [];
  }

  function handleFocus() {
    open = true;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      submitSearch(value);
    }
  }

  function handleWindowClick(e: MouseEvent) {
    if (!open) return;
    const target = e.target;
    if (!(target instanceof Node)) return;
    if (inputRoot?.contains(target) || panelRef?.contains(target)) return;
    open = false;
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      open = false;
      inputEl?.focus();
    }
  }
</script>

<svelte:head>
  <title>Search input: Recent searches</title>
</svelte:head>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

{#snippet input()}
  <TextInput
    bind:input={inputEl}
    bind:root={inputRoot}
    bind:value
    label="Search"
    labelHidden
    placeholder="Search…"
    autocomplete="off"
    onfocus={handleFocus}
    onkeydown={handleKeydown}
    style="width: 100%"
  >
    {#snippet adornmentLeft()}
      <span class="search-icon"><IconSearch size={18} /></span>
    {/snippet}
    {#snippet adornmentRight()}
      <Button
        variant="ghost"
        padding="icon"
        onclick={clearValue}
        style="margin-right: 0.5rem;"
        status={value ? "default" : "disabled"}
      >
        <IconX size={16} />
        <span class="sr-only">Clear search</span>
      </Button>
    {/snippet}
  </TextInput>
{/snippet}

{#snippet popover()}
  <Popover open={popoverOpen} reference={inputRoot} placement="bottom-start" matchWidth>
    <div bind:this={panelRef} class="history-panel">
      <div class="history-header">
        <span class="history-title">Recent Searches</span>
        <Button variant="ghost" padding="icon" onclick={clearHistory} style="font: var(--font-caption);">Clear</Button>
      </div>
      <div class="history-chips">
        {#each history as term (term)}
          <Chip onclick={() => submitSearch(term)}>
            <span class="ellipsis">{term}</span>
          </Chip>
        {/each}
      </div>
    </div>
  </Popover>
{/snippet}

{#snippet preview()}
  <PreviewCanvas>
    <div class="container">
      {@render input()}
      {@render popover()}
    </div>
  </PreviewCanvas>
{/snippet}

<PreviewLayout
  component="TextInput + Popover + Chip"
  label="Search input with recent-search history"
  guide="Not a component — a composition. The popover opens on focus and only when history isn't empty; picking a chip or pressing [[Enter]] fills the input, commits the term to history (deduped, most-recent-first), and closes the popover. `Clear` empties history, which makes the popover stop opening on its own — no separate `open` toggle needed."
  {preview}
/>

<style>
  .container {
    display: flex;
    flex-direction: column;
    width: min(24rem, 100%);
  }

  .search-icon {
    display: flex;
    align-items: center;
    padding-left: 0.75rem;
    color: var(--color-text-muted);
  }

  /* --- */

  .history-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    background-color: var(--color-bg-popover);
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 1.5);
  }

  .history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;

    & > .history-title {
      font: var(--font-caption);
      color: var(--color-text-muted);
    }
  }

  .history-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }
</style>
