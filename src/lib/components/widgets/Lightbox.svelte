<script lang="ts">
  import { imgSrc } from "$lib/image/client";
  import { IconX, IconChevronDown } from "$lib/icons";
  import ImageCanvas from "$lib/components/display/ImageCanvas.svelte";
  import Modal from "$lib/components/floating/Modal.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import Chip from "$lib/components/display/Chip.svelte";

  type Props = {
    /** 要呈現的圖片資料， */
    item: { id: string; index: number } | null; // TODO: 增加可選的 blurhash
    /** 總圖片數量 */
    total: number;
    /** 關閉對話框事件 */
    onclose: () => void;
    /** 下一張事件 */
    onnext: () => void;
    /** 上一張事件 */
    onprev: () => void;
  };

  const { item, total, onclose, onnext, onprev }: Props = $props();

  const containerStyle =
    "width: 90vw; max-width: 90vw; height: 85vh; padding: 0.75rem; display: flex; flex-direction: column;";
</script>

<Modal open={item !== null} {onclose} aria-label="圖片大圖預覽" containerProps={{ style: containerStyle }}>
  {#if item !== null}
    {@const filename = item.id}
    {@const index = item.index}
    <header>
      <span class="ellipsis" title={filename}>{filename}</span>
      <Chip variant="outlined" style="font: var(--font-caption);">{`${index} / ${total}`}</Chip>
      <Button variant="ghost" padding="icon" aria-label="關閉大圖預覽" onclick={onclose}>
        <IconX size={16} />
      </Button>
    </header>

    <div class="body">
      <ImageCanvas resetKey={filename}>
        <img src={imgSrc(filename, "xl")} alt={filename} draggable="false" />
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

  header > span.ellipsis {
    flex: 1;
    font: var(--font-body2);
    font-family: var(--font-family-mono);
    color: var(--color-text-muted);
  }

  div.body {
    position: relative;
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
</style>
