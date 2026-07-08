<script lang="ts" generics="T">
  import { IconChevronDown } from "$lib/components/icons";
  import { Select, type SelectItem } from "$lib/ui/select.svelte.js";
  import Popover from "$lib/components/Popover.svelte";

  type Props = {
    /** 雙向綁定：目前選中的值 */
    value: T | undefined;
    /** 選項列表 */
    options: SelectItem<T>[];
    /** 是否撐滿容器寬度，預設 false */
    stretch?: boolean;
    /** 當選項變更時觸發 */
    onchange?: (value: T) => void;
  };

  let { value = $bindable(undefined), options, stretch = false, onchange }: Props = $props();

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
  class="trigger"
  class:stretch
  onclick={ui.handleTriggerClick}
  onkeydown={ui.handleTriggerKeydown}
  onblur={ui.handleTriggerBlur}
  aria-expanded={ui.open}
  aria-haspopup="listbox"
>
  <span class="ellipsis">{ui.selectedLabel}</span>
  <span class="chevron" class:open={ui.open}>
    <IconChevronDown size={14} />
  </span>
</button>

<Popover role="listbox" open={ui.open} reference={ui.triggerEl} placement="bottom-start" matchWidth>
  {#each options as opt, i}
    <button
      type="button"
      role="option"
      class="option ellipsis"
      class:active={i === ui.activeIndex}
      class:selected={opt.value === value}
      aria-selected={opt.value === value}
      onmousedown={(e) => ui.handleOptionMouseDown(e, opt)}
      onmouseenter={() => ui.handleOptionMouseEnter(i)}
    >
      {opt.label}
    </button>
  {/each}
</Popover>

<style>
  button.trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0px 0.75rem;
    height: 2rem;
    min-width: 0;
  }

  button.trigger {
    font-family: var(--font);
    font-size: var(--font-size-body1);
    color: var(--text);
    background: var(--bg);
    border: var(--border-style);
    border-radius: var(--radius);
    cursor: pointer;
    user-select: none;

    &:hover {
      border-color: var(--border-hover);
    }

    &.stretch {
      display: flex;
      justify-content: space-between;
      width: 100%;
    }
  }

  button.trigger > .chevron {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--text-dim);
    transition: transform 0.15s;

    &.open {
      transform: rotate(180deg);
    }
  }

  /* --- */

  button.option {
    display: block;
    width: 100%;
    text-align: left;
    padding: 0.375rem 0.625rem;
    font-size: var(--font-size-body2);
    color: var(--text);
    background-color: transparent;

    &:hover {
      background-color: var(--bg-hover);
    }

    &.active {
      color: var(--accent);
      background-color: var(--bg-hover);
    }

    &.selected {
      color: var(--accent);
      background-color: var(--bg-active);
    }
  }
</style>
