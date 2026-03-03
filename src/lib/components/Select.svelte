<script lang="ts">
  import { IconChevronDown } from "@tabler/icons-svelte";
  import { float } from "$lib/client/float.js";

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
  @import "../styles/Select.css";

  /* data-open driven by the float action — portalled node needs :global() */
  :global(.select-list[data-open="true"]) {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }
</style>
