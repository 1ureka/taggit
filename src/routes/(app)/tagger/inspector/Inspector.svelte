<script lang="ts">
  import { imgSrc } from "$lib/image/client";
  import { tooltip } from "$lib/components/floating/tooltip.core.svelte";
  import { IconMaximize } from "$lib/icons";
  import ImageCanvas from "$lib/components/display/ImageCanvas.svelte";
  import Button from "$lib/components/actions/Button.svelte";

  import type { Draft } from "./draft";
  import InspectorHeader from "./InspectorHeader.svelte";
  import InspectorFields from "./InspectorFields.svelte";
  import InspectorFooter from "./InspectorFooter.svelte";

  type Props = {
    /** 暫存檔案的總數量 */
    fileCount: number;
    /** 目前正在編輯的檔案的檔案名稱 */
    activeFile: string;
    /** 目前正在編輯的檔案的指標 */
    activeIndex: number;
    /** 目前正在編輯的檔案的草稿 */
    draft: Draft;
    /** 是否正在處理中 */
    pending: boolean;
    /** 點擊清空按紐 */
    onclear: () => void;
    /** 點擊刪除按紐（含確認流程） */
    ondelete: () => void;
    /** 點擊關閉面板按紐 (退出編輯該張) */
    onclose: () => void;
    /** 點擊全螢幕預覽按紐 */
    onexpand: () => void;
  };

  let {
    fileCount,
    activeIndex,
    activeFile,
    draft = $bindable(),
    pending,
    onclear,
    ondelete,
    onclose,
    onexpand,
  }: Props = $props();
</script>

<aside>
  <InspectorHeader {activeFile} {fileCount} {activeIndex} {onclose} />

  <div class="preview">
    <ImageCanvas resetKey={activeFile} style="height: 220px; min-height: 220px; border-bottom: var(--border-style);">
      <img src={imgSrc(activeFile, "sm")} alt={activeFile} draggable="false" />
    </ImageCanvas>
    <Button
      variant="outlined"
      padding="icon"
      aria-label="全螢幕預覽"
      onclick={() => onexpand()}
      {@attach tooltip({ content: "全螢幕預覽" })}
      style="position: absolute; right: 0.5rem; bottom: 0.5rem;"
    >
      <IconMaximize size={16} />
    </Button>
  </div>

  <div class="fields">
    <InspectorFields {activeFile} bind:draft />
    <InspectorFooter {pending} {onclear} {ondelete} />
  </div>
</aside>

<style>
  aside {
    display: flex;
    flex-direction: column;
    width: 22rem;
    min-width: 22rem;
    min-height: 0;
    border-left: var(--border-style);
  }

  div.preview {
    position: relative;
    flex-shrink: 0;
  }

  div.fields {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    pointer-events: none;
  }
</style>
