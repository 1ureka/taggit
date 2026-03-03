<script lang="ts">
  import { IconChevronDown } from "@tabler/icons-svelte";
  import { float } from "$lib/actions/float.js";

  type Option = { value: string | number | undefined; label: string };

  let {
    value = $bindable(undefined),
    options = [],
    size = "sm",
    stretch = false,
    onchange,
  }: {
    value?: string | number | undefined;
    options?: Option[];
    size?: "sm" | "md";
    stretch?: boolean;
    onchange?: () => void;
  } = $props();

  let open = $state(false);
  let triggerEl: HTMLButtonElement | undefined = $state();
  let listEl: HTMLDivElement | undefined = $state();

  let selectedLabel = $derived(options.find((o) => o.value === value)?.label ?? options[0]?.label ?? "");

  function toggle() {
    open = !open;
  }

  function select(opt: Option) {
    value = opt.value as typeof value;
    open = false;
    onchange?.();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      open = false;
      triggerEl?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      if (!open) {
        e.preventDefault();
        toggle();
      }
    }
  }

  function handleBlur(e: FocusEvent) {
    setTimeout(() => {
      if (!triggerEl?.contains(document.activeElement) && !listEl?.contains(document.activeElement)) {
        open = false;
      }
    }, 120);
  }
</script>

<button
  bind:this={triggerEl}
  type="button"
  class="select-trigger {size === 'md' ? 'select-md' : 'select-sm'}"
  class:select-stretch={stretch}
  onclick={toggle}
  onkeydown={handleKeydown}
  onblur={handleBlur}
>
  <span class="select-label">{selectedLabel}</span>
  <span class="select-chevron" class:select-chevron-open={open}>
    <IconChevronDown size={14} />
  </span>
</button>

<div
  bind:this={listEl}
  class="select-list"
  class:select-list-visible={open}
  role="listbox"
  use:float={{ reference: triggerEl, open, placement: "bottom-start", matchWidth: false, matchMinWidth: true }}
>
  {#each options as opt}
    <button
      type="button"
      class="select-option"
      class:select-option-active={opt.value === value}
      onmousedown={(e) => {
        e.preventDefault();
        select(opt);
      }}
      role="option"
      aria-selected={opt.value === value}
    >
      {opt.label}
    </button>
  {/each}
</div>

<style>
  .select-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-family: var(--font);
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;
    user-select: none;
    white-space: nowrap;
    min-width: 0;
  }

  .select-trigger:hover {
    border-color: var(--border-hover);
  }

  .select-trigger:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  .select-sm {
    padding: 0.25rem 0.5rem;
    font-size: 0.8125rem;
  }

  .select-md {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
  }

  .select-stretch {
    width: 100%;
    justify-content: space-between;
  }

  .select-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .select-chevron {
    display: flex;
    align-items: center;
    color: var(--text-dim);
    transition: transform 0.15s;
    flex-shrink: 0;
  }

  .select-chevron-open {
    transform: rotate(180deg);
  }

  /* ── Dropdown list (portalled to body by float action) ── */
  .select-list {
    position: absolute;
    z-index: 9999;
    max-height: 14rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);
    padding: 0.25rem 0;
    opacity: 0;
    transform: translateY(-4px);
    pointer-events: none;
    transition:
      opacity 0.12s ease-out,
      transform 0.12s ease-out;
    left: 0;
    top: 0;
  }

  .select-list-visible {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  .select-option {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.375rem 0.625rem;
    font-family: var(--font);
    font-size: 0.8125rem;
    color: var(--text);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.08s;
    white-space: nowrap;
  }

  .select-option:hover {
    background: var(--bg-hover);
  }

  .select-option-active {
    color: var(--accent);
    background: var(--bg-active);
  }
</style>
