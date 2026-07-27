<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import { imgSrc } from "$lib/image/client";
  import ImageCanvas from "$lib/components/display/ImageCanvas.svelte";
  import Image from "$lib/components/display/Image.svelte";
  import CardHeader from "./CardHeader.svelte";
  import CardInfo from "./CardInfo.svelte";

  let { record }: { record: ImageWithId } = $props();

  const canvasStyle =
    "flex: 1; min-height: 0px; background: var(--color-bg); border: var(--border-style); border-radius: calc(var(--border-radius) * 1.5); background: var(--color-bg-card);";
</script>

<section aria-label={`${record.name} 的資訊卡片`}>
  <CardHeader {record} />

  <ImageCanvas resetKey={record.id} style={canvasStyle}>
    <Image src={imgSrc(record.id, "xl")} alt={record.name} preview={record} fit="contain" draggable="false" />
  </ImageCanvas>

  <CardInfo {record} />
</section>

<style>
  section {
    flex: 1 1 0;
    min-width: 320px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
</style>
