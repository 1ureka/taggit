<script lang="ts">
  import { IconUpload } from "@tabler/icons-svelte";
  import { TaggerUpload } from "./taggerUpload.svelte.js";

  const ui = new TaggerUpload();
</script>

<input
  bind:this={ui.fileInputEl}
  type="file"
  accept="image/*"
  multiple
  class="visually-hidden"
  onchange={ui.handleUploadChange}
  tabindex={-1}
/>

<button class="btn btn-sm" onclick={ui.handleUploadClick} disabled={ui.pending}>
  {#if ui.pending}
    操作中...
  {:else}
    <IconUpload size={14} />
    加入圖片
  {/if}
</button>

<style>
  button.btn {
    width: 100%;
  }
</style>
