<script lang="ts">
  import type { TagInfo } from "$lib/types.js";

  let {
    allTags = [],
    excludedTags = [],
    placeholder = "輸入標籤...",
    onselect,
    oncommit,
    onbackspace,
  }: {
    allTags?: TagInfo[];
    excludedTags?: string[];
    placeholder?: string;
    onselect?: (tag: string) => void;
    oncommit?: () => void;
    onbackspace?: () => void;
  } = $props();

  let inputValue = $state("");
  let showDropdown = $state(false);
  let activeIndex = $state(-1);
  let inputEl: HTMLInputElement | undefined = $state();
  let dropdownEl: HTMLDivElement | undefined = $state();
  let flipUp = $state(false);

  let filtered = $derived.by(() => {
    const query = inputValue.trim().toLowerCase();
    const excluded = new Set(excludedTags.map((t) => t.toLowerCase()));
    const available = allTags.filter((t) => !excluded.has(t.name.toLowerCase()));
    if (!query) return available;
    return available.filter((t) => t.name.toLowerCase().includes(query));
  });

  function positionDropdown() {
    if (!inputEl || !dropdownEl) return;
    const rect = inputEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    flipUp = spaceBelow < 224; // 14rem

    dropdownEl.style.left = `${rect.left}px`;
    dropdownEl.style.width = `${rect.width}px`;

    if (flipUp) {
      dropdownEl.style.bottom = `${window.innerHeight - rect.top}px`;
      dropdownEl.style.top = "auto";
    } else {
      dropdownEl.style.top = `${rect.bottom}px`;
      dropdownEl.style.bottom = "auto";
    }
  }

  function open() {
    showDropdown = true;
    activeIndex = -1;
    requestAnimationFrame(positionDropdown);
  }

  function close() {
    setTimeout(() => {
      showDropdown = false;
      activeIndex = -1;
    }, 150);
  }

  function selectTag(name: string) {
    onselect?.(name);
    inputValue = "";
    activeIndex = -1;
    inputEl?.focus();
  }

  function extractAndSelect() {
    const val = inputValue.replace(/[,，]/g, "").trim();
    if (val) {
      selectTag(val);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!showDropdown) open();
      activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === "Escape") {
      if (showDropdown) {
        showDropdown = false;
      } else {
        inputEl?.blur();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        selectTag(filtered[activeIndex].name);
      } else if (inputValue.trim()) {
        selectTag(inputValue.trim());
      } else {
        oncommit?.();
      }
    } else if (e.key === "Tab") {
      if (showDropdown && filtered.length > 0) {
        e.preventDefault();
        const idx = activeIndex >= 0 ? activeIndex : 0;
        selectTag(filtered[idx].name);
      }
    } else if (e.key === "Backspace" && !inputValue) {
      onbackspace?.();
    }
  }

  function handleInput() {
    if (!showDropdown) open();
    activeIndex = -1;
    if (inputValue.includes(",") || inputValue.includes("，")) {
      extractAndSelect();
    }
  }
</script>

<div class="ac-wrapper" style="position:relative;flex:1;">
  <input
    bind:this={inputEl}
    bind:value={inputValue}
    class="input"
    {placeholder}
    oninput={handleInput}
    onfocus={open}
    onblur={close}
    onkeydown={handleKeydown}
    autocomplete="off"
  />

  <div bind:this={dropdownEl} class="ac-dropdown" class:ac-visible={showDropdown && filtered.length > 0}>
    {#each filtered as tag, i}
      <div
        class="ac-item"
        class:ac-active={i === activeIndex}
        onmousedown={(e) => {
          e.preventDefault();
          selectTag(tag.name);
        }}
        onmouseenter={() => (activeIndex = i)}
        role="option"
        tabindex="-1"
        aria-selected={i === activeIndex}
      >
        <span class="ac-item-name">{tag.name}</span>
        <span class="ac-item-count">{tag.count}</span>
      </div>
    {/each}
  </div>
</div>
