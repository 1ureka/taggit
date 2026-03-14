<script lang="ts">
  import { IconCheck } from "@tabler/icons-svelte";
  import { SelectCheckbox } from "$lib/ui/selectCheckbox.svelte.js";

  type Props = {
    /** 是否選中 */
    checked?: boolean;
    /** 大小變體，預設 "md"，其中 "sm" (20px), "md" (24px), "lg" (28px) */
    size?: "sm" | "md" | "lg";
    /** 當狀態變更時觸發的回調 */
    onchange?: (checked: boolean) => void;
  };

  let { checked = false, size = "md", onchange }: Props = $props();

  const iconSize = $derived(size === "sm" ? 12 : size === "md" ? 14 : 16);

  const ui = new SelectCheckbox({
    get checked() {
      return checked;
    },
    get onchange() {
      return onchange;
    },
  });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="checkbox {size}"
  class:checked
  onclick={ui.handleClick}
  role="checkbox"
  aria-checked={checked}
  tabindex="-1"
>
  {#if checked}
    <IconCheck size={iconSize} stroke={3} />
  {/if}
</div>

<style>
  .checkbox {
    display: grid;
    place-items: center;
    border-radius: 4px;
    border: 2px solid var(--border-hover);
    background: hsl(from var(--bg) h s l / 0.5);
    color: var(--text);
    cursor: pointer;
    transition:
      background 0.15s,
      border-color 0.15s;

    &:hover {
      border-color: var(--text-muted);
    }

    &.checked {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--bg);

      &:hover {
        background: hsl(from var(--accent) h s l / 0.8);
        border-color: hsl(from var(--accent) h s l / 0.8);
      }
    }

    &.sm {
      width: 20px;
      height: 20px;
    }

    &.md {
      width: 24px;
      height: 24px;
    }

    &.lg {
      width: 28px;
      height: 28px;
    }
  }
</style>
