<script lang="ts">
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconPhotoFilled, IconCategoryFilled } from "$lib/icons";
  import { getSelectionContext } from "../logic/selection.svelte";

  const selection = getSelectionContext();
</script>

<nav aria-label="選取模式">
  <button
    type="button"
    aria-pressed={!selection.active}
    onclick={selection.handleExit}
    {@attach tooltip({ content: "單選模式", placement: "right" })}
  >
    <IconPhotoFilled size={18} />
  </button>

  <button
    type="button"
    aria-pressed={selection.active}
    onclick={selection.handleEnter}
    {@attach tooltip({ content: "多選模式", placement: "right" })}
  >
    <IconCategoryFilled size={18} />
  </button>
</nav>

<style>
  nav {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 2.75rem;
    min-width: 2.75rem;
    gap: 0.5rem;
    padding: 0.75rem 0;
    border-right: var(--border-style);
  }

  button {
    display: grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    color: var(--color-text-muted);
    border-radius: var(--border-radius);
    border: var(--border-style);
    border-color: transparent;
    transition: all 0.15s ease;
  }

  button:hover {
    background-color: var(--color-bg-hover);
    border-color: var(--color-border-hover);
  }

  button:active {
    transition: all 0.03s ease;
    transform: scale(0.97);
  }

  button[aria-pressed="true"] {
    color: var(--color-accent);
    background-color: hsl(from var(--color-accent) h s l / 0.15);
    border-color: hsl(from var(--color-accent) h s l / 0.35);
  }
</style>
