<script lang="ts">
  import { IconChevronDown } from "@tabler/icons-svelte";
  import { float } from "$lib/client/float.js";
  import { createSelect, type SelectItem } from "$lib/client/select.svelte.js";

  type Props = {
    /** 雙向綁定：目前選中的值 */
    value?: string | number;
    /** 選項列表 */
    options?: SelectItem[];
    /** 大小，預設 "sm" */
    size?: "sm" | "md";
    /** 是否撐滿容器寬度，預設 false */
    stretch?: boolean;
    /** 當選項變更時觸發 */
    onchange?: () => void;
  };

  let { value = $bindable(undefined), options = [], size = "sm", stretch = false, onchange }: Props = $props();

  const ui = createSelect({
    onchange: () => onchange?.(),
    get list() {
      return options;
    },
    set list(v) {
      options = v;
    },
    get value() {
      return value;
    },
    set value(v) {
      value = v;
    },
  });
</script>

<button
  bind:this={ui.triggerEl}
  type="button"
  class="select-trigger"
  class:select-md={size === "md"}
  class:select-sm={size !== "md"}
  class:select-stretch={stretch}
  onclick={ui.handleTriggerClick}
  onkeydown={ui.handleTriggerKeydown}
  onblur={ui.handleTriggerBlur}
>
  <span class="select-label">{ui.selectedLabel}</span>
  <span class="select-chevron" class:select-chevron-open={ui.open}>
    <IconChevronDown size={14} />
  </span>
</button>

<div
  class="select-list"
  role="listbox"
  use:float={{ reference: ui.triggerEl, open: ui.open, placement: "bottom-start" }}
>
  {#each options as opt, i}
    <button
      type="button"
      class="select-option"
      class:select-option-active={opt.value === value}
      onmousedown={(e) => ui.handleOptionMouseDown(e, opt)}
      onmouseenter={() => ui.handleOptionMouseEnter(i)}
      role="option"
      aria-selected={opt.value === value}
    >
      {opt.label}
    </button>
  {/each}
</div>

<style>
  /* 主按鈕: 內部布局 */
  .select-trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-width: 0;
  }

  /* 主按鈕 */
  .select-trigger {
    font-family: var(--font);
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    user-select: none;
    transition: border-color 0.15s;

    &:hover {
      border-color: var(--border-hover);
    }

    /* 主按鈕: 變體 */
    &.select-sm {
      padding: 0.25rem 0.5rem;
      font-size: 0.8125rem;
    }
    &.select-md {
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
    }
    &.select-stretch {
      width: 100%;
      justify-content: space-between;
    }
  }

  /* 主按鈕標籤 */
  .select-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* 主按鈕箭頭 */
  .select-chevron {
    display: flex;
    align-items: center;
    color: var(--text-dim);
    transition: transform 0.15s;
    flex-shrink: 0;

    &.select-chevron-open {
      transform: rotate(180deg);
    }
  }

  /* 列表容器 */
  .select-list {
    position: fixed;
    z-index: 9999;
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

    &:global([data-open="true"]) {
      opacity: 1;
      transform: translateY(0);
      pointer-events: auto;
    }
  }

  /* 列表容器: 設置最大高度並啟用滾動 */
  .select-list {
    max-height: 14rem;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  /* 列表項目(按鈕): 覆蓋原生按鈕樣式 */
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

    &:hover {
      background: var(--bg-hover);
    }
    &.select-option-active {
      color: var(--accent);
      background: var(--bg-active);
    }
  }

  /* 列表項目(按鈕): 使文字溢出時顯示省略號 */
  .select-option {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
