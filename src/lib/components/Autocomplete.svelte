<script lang="ts">
  import { IconX } from "$lib/icons";
  import { Autocomplete } from "$lib/ui/autocomplete.svelte.js";
  import Popover from "$lib/components/Popover.svelte";

  type Props = {
    /** 欄位名稱，用於表單提交。每個標籤會生成一個同名 hidden input。 */
    name?: string;
    /** 雙向綁定：目前選中的標籤列表 */
    tags: string[];
    /** 輸入框佔位符，預設 "輸入標籤..." */
    placeholder?: string;
    /** 當標籤變更時觸發 */
    onchange?: () => void;
    /** 佈局變體 */
    variant?: "top" | "inline";
  };

  let { name, tags = $bindable([]), placeholder = "輸入標籤...", onchange, variant = "top" }: Props = $props();

  const itemHeight = 32;

  const ui = new Autocomplete({
    get selectedTags() {
      return tags;
    },
    set selectedTags(v) {
      tags = v;
    },
    onchange: () => onchange?.(),
    itemHeight,
  });
</script>

{#if name}
  {#each tags as tag}
    <input type="hidden" {name} value={tag} />
  {/each}
{/if}

<div class="autocomplete" class:top={variant === "top"} class:inline={variant === "inline"}>
  {#if tags.length > 0}
    <div class="tags">
      {#each tags as tag}
        <button type="button" class="chip chip-removable" onclick={() => ui.handleChipClick(tag)}>
          {tag}<span class="chip-remove"><IconX size={12} /></span>
        </button>
      {/each}
    </div>
  {/if}

  <input
    bind:this={ui.inputEl}
    bind:value={ui.inputValue}
    class="text-input"
    {placeholder}
    oninput={ui.handleInput}
    onfocus={ui.handleInputFocus}
    onblur={ui.handleInputBlur}
    onkeydown={ui.handleInputKeydown}
    autocomplete="off"
  />

  <Popover
    bind:el={ui.scrollContainer}
    role="listbox"
    open={ui.showDropdown && ui.dropdownTags.length > 0}
    reference={ui.inputEl}
    matchWidth
  >
    {#each ui.dropdownTags as tag, i}
      <div
        role="option"
        tabindex="-1"
        class:active={i === ui.activeIndex}
        aria-selected={i === ui.activeIndex}
        onmousedown={(e) => ui.handleDropdownMouseDown(e, tag)}
        onmouseenter={() => ui.handleDropdownMouseOver(i)}
        style="height: {itemHeight}px; min-height: {itemHeight}px;"
      >
        <span class="name">{tag.name}</span>
        <span class="count">{tag.count}</span>
      </div>
    {/each}
  </Popover>
</div>

<style>
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-content: flex-start;
    max-width: 100%;
  }

  div.autocomplete {
    position: relative;
    display: flex;
    gap: 0.5rem;

    &.top {
      flex-direction: column;

      & > .text-input {
        width: 100%;
      }
    }

    &.inline {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: center;

      & > .text-input {
        flex: 1;
        min-width: 7rem;
      }
    }
  }

  div[role="option"] {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0 0.625rem;
    font-size: var(--font-size-body2);
    cursor: pointer;

    &:hover,
    &.active {
      background: var(--bg-hover);
    }
  }

  div[role="option"] > .name {
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  div[role="option"] > .count {
    font-size: var(--font-size-caption);
    color: var(--text-dim);
    font-family: var(--font-mono);
    flex-shrink: 0;
  }
</style>
