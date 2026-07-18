<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { IconChevronDown } from "$lib/icons";
  import { Select } from "$lib/components/inputs/select.core.svelte";
  import Popover from "$lib/components/floating/Popover.svelte";
  import CircularProgress from "$lib/components/display/CircularProgress.svelte";

  const DEFAULT_NO_OPTIONS_TEXT = "No options available";

  type WithLabel = { label: string; id?: string };
  type WithExternalLabel = { label?: never; id: string };

  type Props = (WithLabel | WithExternalLabel) &
    Omit<HTMLButtonAttributes, "onchange" | "placeholder"> & {
      /** 當前選取的選項值 */
      value: string | undefined;
      /** 可供選擇的選項 `key` 清單 */
      options: readonly string[];
      /** 下拉選單中每個選項的渲染內容 `key, selected` */
      option: Snippet<[string, boolean]>;
      /** 已選取的選項的渲染內容，預設共用 option `key, selected: true` */
      triggerOption?: Snippet<[string, true]>;
      /** 當前的狀態 */
      status?: "default" | "pending" | "disabled";
      /** 選項列表沒有任何項目且不是載入中時，trigger 顯示的內容 */
      noOptionsDisplay?: string | Snippet;
      /** 選項列表非空但尚未選取任何值時，trigger 顯示的內容 */
      placeholder?: string | Snippet;
      /** 下拉選單是否匹配 trigger 寬度，預設 true */
      matchWidth?: boolean;
      /** 當選取值改變時觸發的回呼函式，會傳入新選取的選項 `key` */
      onchange?: (key: string) => void;
    };

  const componentId = $props.id();

  let {
    value = $bindable(),
    options,
    option,
    triggerOption,
    label,
    id,
    status = "default",
    noOptionsDisplay = DEFAULT_NO_OPTIONS_TEXT,
    placeholder,
    matchWidth = true,
    onchange,
    ...rest
  }: Props = $props();

  const triggerId = $derived(id ? id : `select-${componentId}`);

  const isEmpty = $derived(options.length === 0);
  const isPending = $derived(status === "pending");
  const isDisabled = $derived(status === "disabled" || isPending || isEmpty);

  const ui = new Select({
    onchange: (key) => onchange?.(key),
    get list() {
      return options;
    },
    get value() {
      return value;
    },
    set value(v) {
      value = v;
    },
  });
</script>

{#snippet renderText(content: string | Snippet)}
  {#if typeof content === "string"}
    {content}
  {:else}
    {@render content()}
  {/if}
{/snippet}

{#snippet trigger()}
  <button
    bind:this={ui.triggerEl}
    id={triggerId}
    type="button"
    class="trigger"
    class:pending={isPending}
    aria-expanded={ui.open}
    aria-haspopup="listbox"
    disabled={isDisabled}
    onclick={ui.handleTriggerClick}
    onkeydown={ui.handleTriggerKeydown}
    onblur={ui.handleTriggerBlur}
    {...rest}
  >
    <span class="ellipsis" class:muted={isEmpty || value === undefined}>
      {#if isEmpty}
        {@render renderText(noOptionsDisplay)}
      {:else if value !== undefined}
        {@render (triggerOption ?? option)(value, true)}
      {:else if placeholder}
        {@render renderText(placeholder)}
      {/if}
    </span>
    <span class="chevron" class:open={ui.open}>
      <IconChevronDown size={14} />
    </span>
    {#if isPending}
      <span class="spinner"><CircularProgress size="1rem" color="var(--color-text)" /></span>
    {/if}
  </button>
{/snippet}

{#if label}
  <div class="root">
    <label for={triggerId}>{label}</label>
    {@render trigger()}
  </div>
{:else}
  {@render trigger()}
{/if}

{#if !isEmpty}
  <Popover open={ui.open} reference={ui.triggerEl} placement="bottom-start" {matchWidth}>
    <div class="listbox" role="listbox" aria-labelledby={triggerId}>
      {#each options as key, i (key)}
        <button
          type="button"
          role="option"
          class="option ellipsis"
          class:active={i === ui.activeIndex}
          class:selected={key === value}
          aria-selected={key === value}
          onmousedown={(e) => ui.handleOptionMouseDown(e, key)}
          onmouseenter={() => ui.handleOptionMouseEnter(i)}
        >
          {@render option(key, key === value)}
        </button>
      {/each}
    </div>
  </Popover>
{/if}

<style>
  .root {
    display: inline-flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .root > label {
    font: var(--font-body2);
    color: var(--color-text-muted);
  }

  /* --- */

  .trigger {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    min-height: 2rem;
    min-width: 0;
    padding: 0 0.75rem;
    font: var(--font-body1);
    color: var(--color-text);
    background: var(--color-bg);
    border: var(--border-style);
    border-radius: var(--border-radius);
    user-select: none;
    transition:
      border-color 0.15s ease,
      transform 0.15s ease;

    &:hover {
      border-color: var(--color-border-hover);
    }

    &:active {
      transform: translateY(1.5px);
    }

    &:disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    &.pending {
      color: transparent !important;

      & > *:not(.spinner) {
        visibility: hidden;
      }
    }
  }

  .spinner {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }

  .trigger > .ellipsis.muted {
    color: var(--color-text-muted);
  }

  .trigger > .ellipsis:has(+ .chevron) {
    flex: 1;
  }

  .chevron {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    color: var(--color-text-muted);
    transition: transform 0.15s ease;

    &.open {
      transform: rotate(180deg);
    }
  }

  /* --- */

  .listbox {
    display: flex;
    flex-direction: column;
    max-height: min(14rem, 100dvh);
    padding: 0.25rem;
    overflow-y: auto;
    overscroll-behavior: contain;
    background-color: var(--color-bg-popover);
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 1.5);
  }

  .option {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 0.375rem;
    width: 100%;
    padding: 0.25rem 0.5rem;
    font: var(--font-body2);
    color: var(--color-text);
    text-align: left;
    background-color: transparent;
    border-radius: calc(var(--border-radius) * 1.5 - 0.25rem);
    transition: all 0.15s ease;

    &:hover {
      background-color: var(--color-bg-hover);
    }

    &.active {
      background-color: var(--color-bg-hover);
    }

    &.selected {
      color: var(--color-accent);
      background-color: hsl(from var(--color-accent) h s l / 0.15);
    }
  }
</style>
