<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import { imgSrc } from "$lib/image/client";
  import { IconMaximize } from "$lib/icons";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";

  import ImageCanvas from "$lib/components/display/ImageCanvas.svelte";
  import Image from "$lib/components/display/Image.svelte";
  import Button from "$lib/components/actions/Button.svelte";

  type Props = {
    /** 要呈現的圖片 */
    record: string | ImageWithId;
    /** 打開全螢幕事件 */
    onopen: () => void;
  };

  const { record, onopen }: Props = $props();

  const filename = $derived(typeof record === "string" ? record : record.id);
  const preview = $derived(typeof record === "string" ? undefined : record);
</script>

<div>
  <ImageCanvas resetKey={filename} style=" width: 100%; height: 100%;">
    <Image src={imgSrc(filename, "sm")} alt={filename} {preview} fit="contain" draggable="false" />
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
</style>
