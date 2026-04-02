<script
  lang="ts"
  generics="T extends {
    /** 項目的唯一標識符 */
    id: string;
    /** 項目的名稱 */
    name: string;
    /** 項目的圖片來源 */
    imgSrc: string;
  }"
>
  import { List } from "$lib/virtualizer/list.svelte";

  type Props = {
    /** 列表的所有項目 */
    items: T[];
    /** 當前啟用項目的索引 */
    currentIndex: number | null;
    /** 已選中項目的 ID 集合 */
    selectedIds: Set<string>;
    /** 列表為空時顯示的文本 */
    emptyLabel: string;
    /** 列表的 aria-label 屬性值 */
    listLabel: string;
    /** 處理鍵盤事件 */
    onKeydown?: (event: KeyboardEvent) => void;
    /** 處理項目點擊事件 */
    onClickItem?: (item: T, mode: "single" | "ctrl" | "shift") => void;
  };

  let { items, currentIndex, selectedIds, emptyLabel, listLabel, onKeydown, onClickItem }: Props = $props();

  const list = new List<T>({
    get items() {
      return items;
    },
    get currentIndex() {
      return currentIndex;
    },
    get onClickItem() {
      return onClickItem;
    },
    itemHeight: 72,
  });

  /** 當前啟用項目的 ID */
  const currentId = $derived.by(() => {
    if (currentIndex === null) return null;
    const item = items[currentIndex];
    return item ? item.id : null;
  });
</script>

<div class="viewport" bind:this={list.viewportEl} onscroll={list.handleListScroll}>
  {#if items.length === 0}
    <span>{emptyLabel}</span>
  {:else}
    <ul
      style="height:{list.listHeight}px"
      tabindex="0"
      role="listbox"
      aria-label={listLabel}
      aria-activedescendant={currentId ? `img-${currentId}` : undefined}
      onclick={list.handleListClick}
      onkeydown={onKeydown}
    >
      {#each list.visibleItems as item (item.id)}
        {@const active = item.id === currentId}
        {@const selected = selectedIds.has(item.id)}
        <li
          id="img-{item.id}"
          style="height:{item.height}px; transform: translate3d(0, {item.top}px, 0)"
          class:active
          class:selected
          role="option"
          aria-selected={selected}
        >
          <img src={item.imgSrc} alt={item.name} loading="lazy" />
          <span class="ellipsis">{item.name}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .viewport {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;

    & > span {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      font-size: var(--font-size-body1);
      color: var(--text-dim);
    }
  }

  /* --- */

  .viewport {
    &:has(:focus-visible) {
      outline: 2px solid hsl(from var(--ring) h s l / 0.2);
      outline-offset: -2px;
    }

    & > ul:focus-visible {
      outline: none;
    }
  }

  /* --- */

  .viewport > ul {
    position: relative;
  }

  .viewport > ul > li {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;

    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-left: 3px solid transparent;
    background: transparent;
    user-select: none;
    cursor: pointer;

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
  }

  /* --- */

  .viewport > ul > li {
    & > img {
      width: auto;
      height: 60px;
      max-width: 80px;
      object-fit: cover;
      border-radius: 4px;
      background: var(--bg);
      flex-shrink: 0;
    }

    & > span {
      flex: 1;
      font-size: var(--font-size-caption);
      color: var(--text-muted);
    }

    &.active > span {
      color: var(--text);
    }
  }
</style>
