<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ImageWithId } from "$lib/database";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import InverseRadius from "$lib/widgets/InverseRadius.svelte";
  import List from "./List.svelte";

  type Props = {
    /** 篩選結果列表 */
    items: ImageWithId[];
    /** 篩選結果總數 */
    total: number;
    /** 已釘選的圖片 ids */
    pinnedIds: string[];
    /** 切換釘選事件 */
    ontoggle: (id: string) => void;
    /** 面板右側外部的內容 */
    children: Snippet;
  };

  let { items, total, pinnedIds, ontoggle, children }: Props = $props();

  $effect(() => {
    if (window.innerWidth < 600) {
      document.documentElement.style.setProperty("--left-panel-width", "0px");
    }
  });

  const handleTogglePanel = () => {
    const root = document.documentElement;
    const property = getComputedStyle(root).getPropertyValue("--left-panel-width");

    if (!property.trim()) {
      root.style.setProperty("--left-panel-width", "0px");
    } else {
      root.style.removeProperty("--left-panel-width");
    }
  };
</script>

<div>
  <div class="spacer"></div>

  {@render children()}

  <aside>
    <List {items} {total} {pinnedIds} {ontoggle} />

    <button
      type="button"
      aria-label="開合圖庫列表"
      {@attach tooltip({ content: "開合圖庫列表", placement: "right" })}
      onclick={handleTogglePanel}
    >
      <InverseRadius corner="bottom-left" size="16px" />
    </button>
  </aside>
</div>

<style>
  div:has(> .spacer) {
    position: relative;
    display: flex;
    align-items: stretch;
    flex: 1;
    min-height: 0;
  }

  div.spacer {
    width: var(--left-panel-width, 280px);
    transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    @media (max-width: 600px) {
      width: 0px;
    }
  }

  aside {
    position: absolute;
    top: 0;
    bottom: 0;
    overflow: visible;
    background: var(--color-bg-card);
    border-right: var(--border-style);
    width: 280px;
    transform: translateX(calc(-100% + var(--left-panel-width, 280px)));
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);

    @media (max-width: 600px) {
      width: calc(100% - 32px);
      transform: translateX(calc(-100% + var(--left-panel-width, 100%)));
    }
  }

  aside > button {
    position: absolute;
    overflow: visible;
    top: 0;
    left: 100%;
    width: 32px;
    height: 100px;
    background-color: var(--color-bg-card);
    border-bottom-right-radius: 16px;
    border: var(--border-style);
    border-top: 0px;
    border-left: 0px;

    display: grid;
    place-items: center;

    &::after {
      content: "";
      display: block;
      width: 20%;
      height: 60%;
      background: var(--color-border);
      border-radius: 999px;
      transition:
        background 0.15s,
        transform 0.15s;
    }

    &:hover::after {
      background: var(--color-border-hover);
      scale: 1.05;
    }

    &:active::after {
      scale: 0.95;
    }
  }
</style>
