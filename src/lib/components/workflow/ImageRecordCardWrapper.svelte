<script lang="ts">
  import type { Snippet } from "svelte";
  import type { ImageWithId } from "$lib/database";
  import { imgSrc } from "$lib/image/client";
  import Checkbox from "$lib/components/inputs/Checkbox.svelte";
  import Image from "$lib/components/display/Image.svelte";

  type Props = {
    /** 卡片對應的圖片 */
    record: string | ImageWithId;
    /** 是否是選擇中的樣式 */
    selected: boolean;
    /** 是否可選擇 */
    selectable?: boolean;
    /** 點擊卡片事件 */
    onclick: () => void;
    /** 卡片內容 */
    children: Snippet;
  };

  let { record, selected, selectable, onclick, children }: Props = $props();

  const filename = $derived(typeof record === "string" ? record : record.id);
  const preview = $derived(typeof record === "string" ? undefined : record);
</script>

<button type="button" class:selected {onclick}>
  <div class="image">
    <Image src={imgSrc(filename, "sm")} alt={filename} {preview} fit="cover" />
  </div>
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

  div.image {
    width: 100%;
    min-height: 0;
    flex: 1;
    overflow: hidden;
    transition: border-radius 0.15s ease;
  }

  /* --- */

  button:not(.active) {
    background-color: transparent;
    border-color: transparent;

    & > div.image {
      border-radius: var(--border-radius);
    }
  }

  button:not(.active):hover {
    background-color: var(--color-bg-hover);
    border-color: var(--color-border-hover);

    & > div.image {
      border-radius: 0px;
    }
  }

  button.selected {
    background-color: hsl(from var(--color-accent) h s l / 0.15);
    border-color: hsl(from var(--color-accent) h s l / 0.35);

    & > div.image {
      border-radius: 0px;
    }
  }

  button.selected:hover {
    background-color: hsl(from var(--color-accent) h s l / 0.25);
    border-color: hsl(from var(--color-accent) h s l / 0.5);

    & > div.image {
      border-radius: 0px;
    }
  }

  /* --- */

  div[inert] {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    background-color: var(--color-bg);
    border-radius: var(--border-radius);
  }
</style>
