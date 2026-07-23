<script lang="ts">
  import type { Snippet } from "svelte";
  import { imgSrc } from "$lib/image/client";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";

  type Props = {
    /** 卡片對應的檔案名稱 */
    filename: string;
    /** 是否是選擇中的樣式 */
    selected: boolean;
    /** TODO: 增加可選的 blurhash */
    // blurhash?: string;
    /** 是否可選擇 */
    selectable?: boolean;
    /** 點擊卡片事件 */
    onclick: () => void;
    /** 卡片內容 */
    children: Snippet;
  };

  let { filename, selected, selectable, onclick, children }: Props = $props();
</script>

<button type="button" class:selected {onclick}>
  <img src={imgSrc(filename, "sm")} alt={filename} loading="lazy" />
  {@render children()}
  {#if selectable}
    <div inert><Checkbox checked={selected} /></div>
  {/if}
</button>

<style>
  button {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 1.5);
    overflow: hidden;
    text-align: left;
  }

  button {
    transition: all 0.15s ease;

    &:active {
      transition: all 0.03s ease;
      transform: scale(0.98);
    }
  }

  img {
    display: block;
    width: 100%;
    flex: 1;
    min-height: 0;
    object-fit: cover;
    background: var(--color-bg);
    transition: border-radius 0.15s ease;
  }

  /* --- */

  button:not(.active) {
    background-color: transparent;
    border-color: transparent;

    & img {
      border-radius: var(--border-radius);
    }
  }

  button:not(.active):hover {
    background-color: var(--color-bg-hover);
    border-color: var(--color-border-hover);

    & img {
      border-radius: 0px;
    }
  }

  button.selected {
    background-color: hsl(from var(--color-accent) h s l / 0.15);
    border-color: hsl(from var(--color-accent) h s l / 0.35);

    & img {
      border-radius: 0px;
    }
  }

  button.selected:hover {
    background-color: hsl(from var(--color-accent) h s l / 0.25);
    border-color: hsl(from var(--color-accent) h s l / 0.5);

    & img {
      border-radius: 0px;
    }
  }

  /* --- */

  div {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    background-color: var(--color-bg);
    border-radius: var(--border-radius);
  }
</style>
