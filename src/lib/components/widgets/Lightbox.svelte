<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import { imgSrc } from "$lib/image/client";

  import { IconX, IconChevronDown } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import ImageCanvas from "$lib/components/display/ImageCanvas.svelte";
  import Image from "$lib/components/display/Image.svelte";
  import Modal from "$lib/components/floating/Modal.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import Chip from "$lib/components/display/Chip.svelte";

  type Props = {
    /** 要呈現的圖片資料， */
    item: { id: string; index: number; record?: ImageWithId } | null; // TODO: 增加可選的 blurhash
    /** 總圖片數量 */
    total: number;
    /** 關閉對話框事件 */
    onclose: () => void;
    /** 下一張事件 */
    onnext: () => void;
    /** 上一張事件 */
    onprev: () => void;
    /** 點擊檔名事件，未提供時檔名維持純文字 */
    onclickname?: (filename: string) => void;
  };

  const { item, total, onclose, onnext, onprev, onclickname }: Props = $props();

  const containerStyle =
    "width: 90vw; max-width: 90vw; height: 85vh; padding: 0.75rem; display: flex; flex-direction: column;";
</script>

<Modal open={item !== null} {onclose} aria-label="圖片大圖預覽" containerProps={{ style: containerStyle }}>
  {#if item !== null}
    {@const filename = item.id}
    {@const index = item.index}
    <header>
      {#if onclickname}
        {@const label = `繼續編輯 ${filename}`}
        <button
          type="button"
          class="name ellipsis"
          aria-label={label}
          {@attach tooltip({ content: label, placement: "bottom-start" })}
          onclick={() => onclickname(filename)}
        >
          {filename}
        </button>
      {:else}
        <span class="name ellipsis" title={filename}>{filename}</span>
      {/if}
      <Chip variant="outlined" style="font: var(--font-caption);">{`${index} / ${total}`}</Chip>
      <Button variant="ghost" padding="icon" aria-label="關閉大圖預覽" onclick={onclose}>
        <IconX size={16} />
      </Button>
    </header>

    <div class="body">
      <ImageCanvas resetKey={filename}>
        <Image src={imgSrc(filename, "xl")} alt={filename} preview={item.record} fit="contain" draggable="false" />
      </ImageCanvas>

      <Button
        variant="ghost"
        padding="icon"
        aria-label="上一張"
        status={index <= 1 ? "disabled" : undefined}
        onclick={onprev}
        style={"position: absolute; left: 0.5rem"}
      >
        <IconChevronDown size={16} style="transform: rotate(90deg);" />
      </Button>

      <Button
        variant="ghost"
        padding="icon"
        aria-label="下一張"
        status={index >= total ? "disabled" : undefined}
        onclick={onnext}
        style={"position: absolute; right: 0.5rem"}
      >
        <IconChevronDown size={16} style="transform: rotate(-90deg);" />
      </Button>
    </div>
  {/if}
</Modal>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-bottom: 0.5rem;
  }

  header > .name {
    flex: 1;
    font: var(--font-body2);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }

  header > button.name {
    text-align: left;
    text-decoration-line: underline;
    text-decoration-color: transparent;
    text-underline-offset: 2px;
    transition: text-decoration-color 0.15s ease;

    &:hover {
      text-decoration-color: var(--color-text-muted);
    }
  }

  div.body {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
  }
</style>
