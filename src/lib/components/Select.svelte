<script lang="ts" generics="T">
  import { IconChevronDown } from "@tabler/icons-svelte";
  import { float } from "$lib/client/float.js";
  import { Select, type SelectItem } from "$lib/ui/select.svelte.js";

  type Props = {
    /** 雙向綁定：目前選中的值 */
    value: T | undefined;
    /** 選項列表 */
    options: SelectItem<T>[];
    /** 大小，預設 "sm" */
    size?: "sm" | "md";
    /** 是否撐滿容器寬度，預設 false */
    stretch?: boolean;
    /** 當選項變更時觸發 */
    onchange?: (value: T) => void;
  };

  let { value = $bindable(undefined), options, size = "sm", stretch = false, onchange }: Props = $props();

  const ui = new Select<T>({
    onchange: (v) => onchange?.(v),
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

<div class="popover" role="listbox" use:float={{ reference: ui.triggerEl, open: ui.open, placement: "bottom-start" }}>
  {#each options as opt, i}
    <button
      type="button"
      class="select-option"
      class:select-option-active={i === ui.activeIndex}
      class:select-option-selected={opt.value === value}
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
    border: var(--border-style);
    border-radius: var(--radius);
    cursor: pointer;
    user-select: none;

    &:hover {
      border-color: var(--border-hover);
    }

    /* 主按鈕: 變體 */
    &.select-sm {
      padding: 0px 0.5rem;
      height: 1.75rem;
      font-size: 0.8125rem;
    }
    &.select-md {
      padding: 0px 0.75rem;
      height: 2rem;
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

  /* 列表項目(按鈕): 覆蓋原生按鈕樣式 */
  .select-option {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.375rem 0.625rem;
    font-size: 0.8125rem;
    color: var(--text);
    background: transparent;
    transition: background 0.08s;

    &:hover {
      background: var(--bg-hover);
    }
    &.select-option-active {
      color: var(--accent);
      background: var(--bg-hover);
    }
    &.select-option-selected {
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
