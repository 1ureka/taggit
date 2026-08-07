<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";
  import CircularProgress from "$lib/components/display/CircularProgress.svelte";

  type BasicProps = {
    variant?: "primary" | "outlined" | "ghost" | "destructive";
    status?: "default" | "pending" | "disabled";
    padding?: "icon" | "sm" | "md";
    children?: Snippet;
  };

  export type ButtonProps = BasicProps & HTMLButtonAttributes;

  export type LinkProps = BasicProps & HTMLAnchorAttributes & { href: string };

  type Props = { button?: ButtonProps; link?: LinkProps };

  const props: Props = $props();

  const getSpinnerColor = (variant: BasicProps["variant"]) => {
    if (variant === "destructive") {
      return "var(--color-error)";
    } else if (variant === "primary") {
      return "var(--color-bg)";
    } else {
      return "var(--color-text)";
    }
  };

  const getClass = ({ variant = "outlined", padding = "sm", status }: BasicProps) => ({
    btn: true,
    pending: status === "pending",
    [variant]: true,
    [`p-${padding}`]: true,
  });
</script>

{#snippet button({ type, variant, status, padding, children, ...rest }: ButtonProps)}
  {@const disabled = status === "disabled" || status === "pending"}
  <button type={type ?? "button"} {disabled} class={getClass({ variant, padding, status })} {...rest}>
    {@render children?.()}
    {#if status === "pending"}
      <span class="spinner">
        <CircularProgress color={getSpinnerColor(variant)} size={"1.25rem"} />
      </span>
    {/if}
  </button>
{/snippet}

{#snippet link({ href, variant, status, padding, children, onclick, ...rest }: LinkProps)}
  {@const disabled = status === "disabled" || status === "pending"}
  {@const handleClick = disabled ? (e: MouseEvent) => e.preventDefault() : onclick}
  <a {href} aria-disabled={disabled} onclick={handleClick} class={getClass({ variant, padding, status })} {...rest}>
    {@render children?.()}
    {#if status === "pending"}
      <span class="spinner">
        <CircularProgress color={getSpinnerColor(variant)} size={"1.25rem"} />
      </span>
    {/if}
  </a>
{/snippet}

{#if props.button}
  {@render button(props.button)}
{:else if props.link}
  {@render link(props.link)}
{/if}

<style>
  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    font: var(--font-button);
    text-align: center;
    text-decoration: none;
    white-space: nowrap;
    user-select: none;
    border-radius: var(--border-radius);
  }

  .btn {
    will-change: transform;
    transition: all 0.15s ease;

    &:active {
      transition: all 0.03s ease;
      transform: scale(0.97);
    }

    &:disabled,
    &[aria-disabled="true"] {
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

  /* --- */

  .btn.p-icon {
    width: 2rem;
    height: 2rem;
  }

  .btn.p-sm {
    padding: 0px 0.75rem;
    height: 2rem;
  }

  .btn.p-md {
    padding: 0px 1rem;
    height: 2.5rem;
  }

  /* --- */

  .btn {
    /* 確保每種按鈕無論是否有邊框都是同樣高寬 */
    border: var(--border-style);
  }

  .btn.primary {
    color: var(--color-bg);
    background-color: var(--color-accent);
    border-color: var(--color-accent);

    &:hover {
      background-color: hsl(from var(--color-accent) h s calc(l - 25));
      border-color: hsl(from var(--color-accent) h s calc(l - 25));
    }
  }

  .btn.outlined {
    color: var(--color-text);
    background-color: var(--color-bg-card);
    border-color: var(--color-border);

    &:hover {
      background-color: var(--color-bg-hover);
      border-color: var(--color-border-hover);
    }
  }

  .btn.ghost {
    color: var(--color-text);
    background-color: transparent;
    border-color: transparent;

    &:hover {
      background-color: var(--color-bg-hover);
      border-color: transparent;
    }
  }

  .btn.destructive {
    color: var(--color-error);
    background-color: hsl(from var(--color-error) h s l / 0.1);
    border-color: hsl(from var(--color-error) h s l / 0.5);

    &:hover {
      background-color: hsl(from var(--color-error) h s l / 0.2);
      border-color: hsl(from var(--color-error) h s l / 0.75);
    }
  }
</style>
