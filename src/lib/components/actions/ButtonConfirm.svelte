<script lang="ts">
  import { button } from "$lib/components/actions/ButtonSnippets.svelte";
  import type { ButtonProps } from "$lib/components/actions/ButtonSnippets.svelte";
  import { Spring } from "svelte/motion";

  type Props = ButtonProps & {
    onconfirm?: () => void;
  };

  let { variant, children, onconfirm, ...rest }: Props = $props();

  const scaleX = new Spring(0, { stiffness: 0.03, damping: 0.375 });

  const handleConfirm = () => {
    scaleX.set(0);
    onconfirm?.();
  };

  const onpointerdown = () => {
    scaleX
      .set(1)
      .then(handleConfirm)
      .catch(() => {}); // catch => aborted
  };

  const onpointerup = () => {
    scaleX.set(0);
  };

  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onpointerdown();
    }
  };

  const onkeyup = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onpointerup();
    }
  };
</script>

<svelte:window onpointercancel={onpointerup} {onpointerup} />

{#snippet content()}
  {#if children}
    {@render children()}
  {/if}
  <span
    style="width: calc({scaleX.current * 100}% - 0.2rem);"
    class={{
      primary: variant === "primary",
      outlined: variant === "outlined" || variant === undefined,
      ghost: variant === "ghost",
      destructive: variant === "destructive",
    }}
  ></span>
{/snippet}

{@render button({ ...rest, variant, children: content, onpointerdown, onkeydown, onkeyup })}

<style>
  span {
    position: absolute;
    inset: 0.1rem;
    pointer-events: none;
    border-radius: calc(var(--border-radius) - 0.1rem);
    opacity: 0.35;
  }

  span.primary {
    background-color: var(--color-bg);
  }

  span.outlined {
    background-color: var(--color-text);
  }

  span.ghost {
    background-color: var(--color-text);
  }

  span.destructive {
    background-color: var(--color-error);
  }
</style>
