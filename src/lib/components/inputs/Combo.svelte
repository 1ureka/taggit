<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAttributes, HTMLInputAttributes } from "svelte/elements";
  import { Combo } from "$lib/components/inputs/combo.core.svelte";
  import Popover from "$lib/components/floating/Popover.svelte";
  import TextInput from "$lib/components/inputs/TextInput.svelte";

  type WithLabel = { label: string; id?: string; labelHidden?: boolean };
  type WithExternalLabel = { label?: never; id: string; labelHidden?: never };

  type Props = (WithLabel | WithExternalLabel) &
    Omit<HTMLInputAttributes, "size" | "value" | "onchange" | "onblur" | "onfocus" | "oninput" | "onkeydown"> & {
      /** 雙向綁定：輸入框當前文字，即時同步，不是「選完才變」 */
      value: string;
      /** 這一刻要顯示的候選 key 清單——篩選/查詢邏輯完全由呼叫端決定 */
      candidates: readonly string[];
      /** 每個候選的渲染內容 `key, active`（active 是鍵盤/滑鼠虛擬聚焦，不是「已選中」） */
      candidate: Snippet<[string, boolean]>;
      /** 是否允許把不在 candidates 裡的文字當作有效值，預設 true */
      allowCustomValue?: boolean;
      /** 下拉選單是否匹配 input 寬度，預設 true */
      matchWidth?: boolean;
      /** 下拉選單候選列表上方的額外插槽 (例如 loading 提示) */
      listboxExtra?: Snippet;

      // 以下是 combo 包裝後的事件，會在 combo 內部處理完邏輯後才觸發

      /** 每次 commit（挑候選 / 接受自訂輸入 / blur）時觸發 */
      onchange?: (value: string) => void;
      onblur?: (event: FocusEvent) => void;
      onfocus?: (event: FocusEvent) => void;
      oninput?: (event: Event) => void;
      onkeydown?: (event: KeyboardEvent) => void;

      // 以下直接轉發給內部 TextInput，語意跟 TextInput 本身一致

      variant?: "outlined" | "filled";
      status?: "default" | "error" | "disabled";
      disableActiveFeedback?: boolean;
      adornmentLeft?: Snippet;
      adornmentRight?: Snippet;
      adornmentLeftProps?: HTMLAttributes<HTMLDivElement>;
      adornmentRightProps?: HTMLAttributes<HTMLDivElement>;
    };

  const componentId = $props.id();

  let {
    value = $bindable(""),
    candidates,
    candidate,
    label,
    id,
    labelHidden,
    allowCustomValue = true,
    matchWidth = true,
    listboxExtra,

    onchange,
    onblur,
    onfocus,
    oninput,
    onkeydown,

    variant,
    status = "default",
    disableActiveFeedback,
    adornmentLeft,
    adornmentRight,
    adornmentLeftProps,
    adornmentRightProps,
    ...rest
  }: Props = $props();

  const inputId = $derived(id ? id : `combo-${componentId}`);
  const listboxId = $derived(`${inputId}-listbox`);

  const ui = new Combo({
    onchange: (v) => onchange?.(v),
    get candidates() {
      return candidates;
    },
    get allowCustomValue() {
      return allowCustomValue;
    },
    get value() {
      return value;
    },
    set value(v) {
      value = v;
    },
  });

  const handleInput = (e: Event) => {
    ui.handleInput();
    oninput?.(e);
  };

  const handleFocus = (e: FocusEvent) => {
    ui.handleFocus();
    onfocus?.(e);
  };

  const handleBlur = (e: FocusEvent) => {
    ui.handleBlur();
    onblur?.(e);
  };

  const handleKeydown = (e: KeyboardEvent) => {
    ui.handleKeydown(e);
    onkeydown?.(e);
  };

  let optionEls: (HTMLButtonElement | undefined)[] = $state([]);

  $effect(() => {
    optionEls[ui.activeIndex]?.scrollIntoView({ block: "nearest" });
  });
</script>

{#snippet textInput()}
  <!-- 拆分是為了避免 `Expression produces a union type that is too complex to represent.` -->

  {@const ariaProps = {
    role: "combobox",
    "aria-autocomplete": "list" as const,
    "aria-controls": listboxId,
    "aria-expanded": ui.open,
    autocomplete: "off" as const,
  }}

  {@const inputProps = {
    multiline: false as const,
    variant,
    status,
    disableActiveFeedback,
    adornmentLeftProps,
    adornmentRightProps,
    adornmentLeft,
    adornmentRight,
    oninput: handleInput,
    onfocus: handleFocus,
    onblur: handleBlur,
    onkeydown: handleKeydown,
  }}

  {#if label}
    <TextInput bind:input={ui.inputEl} bind:value {label} {id} {labelHidden} {...ariaProps} {...inputProps} {...rest} />
  {:else}
    <TextInput bind:input={ui.inputEl} bind:value id={id as string} {...ariaProps} {...inputProps} {...rest} />
  {/if}
{/snippet}

{@render textInput()}

<Popover
  open={ui.open && (candidates.length > 0 || Boolean(listboxExtra))}
  reference={ui.inputEl}
  placement="bottom-start"
  {matchWidth}
>
  <div id={listboxId} class="listbox" role="listbox" aria-labelledby={inputId}>
    {#if listboxExtra}
      <div class="listbox-extra">{@render listboxExtra()}</div>
    {/if}
    {#each candidates as key, i (key)}
      <button
        bind:this={optionEls[i]}
        type="button"
        role="option"
        class="option ellipsis"
        class:active={i === ui.activeIndex}
        aria-selected={i === ui.activeIndex}
        onmousedown={(e) => ui.handleCandidateMouseDown(e, key)}
        onmouseenter={() => ui.handleCandidateMouseEnter(i)}
      >
        {@render candidate(key, i === ui.activeIndex)}
      </button>
    {/each}
  </div>
</Popover>

<style>
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

  .listbox-extra {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem 0.5rem;
    font: var(--font-body2);
    color: var(--color-text-muted);
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

    /* 自帶輕量虛擬化：畫面外的候選列跳過 layout/paint，不強迫固定高度 */
    content-visibility: auto;
    contain-intrinsic-size: auto 1.875rem;

    &:hover {
      background-color: var(--color-bg-hover);
    }

    &.active {
      background-color: hsl(from var(--color-accent) h s l / 0.15);
    }
  }
</style>
