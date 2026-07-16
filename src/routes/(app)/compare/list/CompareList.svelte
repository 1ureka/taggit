<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import { imgSrc } from "$lib/image/client";
  import { List } from "$lib/virtualizer/list.svelte";
  import { IconPinFilled, IconPinnedOff } from "$lib/icons";

  type Props = {
    /** 當前篩選結果（列表項） */
    items: ImageWithId[];
    /** 篩選結果總數 */
    total: number;
    /** 已釘選的圖片 ids */
    pinnedIds: string[];
    /** 點擊列表項：切換釘選 */
    ontoggle: (id: string) => void;
  };

  let { items, total, pinnedIds, ontoggle }: Props = $props();

  const pinnedSet = $derived(new Set(pinnedIds));

  const ROW_HEIGHT = 56;

  const list = new List({
    get items() {
      return items;
    },
    get currentIndex() {
      return null;
    },
    get onClickItem() {
      return undefined;
    },
    get itemHeight() {
      return ROW_HEIGHT;
    },
  });
</script>

<div class="viewport">
  <header>
    <h2>圖庫列表</h2>
    <p>共 {total} 張</p>
  </header>

  {#if items.length === 0}
    <p class="empty">沒有符合條件的圖片</p>
  {:else}
    <div class="scroller" bind:this={list.viewportEl} onscroll={list.handleListScroll}>
      <ul class="track" style="height: {list.listHeight}px" aria-label="圖庫列表">
        {#each list.visibleItems as item (item.id)}
          {@const pinned = pinnedSet.has(item.id)}
          <li style="top: {item.top}px; height: {item.height}px">
            <button
              type="button"
              class="row"
              class:pinned
              aria-pressed={pinned}
              title={pinned ? "自畫布移除" : "釘選到畫布"}
              onclick={() => ontoggle(item.id)}
            >
              <img src={imgSrc(item.id, "sm")} alt={item.name} loading="lazy" decoding="async" />
              <span class="name ellipsis">{item.name}</span>
              <span class="pin" aria-hidden="true">
                {#if pinned}
                  <span class="pin-on"><IconPinFilled size={16} /></span>
                  <span class="pin-off"><IconPinnedOff size={16} /></span>
                {:else}
                  <span class="pin-hover"><IconPinFilled size={16} /></span>
                {/if}
              </span>
            </button>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
</div>

<style>
  .viewport {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    overflow: hidden;
  }

  .viewport > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0px 0.75rem;
    height: 2.5rem;
    min-height: 2.5rem;
    border-bottom: var(--border-style);
    border-right: var(--border-style);
    border-bottom-right-radius: 16px;
    background: var(--color-bg);

    & > h2 {
      font: var(--font-body1);
      font-weight: normal;
    }

    & > p {
      font: var(--font-caption);
      font-family: var(--font-family-mono);
      color: var(--color-text-muted);
    }
  }

  .empty {
    padding: 1.5rem 0.75rem;
    font: var(--font-body2);
    color: var(--color-text-muted);
    text-align: center;
  }

  /* ─── 虛擬化列表 ─── */

  .scroller {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  ul.track {
    position: relative;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  ul.track > li {
    position: absolute;
    left: 0;
    right: 0;
    padding: 0.125rem 0.375rem;
  }

  /* ─── 列表項 ─── */

  button.row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    height: 100%;
    padding: 0.25rem;
    text-align: left;
    border-radius: var(--border-radius);
    border-left: 3px solid transparent;
    transition: background 0.15s ease;

    &:hover {
      background: var(--color-bg-hover);
    }

    &.pinned {
      background: var(--color-bg-active);
      border-left-color: var(--color-accent);
    }

    & > img {
      width: 44px;
      height: 44px;
      object-fit: cover;
      border-radius: calc(var(--border-radius) / 1.5);
      background: var(--color-bg);
      flex-shrink: 0;
    }

    & > .name {
      flex: 1;
      min-width: 0;
      font: var(--font-body2);
      color: var(--color-text-muted);
    }
  }

  /* 釘選圖示：未釘選 hover 才浮現；已釘選常駐，hover 換成取消圖示 */

  .pin {
    display: inline-flex;
    flex-shrink: 0;
    width: 16px;
    height: 16px;

    & > span {
      display: none;
    }
  }

  .pin > .pin-on {
    display: inline-flex;
    color: var(--color-accent);
  }

  button.row:hover .pin > .pin-on,
  button.row:focus-visible .pin > .pin-on {
    display: none;
  }

  button.row:hover .pin > .pin-off,
  button.row:focus-visible .pin > .pin-off {
    display: inline-flex;
    color: var(--color-text-muted);
  }

  button.row:hover .pin > .pin-hover,
  button.row:focus-visible .pin > .pin-hover {
    display: inline-flex;
    color: var(--color-text-muted);
  }
</style>
