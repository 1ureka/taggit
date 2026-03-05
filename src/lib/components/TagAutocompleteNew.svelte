<script lang="ts">
  import type { TagInfo } from "$lib/types.js";
  import { float } from "$lib/client/float.js";
  import { tagCache } from "$lib/client/cache";
  import { IconX } from "@tabler/icons-svelte";

  interface TagAutocompleteProps {
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
  }

  let {
    tags = $bindable([]),
    placeholder = "輸入標籤...",
    onenter,
    onchange,
    variant = "top",
  }: TagAutocompleteProps = $props();

  // ── State ───────────────────────────────────────────────────────────────────

  let inputEl = $state<HTMLInputElement>();
  let allTags = $state<TagInfo[]>([]);
  let inputValue = $state("");
  let showDropdown = $state(false);
  let activeIndex = $state(-1);

  // ── Derived ─────────────────────────────────────────────────────────────────

  let filtered = $derived.by(() => {
    const query = inputValue.trim().toLowerCase();
    const excluded = new Set(tags.map((t) => t.toLowerCase()));
    const available = allTags.filter((t) => !excluded.has(t.name.toLowerCase()));
    if (!query) return available;
    return available.filter((t) => t.name.toLowerCase().includes(query));
  });

  // ── Tag operations ──────────────────────────────────────────────────────────

  function setTags(newTags: string[]) {
    tags = newTags;
    onchange?.();
  }

  function addTag(name: string) {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return;

    const inputTags = normalized
      .split(/[,，]+/)
      .map((t) => t.trim())
      .filter((t) => t)
      .filter((t) => !tags.includes(t));

    const uniqueInputTags = Array.from(new Set(inputTags));

    if (uniqueInputTags.length === 0) return;

    setTags([...tags, ...uniqueInputTags]);

    inputValue = "";
    activeIndex = -1;
    inputEl?.focus();
  }

  function removeTag(name: string) {
    setTags(tags.filter((t) => t !== name));
  }

  function popTag() {
    tags.length > 0 && setTags(tags.slice(0, -1));
  }

  // ── Autocomplete lifecycle ──────────────────────────────────────────────────

  async function openAutocomplete() {
    allTags = await tagCache.get(); // 這會自己請求去重、使用快取、並在後台更新等
    showDropdown = true;
    activeIndex = -1;
  }

  function closeAutocomplete() {
    showDropdown = false;
    activeIndex = -1;
  }

  // ── Event handlers ───────────────────────────────────────────────────────

  function handleInput() {
    if (!showDropdown) openAutocomplete();
    activeIndex = -1;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      closeAutocomplete();
      return;
    }

    if (e.key === "Backspace" && !inputValue) {
      popTag();
      return;
    }

    if (e.key === "Tab" && showDropdown && filtered.length > 0) {
      e.preventDefault();
      const idx = activeIndex >= 0 ? activeIndex : 0;
      addTag(filtered[idx].name);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showDropdown) {
        openAutocomplete();
      } else {
        activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
      }
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        addTag(filtered[activeIndex].name);
        return;
      }

      if (inputValue.trim()) {
        addTag(inputValue.trim());
        return;
      }

      onenter?.();
      return;
    }
  }
</script>

<div class="tag-input" class:tag-input--top={variant === "top"} class:tag-input--inline={variant === "inline"}>
  {#if variant === "top"}
    <!-- chips 區（上方，chips 多時可垂直滾動） -->
    {#if tags.length > 0}
      <div class="chip-list">
        {#each tags as tag}
          <button type="button" class="chip chip-removable" onclick={() => removeTag(tag)}>
            {tag}<span class="chip-remove"><IconX size={12} /></span>
          </button>
        {/each}
      </div>
    {/if}
    <!-- input 佔滿整列 -->
    <input
      bind:this={inputEl}
      bind:value={inputValue}
      class="input"
      {placeholder}
      oninput={handleInput}
      onfocus={openAutocomplete}
      onblur={closeAutocomplete}
      onkeydown={handleKeydown}
      autocomplete="off"
    />
  {:else if variant === "inline"}
    <!-- chips + input 同行，flex-wrap 換行 -->
    {#each tags as tag}
      <button type="button" class="chip chip-removable" onclick={() => removeTag(tag)}>
        {tag}<span class="chip-remove"><IconX size={12} /></span>
      </button>
    {/each}
    <div class="input-wrapper">
      <input
        bind:this={inputEl}
        bind:value={inputValue}
        class="input"
        {placeholder}
        oninput={handleInput}
        onfocus={openAutocomplete}
        onblur={closeAutocomplete}
        onkeydown={handleKeydown}
        autocomplete="off"
      />
    </div>
  {/if}

  <!-- 自動完成 dropdown（float action 會 portal 至 body） -->
  <div class="autocomplete" use:float={{ reference: inputEl, open: showDropdown && filtered.length > 0 }}>
    {#each filtered as tag, i}
      <div
        class="autocomplete-item"
        class:active={i === activeIndex}
        onmousedown={(e) => {
          e.preventDefault();
          addTag(tag.name);
        }}
        onmouseenter={() => (activeIndex = i)}
        role="option"
        tabindex="-1"
        aria-selected={i === activeIndex}
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
