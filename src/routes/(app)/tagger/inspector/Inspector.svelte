<script lang="ts">
  import { imgSrc } from "$lib/image/client";
  import ImageCanvas from "$lib/components/display/ImageCanvas.svelte";

  import type { Draft } from "../logic/draft";
  import InspectorHeader from "./InspectorHeader.svelte";
  import InspectorFields from "./InspectorFields.svelte";
  import InspectorFooter from "./InspectorFooter.svelte";

  type Props = {
    /** 暫存檔案的總數量 */
    total: number;
    /** 目前正在編輯的檔案的檔案名稱 */
    file: string;
    /** 目前正在編輯的檔案的指標 */
    current: number;
    /** 目前正在編輯的檔案的草稿 */
    draft: Draft;
    /** 是否正在處理中 */
    pending: boolean;
    /** 點擊清空按紐 */
    onclear: () => void;
    /** 點擊關閉面板按紐 (退出編輯該張) */
    onclose: () => void;
  };

  let { total, current, file, draft = $bindable(), pending, onclear, onclose }: Props = $props();
</script>

<aside>
  <InspectorHeader {file} {total} {current} {onclose} />
  <ImageCanvas resetKey={file} style="height: 220px; min-height: 220px; border-bottom: var(--border-style);">
    <img src={imgSrc(file, "sm")} alt={file} draggable="false" />
  </ImageCanvas>
  <InspectorFields {file} bind:draft />
  <InspectorFooter {file} {pending} {onclear} />
</aside>

<style>
  aside {
    display: flex;
    flex-direction: column;
    width: 22rem;
    min-width: 22rem;
    border-left: var(--border-style);
    overflow-y: auto;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
</style>
