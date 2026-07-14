<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import { imgSrc, blurhashStyle } from "$lib/image/client";
  import Rating from "$lib/components/inputs/Rating.svelte";
  import TagChips from "$lib/widgets/TagChips.svelte";

  type Props = {
    /** 圖片資料 */
    item: ImageWithId;
    /** 點擊卡片時觸發（開啟詳情） */
    onselect: (id: string) => void;
  };

  let { item, onselect }: Props = $props();
</script>

<button data-theme="dark" type="button" onclick={() => onselect(item.id)} aria-label="查看 {item.name} 詳情">
  <figure>
    <img
      src={imgSrc(item.id, "md")}
      style={blurhashStyle({ fit: "cover", blurhash: item.blurhash, width: item.width, height: item.height })}
      alt={item.name}
      decoding="async"
    />

    <figcaption>
      <h3 class="ellipsis">{item.name}</h3>
      <Rating value={item.rating} size="sm" readonly />
      <TagChips tags={item.tags} nowrap />
    </figcaption>
  </figure>
</button>

<style>
  button {
    position: relative;
    display: grid;
    place-items: stretch;
    width: 100%;
    height: 100%;
    border-radius: var(--border-radius);
    overflow: hidden;

    transition: scale 0.15s;
    &:active {
      scale: 0.98;
    }

    @media (max-width: 600px) {
      border-radius: calc(var(--border-radius) * 0.5);
    }
  }

  button > figure {
    min-width: 0;

    & > img {
      position: absolute;
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
      z-index: -1;
    }

    & > figcaption {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      height: 100%;
      padding: 0.5rem;
      gap: 0.25rem;

      & > h3 {
        font: var(--font-body1);
        font-weight: 500;
        color: var(--color-text);
        opacity: 0.75;
        text-align: left;
        margin-bottom: auto;
        max-width: 100%;
      }
    }
  }

  /* hover / focus 時圖片微放大、資訊層淡入 */

  button > figure {
    & > img {
      scale: 1.001;
      transition: scale 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }

    & > figcaption {
      opacity: 0;
      background: linear-gradient(
        to bottom,
        hsl(from var(--color-bg-card) h s l / 0.8) 0%,
        hsl(from var(--color-bg-card) h s l / 0.3) 35%,
        hsl(from var(--color-bg-card) h s l / 0.3) 65%,
        hsl(from var(--color-bg-card) h s l / 0.8) 100%
      );
      transition: opacity 0.2s;
    }
  }

  button:hover > figure {
    & > img {
      scale: 1.05;
    }

    & > figcaption {
      opacity: 1;
    }
  }

  button:focus-visible {
    outline: none;

    & > figure > img {
      scale: 1.05;
    }

    & > figure > figcaption {
      opacity: 1;
      outline: 4px solid hsl(from var(--color-ring) h s l / 0.5);
      outline-offset: -4px;
    }
  }
</style>
