<script lang="ts">
  import { float } from "$lib/client/float.js";
  import { createAutocomplete } from "$lib/client/autocomplete.svelte.js";
  import { IconX } from "@tabler/icons-svelte";

  interface Props {
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
  }

  let { tags = $bindable([]), placeholder = "輸入標籤...", onenter, onchange, maxVisible = 2 }: Props = $props();

  let overflowBtnEl = $state<HTMLButtonElement>();
  let overflowOpen = $state(false);

  // ── Autocomplete core ─────────────────────────────────────────────────────────

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

  // ── Derived ───────────────────────────────────────────────────────────────────

  let visibleTags = $derived(tags.slice(0, maxVisible));
  let overflowTags = $derived(tags.slice(maxVisible));
  let overflowCount = $derived(overflowTags.length);
</script>

<div class="tag-compact">
  <!-- 可見 chips -->
  {#each visibleTags as tag}
    <button type="button" class="chip chip-removable" onclick={() => ui.handleChipClick(tag)}>
      {tag}<span class="chip-remove"><IconX size={12} /></span>
    </button>
  {/each}

  <!--
    overflow 按鈕：始終掛載（保持 bind:this 穩定），overflowCount=0 時以 display:none 隱藏。
    隱藏時無法聚焦，所以 overflowOpen 不需要額外的 $effect 同步歸零。
    popover 完全以此按鈕的 focus/blur 狀態驅動：
      - onfocus  → 開啟
      - onblur   → 關閉（blur 在 mousedown 之後，但 items 用 e.preventDefault() 阻止 blur）
    overflow items 用 onmousedown + e.preventDefault() 確保點擊時按鈕不失去 focus，
    操作完成後若 overflowCount 歸零，按鈕被 display:none，瀏覽器自然觸發 blur 關閉 popover。
  -->
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

  <!-- overflow popover（float 至 body） -->
  <div
    class="overflow-menu"
    use:float={{ reference: overflowBtnEl, open: overflowOpen, placement: "bottom-start", matchWidth: false }}
  >
    {#each overflowTags as tag}
      <button
        type="button"
        class="overflow-menu-item"
        onmousedown={(e) => {
          e.preventDefault(); // 阻止按鈕失去 focus，讓 popover 保持開啟直到 count 歸零
          ui.handleChipClick(tag);
        }}
      >
        <span class="overflow-item-name">{tag}</span>
        <span class="chip-remove"><IconX size={12} /></span>
      </button>
    {/each}
  </div>

  <!-- input -->
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

  <!-- autocomplete dropdown（float 至 body） -->
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
  /* ── Root ────────────────────────────────────────────────────────────────────── */

  .tag-compact {
    position: relative;
    display: flex;
    flex-wrap: nowrap;
    gap: 0.25rem;
    align-items: center;
    min-width: 0;
  }

  /* ── overflow 按鈕 ──────────────────────────────────────────────────────────── */

  .overflow-btn {
    cursor: pointer;
    flex-shrink: 0;
  }

  .overflow-btn--hidden {
    display: none;
  }

  /* ── overflow popover（portalled，與 Select / autocomplete 樣式一致）───────── */

  .overflow-menu {
    position: fixed;
    z-index: 9999;
    min-width: 9rem;
    max-height: 14rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 0.25rem 0;
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

  .overflow-menu:global([data-open="true"]) {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
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
    border: none;
    cursor: pointer;
    transition: background 0.08s;
    white-space: nowrap;
  }

  .overflow-menu-item:hover {
    background: var(--bg-hover);
  }

  .overflow-item-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-right: 0.5rem;
  }

  /* ── input wrapper ──────────────────────────────────────────────────────────── */

  .input-wrapper {
    flex: 1;
    min-width: 7rem;
  }

  .input-wrapper .input {
    width: 100%;
  }

  /* ── autocomplete dropdown（portalled）────────────────────────────────────── */

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
