<script lang="ts">
  import { imgSrc } from "$lib/image/client";
  import { IconX, IconChevronDown } from "$lib/icons";
  import ImageCanvas from "$lib/components/display/ImageCanvas.svelte";
  import Modal from "$lib/components/floating/Modal.svelte";
  import Button from "$lib/components/actions/Button.svelte";
  import Chip from "$lib/components/display/Chip.svelte";
  import { getLightboxContext } from "../logic/lightbox.svelte";

  const lightbox = getLightboxContext();

  const containerStyle =
    "width: 90vw; max-width: 90vw; height: 85vh; padding: 0.75rem; display: flex; flex-direction: column;";
</script>

<Modal
  open={lightbox.image !== null}
  onclose={lightbox.handleClose}
  aria-label="圖片大圖預覽"
  containerProps={{ style: containerStyle }}
>
  {#if lightbox.image !== null}
    {@const filename = lightbox.image.filename}
    {@const index = lightbox.image.index}
    {@const total = lightbox.total}
    <header>
      <span class="ellipsis" title={filename}>{filename}</span>
      <Chip variant="outlined" style="font: var(--font-caption);">{`${index} / ${total}`}</Chip>
      <Button variant="ghost" padding="icon" aria-label="關閉大圖預覽" onclick={lightbox.handleClose}>
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
        onclick={lightbox.handlePrev}
        style={"position: absolute; left: 0.5rem"}
      >
        <IconChevronDown size={16} style="transform: rotate(90deg);" />
      </Button>

      <Button
        variant="ghost"
        padding="icon"
        aria-label="下一張"
        status={index >= total ? "disabled" : undefined}
        onclick={lightbox.handleNext}
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
