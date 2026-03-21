<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { imgSrc } from "$lib/client/api.js";

  type Props = HTMLButtonAttributes & {
    /** 圖片檔名 */
    filename: string;
    /** 是否為目前預覽項目 */
    active: boolean;
    /** 是否已加入選取集合 */
    selected: boolean;
  };

  let { filename, active, selected, ...rest }: Props = $props();
</script>

<button type="button" class:active class:selected {...rest}>
  <img src={imgSrc(filename, "sm")} alt={filename} loading="lazy" />
  <span>{filename}</span>
</button>

<style>
  button {
    position: absolute;
    left: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    cursor: pointer;
    border: none;
    border-left: 3px solid transparent;
    background: transparent;
    width: 100%;
    text-align: left;
    color: inherit;
    font-family: inherit;
    transition:
      background 0.1s,
      border-color 0.15s;
    user-select: none;

    &:hover {
      background: var(--bg-hover);
    }

    &.selected {
      background: var(--bg-active);
      border-left-color: var(--text-dim);
    }

    &.active {
      background: var(--bg-active);
      border-left-color: var(--accent);
    }

    & img {
      width: auto;
      height: 60px;
      max-width: 80px;
      object-fit: cover;
      border-radius: 4px;
      background: var(--bg);
      flex-shrink: 0;
    }
  }

  span {
    flex: 1;
    font-size: 0.6875rem;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
</style>
