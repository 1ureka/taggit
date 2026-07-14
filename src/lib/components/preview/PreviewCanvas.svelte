<script lang="ts">
  import Button from "$lib/components/actions/Button.svelte";
  import { IconCode } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import type { Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  type Props = HTMLAttributes<HTMLDivElement> & { children: Snippet };

  let { children, ...rest }: Props = $props();
</script>

<div {...rest}>
  {@render children()}

  <span>
    <Button
      variant="ghost"
      padding="icon"
      {@attach tooltip({ content: "View code" })}
      style="color: var(--color-text-muted);"
    >
      <IconCode size={18} />
      <!-- TODO: 確認 aria 文案、改成 ButtonLink，讓外部用 prop 連結到實際程式碼 -->
      <span class="sr-only">View code</span>
    </Button>
  </span>
</div>

<style>
  div {
    position: relative;
    min-height: 250px;
    padding: 3rem;

    display: flex;
    align-items: center;
    justify-content: center;

    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 2);
    overflow: hidden;
  }

  span {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
  }
</style>
