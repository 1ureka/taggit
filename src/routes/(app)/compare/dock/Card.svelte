<script lang="ts">
  import type { ImageWithId } from "$lib/database";
  import { imgSrc } from "$lib/image/client";
  import ImageCanvas from "$lib/components/display/ImageCanvas.svelte";
  import CardHeader from "./CardHeader.svelte";
  import CardInfo from "./CardInfo.svelte";

  type Props = {
    /** 卡片顯示的圖片紀錄 */
    record: ImageWithId;
    /** 全頁共用的操作鎖 */
    pending: boolean;
    /** 取消釘選（自畫布移除） */
    onunpin: () => void;
    /** 取消提交（退回暫存區） */
    onrevert: () => void;
  };

  let { record, pending, onunpin, onrevert }: Props = $props();
</script>

<section aria-label={`${record.name} 的資訊卡片`}>
  <CardHeader {record} {onunpin} />

  <ImageCanvas resetKey={record.id} style="flex: 1; min-height: 0px; background: var(--color-bg);">
    <img src={imgSrc(record.id, "xl")} alt={record.name} draggable="false" />
  </ImageCanvas>

  <CardInfo {record} {pending} {onrevert} />
</section>

<style>
  section {
    flex: 1 1 0;
    min-width: 320px;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-card);
    border: var(--border-style);
    border-radius: calc(var(--border-radius) * 2);
    overflow: hidden;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
</style>
