<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLInputAttributes, HTMLAttributes, HTMLTextareaAttributes } from "svelte/elements";
  import type { OneOf } from "$lib/types";

  type WithLabel = { label: string; id?: string; labelHidden?: boolean };
  type WithExternalLabel = { label?: never; id: string; labelHidden?: never };

  type InputProps = HTMLInputAttributes & { input?: HTMLInputElement };
  type TextAreaProps = HTMLTextareaAttributes & { input?: HTMLTextAreaElement; minRows?: number; maxRows?: number };

  type BaseProps = {
    value?: string;

    variant?: "outlined" | "filled";
    status?: "default" | "error" | "disabled";
    disableActiveFeedback?: boolean;

    adornmentLeft?: Snippet;
    adornmentLeftProps?: HTMLAttributes<HTMLDivElement>;
    adornmentRight?: Snippet;
    adornmentRightProps?: HTMLAttributes<HTMLDivElement>;
    adornmentBottom?: Snippet;
    adornmentBottomProps?: HTMLAttributes<HTMLDivElement>;

    root?: HTMLDivElement;
    rootProps?: HTMLAttributes<HTMLDivElement>;
  };

  type Props = (WithLabel | WithExternalLabel) &
    OneOf<[{ multiline?: false } & InputProps, { multiline: true } & TextAreaProps]> &
    BaseProps;

  let {
    multiline,
    minRows = 2,
    maxRows = 6,
    id,
    input = $bindable(),
    value = $bindable(),
    label,
    labelHidden = false,
    variant = "outlined",
    status = "default",
    disableActiveFeedback = false,
    adornmentLeft,
    adornmentRight,
    adornmentBottom,
    adornmentLeftProps = {},
    adornmentRightProps = {},
    adornmentBottomProps = {},
    root = $bindable(),
    rootProps = {},
    ...rest
  }: Props = $props();

  const componentId = $props.id();
  const inputId = $derived(id ? id : `text-input-${componentId}`);

  const shrink = $derived.by(() => {
    if (labelHidden || !label) return "shrink";
    if (!!value) return "shrink";
    if (adornmentLeft || adornmentRight) return "shrink";
    return "";
  });

  const activeFeedback = $derived.by(() => {
    if (disableActiveFeedback) return "no-active-feedback ";
    return "";
  });
</script>

<div bind:this={root} class="root {variant} {status} {shrink} {activeFeedback}" {...rootProps}>
  {#if label}
    <label class={{ "sr-only": labelHidden }} for={inputId}>{label}</label>
  {/if}

  <div class="input-wrapper">
    {#if adornmentLeft}
      <div class="adornment-left" {...adornmentLeftProps}>{@render adornmentLeft()}</div>
    {/if}

    {#if !multiline}
      <input
        bind:this={input as HTMLInputElement}
        bind:value
        id={inputId}
        type="text"
        disabled={status === "disabled"}
        aria-invalid={status === "error"}
        {...rest as HTMLInputAttributes}
      />
    {:else}
      <textarea
        bind:this={input as HTMLTextAreaElement}
        bind:value
        id={inputId}
        disabled={status === "disabled"}
        aria-invalid={status === "error"}
        style:--min-rows={minRows}
        style:--max-rows={maxRows}
        {...rest as HTMLTextareaAttributes}
      ></textarea>
    {/if}

    {#if adornmentRight}
      <div class="adornment-right" {...adornmentRightProps}>{@render adornmentRight()}</div>
    {/if}
  </div>

  {#if adornmentBottom}
    <div class="adornment-bottom" {...adornmentBottomProps}>{@render adornmentBottom()}</div>
  {/if}

  {#if variant === "outlined"}
    <fieldset aria-hidden="true">
      <legend>
        {#if !labelHidden && label}
          <span>{label}</span>
        {/if}
      </legend>
    </fieldset>
  {/if}
</div>

<style>
  .root {
    --height-legend: 11px;
    --offset-border-top: -5px;
    --padding-input: 0.65rem;
  }

  .root {
    position: relative;
    display: flex;
    flex-direction: column;
    background-color: transparent;
    border-radius: var(--border-radius);
    transition: all 0.15s ease;
    will-change: transform;
  }

  .root:has(:disabled) {
    opacity: 0.65;
    pointer-events: none;
  }

  .root:not(.no-active-feedback):active {
    transform: translateY(1.5px);
  }

  .input-wrapper {
    display: flex;
    align-items: center;
  }

  .input-wrapper:has(textarea) {
    align-items: flex-start;
  }

  .adornment-left,
  .adornment-right {
    flex-shrink: 0;
  }

  /* --- */

  input,
  textarea {
    flex: 1;
    padding: var(--padding-input);
    font: var(--font-input);
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  textarea {
    line-height: 1.5;
    min-height: calc(var(--min-rows) * 1lh + var(--padding-input) * 2);
    max-height: calc(var(--max-rows) * 1lh + var(--padding-input) * 2);
    field-sizing: content;
    overflow-y: auto;
  }

  fieldset {
    position: absolute;
    inset: 0;
    top: var(--offset-border-top);
    display: block;
    padding: 0 var(--padding-input);
    border: var(--border-style);
    border-radius: inherit;
    pointer-events: none;
    transition: border-color 0.15s ease;
  }

  label {
    position: absolute;
    top: var(--offset-border-top);
    left: var(--padding-input);
    cursor: text;
    transform-origin: left top;
    /* 0.875 => font-input, 0.75 => font-caption */
    transform: translateY(calc(0.75rem - var(--offset-border-top))) scale(calc(0.875 / 0.75));
    will-change: transform;
    transition:
      transform 0.15s ease,
      color 0.15s ease;
  }

  fieldset > legend {
    height: var(--height-legend);
    max-width: 0.01px;
    overflow: hidden;
    transition: max-width 0.15s ease;
  }

  fieldset > legend > span {
    display: inline-block;
    visibility: hidden;
  }

  fieldset > legend > span,
  label {
    padding: 0 0.25rem;
    font: var(--font-caption);
  }

  /* --- */

  .root.outlined {
    background-color: var(--color-bg);
    & > fieldset {
      border-color: var(--color-border);
    }
    & > label {
      color: var(--color-text-muted);
    }

    &:hover {
      background-color: hsl(from var(--color-text) h s l / 0.05);
    }
    &:hover fieldset {
      border-color: var(--color-border-hover);
    }

    &:has(:focus) fieldset {
      border-color: var(--color-accent);
    }
    &:has(:focus) label {
      color: var(--color-accent);
    }
  }

  /* --- */

  .root.outlined.error {
    background-color: var(--color-bg);
    & > fieldset {
      border-color: hsl(from var(--color-error) h s l / 0.5);
    }
    & > label {
      color: var(--color-error);
    }

    &:hover {
      background-color: hsl(from var(--color-error) h s l / 0.1);
    }
    &:hover > fieldset {
      border-color: hsl(from var(--color-error) h s l / 0.75);
    }

    &:has(:focus) > fieldset {
      border-color: var(--color-error);
    }
    &:has(:focus) > label {
      color: var(--color-error);
    }
  }

  /* --- */

  .root.filled {
    background-color: var(--color-bg-hover);
    & > label {
      color: var(--color-text-muted);
    }

    &:hover {
      background-color: var(--color-bg-active);
    }

    &:has(:focus) {
      background-color: color-mix(in srgb, var(--color-bg-hover) 90%, var(--color-accent));
    }
    &:has(:focus) label {
      color: var(--color-accent);
    }
  }

  /* --- */

  .root.filled.error {
    background-color: hsl(from var(--color-error) h s l / 0.25);
    & > label {
      color: var(--color-error);
    }

    &:hover {
      background-color: hsl(from var(--color-error) h s l / 0.35);
    }

    &:has(:focus) label {
      color: var(--color-error);
    }
  }

  /* --- */

  .root:has(:focus),
  .root.shrink {
    & fieldset > legend {
      max-width: 100%;
    }

    & label {
      transform: translateY(0px) scale(1);
    }

    & input,
    & textarea {
      opacity: 1;
    }
  }

  /* --- */

  input,
  textarea {
    background-color: transparent;
    border: none;
    outline: none;
    resize: none;

    &:hover,
    &:focus {
      background-color: transparent;
      border: none;
      outline: none;
    }
  }

  input::-ms-reveal,
  input::-ms-clear,
  textarea::-ms-clear,
  textarea::-ms-reveal {
    display: none;
  }
</style>
