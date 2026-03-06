<script lang="ts">
  import { float } from "$lib/client/float.js";
  import { IconX } from "@tabler/icons-svelte";
  import { createAutocomplete } from "$lib/client/autocomplete.svelte.js";

  type Props = {
    /** 雙向綁定：目前選中的標籤列表 */
    tags: string[];
    /** 輸入框佔位符，預設 "輸入標籤..." */
    placeholder?: string;
    /** 空輸入時按 Enter 觸發（非新增標籤行為）。用於 tagger 的「提交」等外部動作 */
    onenter?: () => void;
    /** 當標籤變更時觸發 */
    onchange?: () => void;
    /** 佈局變體（compact 請改用 TagAutocompleteCompact） */
    variant?: "top" | "inline";
  };

  let { tags = $bindable([]), placeholder = "輸入標籤...", onenter, onchange, variant = "top" }: Props = $props();

  const ui = createAutocomplete({
    onchange: () => onchange?.(),
    onenter: () => onenter?.(),
    get selectedTags() {
      return tags;
    },
    set selectedTags(v) {
      tags = v;
    },
  });
</script>

<div class="autocomplete" class:autocomplete--top={variant === "top"} class:autocomplete--inline={variant === "inline"}>
  {#if tags.length > 0}
    <div class="chip-list">
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
    class="input"
    {placeholder}
    oninput={ui.handleInput}
    onfocus={ui.handleInputFocus}
    onblur={ui.handleInputBlur}
    onkeydown={ui.handleInputKeydown}
    autocomplete="off"
  />

  <div class="popover" use:float={{ reference: ui.inputEl, open: ui.showDropdown && ui.dropdownTags.length > 0 }}>
    {#each ui.dropdownTags as tag, i}
      <div
        class="autocomplete-item"
        class:active={i === ui.activeIndex}
        onmousedown={(e) => ui.handleDropdownMouseDown(e, tag)}
        onmouseenter={() => ui.handleDropdownMouseOver(i)}
        role="option"
        tabindex="-1"
        aria-selected={i === ui.activeIndex}
      >
        <span class="autocomplete-item-name">{tag.name}</span>
        <span class="autocomplete-item-count">{tag.count}</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .chip-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-content: flex-start;
  }

  .autocomplete {
    position: relative;
    display: flex;
    gap: 0.5rem;
  }

  .autocomplete--top {
    flex-direction: column;

    & .input {
      width: 100%;
    }
  }

  .autocomplete--inline {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;

    & .input {
      flex: 1;
      min-width: 7rem;
    }
  }

  .autocomplete-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.375rem 0.625rem;
    font-size: 0.8125rem;
    cursor: pointer;
    transition: background 0.08s;
  }

  .autocomplete-item:hover,
  .autocomplete-item.active {
    background: var(--bg-hover);
  }

  .autocomplete-item-name {
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .autocomplete-item-count {
    font-size: 0.6875rem;
    color: var(--text-dim);
    font-family: var(--font-mono);
    margin-left: 0.5rem;
    flex-shrink: 0;
  }
</style>
