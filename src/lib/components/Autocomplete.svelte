<script lang="ts">
  import { float } from "$lib/client/float.js";
  import { IconX } from "@tabler/icons-svelte";
  import { createAutocomplete } from "$lib/client/autocomplete.svelte.js";

  type Props = {
    /** 雙向綁定：目前選中的標籤列表 */
    tags: string[]; // $bindable
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

<div class="tag-input" class:tag-input--top={variant === "top"} class:tag-input--inline={variant === "inline"}>
  {#if variant === "top"}
    <!-- chips 區（上方，chips 多時可垂直滾動） -->
    {#if tags.length > 0}
      <div class="chip-list">
        {#each tags as tag}
          <button type="button" class="chip chip-removable" onclick={() => ui.handleChipClick(tag)}>
            {tag}<span class="chip-remove"><IconX size={12} /></span>
          </button>
        {/each}
      </div>
    {/if}
    <!-- input 佔滿整列 -->
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
  {:else if variant === "inline"}
    <!-- chips + input 同行，flex-wrap 換行 -->
    {#each tags as tag}
      <button type="button" class="chip chip-removable" onclick={() => ui.handleChipClick(tag)}>
        {tag}<span class="chip-remove"><IconX size={12} /></span>
      </button>
    {/each}
    <div class="input-wrapper">
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
    </div>
  {/if}

  <!-- 自動完成 dropdown（float action 會 portal 至 body） -->
  <div class="autocomplete" use:float={{ reference: ui.inputEl, open: ui.showDropdown && ui.dropdownTags.length > 0 }}>
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
  /* ── Root ──────────────────────────────────────────────────────────────────── */

  .tag-input {
    position: relative;
  }

  /* ── Variant: top ──────────────────────────────────────────────────────────── */

  .tag-input--top {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  /* chips 區 */
  .chip-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    align-content: flex-start;
  }

  /* input 在 top variant 下佔滿整列 */
  .tag-input--top .input {
    width: 100%;
  }

  /* ── Variant: inline ───────────────────────────────────────────────────────── */

  .tag-input--inline {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
  }

  .input-wrapper {
    flex: 1;
    min-width: 7rem;
  }

  .input-wrapper .input {
    width: 100%;
  }

  /* ── Autocomplete dropdown (portalled via float) ───────────────────────────── */

  .autocomplete {
    position: fixed;
    z-index: 9999;
    max-height: 14rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
    left: 0;
    top: 0;
    opacity: 0;
    transform: translateY(-4px);
    pointer-events: none;
    transition:
      opacity 0.12s ease-out,
      transform 0.12s ease-out;
  }

  .autocomplete:global([data-open="true"]) {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
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
