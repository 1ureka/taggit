<script lang="ts">
  import { float } from "$lib/client/float.js";
  import { createAutocomplete } from "$lib/client/autocomplete.svelte.js";
  import { IconX } from "@tabler/icons-svelte";

  type Props = {
    /** 雙向綁定：目前選中的標籤列表 */
    tags: string[];
    /** 輸入框佔位符 */
    placeholder?: string;
    /** 空輸入時按 Enter 觸發 */
    onenter?: () => void;
    /** 當標籤變更時觸發 */
    onchange?: () => void;
    /** 前方最多顯示幾個 chip，其餘收入 overflow popover */
    maxVisible?: number;
  };

  let { tags = $bindable([]), placeholder = "輸入標籤...", onenter, onchange, maxVisible = 2 }: Props = $props();

  let overflowBtnEl = $state<HTMLButtonElement>();
  let overflowOpen = $state(false);

  let visibleTags = $derived(tags.slice(0, maxVisible));
  let overflowTags = $derived(tags.slice(maxVisible));
  let overflowCount = $derived(overflowTags.length);

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

  const handleMenuItemMouseDown = (e: MouseEvent, tag: string) => {
    e.preventDefault(); // 阻止按鈕失去 focus，讓 popover 保持開啟直到 count 歸零
    ui.handleChipClick(tag);
  };
</script>

<div class="autocomplete">
  {#each visibleTags as tag}
    <button type="button" class="chip chip-removable" onclick={() => ui.handleChipClick(tag)}>
      {tag}<span class="chip-remove"><IconX size={12} /></span>
    </button>
  {/each}

  <button
    bind:this={overflowBtnEl}
    type="button"
    class="chip overflow-btn"
    class:overflow-btn--hidden={overflowCount === 0}
    aria-label="{overflowCount} 個更多標籤，點擊展開"
    onfocus={() => (overflowOpen = true)}
    onblur={() => (overflowOpen = false)}
  >
    +{overflowCount}
  </button>

  <div
    class="popover overflow-menu"
    use:float={{ reference: overflowBtnEl, open: overflowOpen, placement: "bottom-start", matchWidth: false }}
  >
    {#each overflowTags as tag}
      <button type="button" class="overflow-menu-item" onmousedown={(e) => handleMenuItemMouseDown(e, tag)}>
        <span class="overflow-menu-item-name">{tag}</span>
        <span class="chip-remove"><IconX size={12} /></span>
      </button>
    {/each}
  </div>

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
  .autocomplete {
    position: relative;
    display: flex;
    flex-wrap: nowrap;
    gap: 0.25rem;
    align-items: center;
    min-width: 0;

    & .input {
      min-width: 7rem;
    }
  }

  .overflow-btn {
    flex-shrink: 0;
  }

  .overflow-btn--hidden {
    display: none;
  }

  .overflow-menu {
    min-width: 9rem;
  }

  .overflow-menu-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0.375rem 0.625rem;
    font-size: 0.8125rem;
    font-family: var(--font);
    color: var(--text);
    background: transparent;
    transition: background 0.08s;
    white-space: nowrap;
  }

  .overflow-menu-item:hover {
    background: var(--bg-hover);
  }

  .overflow-menu-item-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 0.5rem;
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
