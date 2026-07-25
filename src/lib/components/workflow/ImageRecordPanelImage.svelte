<script lang="ts">
  import { imgSrc } from "$lib/image/client";
  import { IconMaximize } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";

  import ImageCanvas from "$lib/components/display/ImageCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";

  type Props = {
    /** 要呈現的圖片的檔名 */
    file: string;
    /** 打開全螢幕事件 */
    onopen: () => void;
  };

  const { file, onopen }: Props = $props();
</script>

<div>
  <ImageCanvas resetKey={file} style=" width: 100%; height: 100%;">
    <img src={imgSrc(file, "sm")} alt={file} draggable="false" />
  </ImageCanvas>
  <Button
    variant="outlined"
    padding="icon"
    aria-label="全螢幕預覽"
    onclick={onopen}
    {@attach tooltip({ content: "全螢幕預覽" })}
    style="position: absolute; right: 0.5rem; bottom: 0.5rem;"
  >
    <IconMaximize size={16} />
  </Button>
</div>

<style>
  div {
    position: relative;
    flex-shrink: 0;
    height: 220px;
    min-height: 220px;
    border-bottom: var(--border-style);
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
</style>
