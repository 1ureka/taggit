<script lang="ts" module>
  import type { Snippet } from "svelte";
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";
  import CircularProgress from "$lib/components/display/CircularProgress.svelte";

  type BasicProps = {
    variant?: "primary" | "outlined" | "ghost" | "destructive";
    status?: "default" | "pending" | "disabled";
    padding?: "icon" | "sm" | "md";
    children?: Snippet;
  };

  type ButtonProps = BasicProps & HTMLButtonAttributes;

  type LinkProps = BasicProps & HTMLAnchorAttributes & { href: string };

  const getSpinnerColor = (variant: BasicProps["variant"]) => {
    if (variant === "destructive") {
      return "var(--color-error)";
    } else if (variant === "primary") {
      return "var(--color-bg)";
    } else {
      return "var(--color-text)";
    }
  };

  export { button, link, type ButtonProps, type LinkProps };
</script>

{#snippet button({ type, variant, status, padding, children, ...rest }: ButtonProps)}
  <button
    type={type ?? "button"}
    disabled={status === "disabled" || status === "pending"}
    class={{
      btn: true,
      primary: variant === "primary",
      outlined: variant === "outlined" || !variant,
      ghost: variant === "ghost",
      destructive: variant === "destructive",
      pending: status === "pending",
      "p-icon": padding === "icon",
      "p-sm": padding === "sm" || !padding,
      "p-md": padding === "md",
    }}
    {...rest}
  >
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
  <a
    {href}
    aria-disabled={disabled}
    onclick={handleClick}
    class={{
      btn: true,
      primary: variant === "primary",
      outlined: variant === "outlined" || !variant,
      ghost: variant === "ghost",
      destructive: variant === "destructive",
      pending: status === "pending",
      "p-icon": padding === "icon",
      "p-sm": padding === "sm" || !padding,
      "p-md": padding === "md",
    }}
    {...rest}
  >
    {@render children?.()}
    {#if status === "pending"}
      <span class="spinner">
        <CircularProgress color={getSpinnerColor(variant)} size={"1.25rem"} />
      </span>
    {/if}
  </a>
{/snippet}

<style>
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* --- */

  .btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
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
    padding: 0.25rem;
  }

  .btn.p-sm {
    padding: 0.375rem 0.75rem;
  }

  .btn.p-md {
    padding: 0.5rem 1rem;
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
