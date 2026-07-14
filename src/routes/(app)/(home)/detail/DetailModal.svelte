<script lang="ts">
  import { goto } from "$app/navigation";
  import { fade } from "svelte/transition";
  import { imgSrc } from "$lib/image/client";
  import { ImageWhere } from "$lib/query-spec";
  import type { ImageWithId } from "$lib/database";

  import { IconX, IconEditFilled } from "$lib/icons";
  import { Modal } from "$lib/components/floating/modal.core.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import ButtonLink from "$lib/components/actions/ButtonLink.svelte";
  import Rating from "$lib/components/inputs/Rating.svelte";
  import BlurImage from "$lib/widgets/BlurImage.svelte";
  import TagChips from "$lib/widgets/TagChips.svelte";

  // TODO: 該組件完全過時，請不要參考，待重新設計，未來 home 會希望也有自己的 Carousels 型態，而不是只是單張打開

  type Props = {
    /** 目前顯示的圖片紀錄；null 代表關閉 */
    record: ImageWithId | null;
    /** 前往 editor 的連結（帶當下篩選參數） */
    editorHref: string;
    /** 關閉請求（backdrop 點擊、Escape、關閉鈕） */
    onclose: () => void;
  };

  let { record, editorHref, onclose }: Props = $props();

  const open = $derived(record !== null);

  // 離場動畫期間 record 已為 null，保留最後一筆供渲染
  let shown = $state<ImageWithId | null>(null);
  $effect.pre(() => {
    if (record) shown = record;
  });

  const modal = new Modal({
    get open() {
      return open;
    },
    get onclose() {
      return onclose;
    },
  });

  const handleTagSelect = (name: string) => {
    goto(`/?${new ImageWhere({ includedTags: [name] }).toSearchParams()}`);
  };
</script>

<dialog
  bind:this={modal.dialogEl}
  data-open={open}
  aria-label="圖片詳細資訊"
  onclick={modal.handleClick}
  oncancel={modal.handleCancel}
>
  {#if open && shown}
    <div class="viewport" in:fade={{ duration: 150 }} out:fade={{ duration: 150 }} onoutroend={modal.handleOutroEnd}>
      <article>
        <header>
          <Button variant="ghost" padding="icon" aria-label="關閉圖片詳細資訊" onclick={onclose}>
            <IconX size={16} />
          </Button>

          <h2 class="ellipsis">{shown.name}</h2>

          <ButtonLink variant="primary" padding="sm" href={editorHref}>
            <IconEditFilled size={16} />
            <span>編輯</span>
          </ButtonLink>
        </header>

        <div class="image-wrapper">
          <BlurImage
            src={imgSrc(shown.id, "xl")}
            alt={shown.name}
            preview={{ blurhash: shown.blurhash, width: shown.width, height: shown.height }}
            decoding="async"
          />

          <img class="blur-spread" aria-hidden="true" src={imgSrc(shown.id, "md")} alt="" decoding="async" />
        </div>

        <footer>
          <Rating value={shown.rating} readonly />
          <TagChips tags={shown.tags} nowrap onselect={handleTagSelect} />
        </footer>
      </article>
    </div>
  {/if}
</dialog>

<style>
  dialog {
    position: fixed;
    inset: 0;
    width: 100dvw;
    height: 100dvh;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: none;
    outline: none;
    background: transparent;
    overflow: visible;
  }

  dialog::backdrop {
    background: transparent;
  }

  dialog > .viewport {
    width: 100%;
    height: 100%;
    background: hsl(from var(--color-bg) h s l / 0.8);
    backdrop-filter: blur(8px);
    /* 讓空白處的點擊落到 dialog 本身（= backdrop 關閉），互動元素各自恢復 pointer-events */
    pointer-events: none;
  }

  article {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: 100%;
    height: 100%;

    & > header,
    & > footer {
      padding: 0.75rem 1.5rem;
      @media (max-width: 600px) {
        padding: 0.75rem;
      }
    }
  }

  article > header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 1rem;

    & > :global(*) {
      pointer-events: auto;
    }

    & > :global(button) {
      justify-self: start;
    }

    & > :global(a) {
      justify-self: end;
    }

    & > h2 {
      font: var(--font-title2);
      font-weight: normal;
      opacity: 0.75;
      pointer-events: none;
    }
  }

  article > footer {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;

    & > :global(*) {
      pointer-events: auto;
    }
  }

  article > .image-wrapper {
    padding: 0px 0.75rem;
    flex: 1;
    min-height: 0;
    display: grid;
    place-items: center;
    position: relative;

    & > :global(img) {
      max-width: 100%;
      max-height: 100%;
      min-width: 0;
      min-height: 0;
      border-radius: var(--border-radius);
      pointer-events: auto;
    }

    & > :global(img:not(.blur-spread)) {
      box-shadow: 0 0 10px var(--color-bg);
    }

    & > .blur-spread {
      position: absolute;
      filter: blur(30px);
      z-index: -1;
      pointer-events: none;
    }
  }
</style>
