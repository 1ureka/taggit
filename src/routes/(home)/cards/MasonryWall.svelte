<script lang="ts">
  import { navigating } from "$app/state";
  import { Masonry } from "$lib/virtualizer/masonry.svelte";
  import { getPageDataContext } from "../logic/page-data.svelte";
  import { getLayoutContext } from "../logic/layout.svelte";
  import ScrollButton from "./ScrollButton.svelte";
  import MasonryImage from "./MasonryImage.svelte";

  const pageData = getPageDataContext();
  const layout = getLayoutContext();

  const empty = $derived(pageData.value.total === 0 && !navigating.to);

  const masonry = new Masonry({
    get items() {
      return pageData.value.items;
    },
    get columns() {
      return layout.columns;
    },
    get paddingX() {
      return layout.padding;
    },
    get paddingY() {
      return layout.padding;
    },
    get gap() {
      return layout.gap;
    },
  });
</script>

<section class="masonry-viewport" aria-label="篩選結果" bind:this={masonry.viewportEl}>
  {#if empty}
    <p>找不到符合的圖片，請調整篩選條件，或在上方的導航選單中前往新增圖片</p>
  {/if}

  <ul class="masonry" aria-label="圖片牆" style:height="{masonry.masonryHeight}px">
    {#each masonry.masonryItems as item (item.id)}
      <li style={item.style}>
        <MasonryImage {item} />
      </li>
    {/each}
  </ul>

  <ScrollButton viewportEl={masonry.viewportEl} />
</section>

<style>
  section.masonry-viewport {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;

    & > ul.masonry {
      position: relative;
      list-style: none;
    }
  }

  section.masonry-viewport > p {
    text-align: center;
    color: var(--color-text-muted);
    font: var(--font-body1);
    padding: 3rem 0px;
  }

  li {
    display: block;
  }
</style>
