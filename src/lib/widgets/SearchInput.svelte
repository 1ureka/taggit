<script lang="ts">
  import TextInput from "$lib/components/inputs/TextInput.svelte";
  import Popover from "$lib/components/floating/Popover.svelte";
  import Chip from "$lib/components/display/Chip.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import { IconSearch, IconX } from "$lib/icons";

  const MAX_HISTORY = 8;

  type Props = {
    /** 搜尋關鍵字（雙向綁定），即時同步；onsearch 才代表提交 */
    value: string;
    /** 欄位標籤 */
    label: string;
    /** 是否隱藏標籤（僅供螢幕閱讀器） */
    labelHidden?: boolean;
    /** 輸入框佔位文字 */
    placeholder?: string;
    /** 提交時觸發；空字串代表清除搜尋 */
    onsearch?: (value: string) => void;
  };

  let { value = $bindable(""), label, labelHidden, placeholder, onsearch }: Props = $props();

  let inputEl = $state<HTMLInputElement>();
  let inputRoot = $state<HTMLDivElement>();
  let panelRef = $state<HTMLDivElement>();
  let history = $state<string[]>([]);

  let open = $state(false);
  const popoverOpen = $derived(open && history.length > 0);

  function addToHistory(term: string) {
    const next = term.trim();
    if (!next) return;
    history = [next, ...history.filter((h) => h.toLowerCase() !== next.toLowerCase())].slice(0, MAX_HISTORY);
  }

  function submitSearch(term: string) {
    const next = term.trim();
    addToHistory(next);
    value = next;
    open = false;
    onsearch?.(next);
    inputEl?.blur();
  }

  function clearValue() {
    value = "";
    inputEl?.focus();
    onsearch?.(value);
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

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<TextInput
  bind:input={inputEl}
  bind:root={inputRoot}
  bind:value
  {label}
  {labelHidden}
  {placeholder}
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
      <span class="sr-only">清除搜尋</span>
    </Button>
  {/snippet}
</TextInput>

<Popover open={popoverOpen} reference={inputRoot} placement="bottom-start" matchWidth>
  <div bind:this={panelRef} class="history-panel">
    <div class="history-header">
      <span class="history-title">最近搜尋</span>
      <Button variant="ghost" padding="icon" onclick={clearHistory} style="font: var(--font-caption);">清空</Button>
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

<style>
  .search-icon {
    display: flex;
    align-items: center;
    padding-left: 0.75rem;
    color: var(--color-text-muted);
  }

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
