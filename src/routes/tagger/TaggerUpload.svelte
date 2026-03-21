<script lang="ts">
  import { IconUpload } from "@tabler/icons-svelte";
  import { TaggerUpload } from "./taggerUpload.svelte.js";

  const ui = new TaggerUpload();
</script>

<label class="btn" class:pending={ui.pending}>
  {#if ui.pending}
    操作中...
  {:else}
    <IconUpload size={14} />
    加入圖片
  {/if}

  <input
    type="file"
    accept="image/*"
    multiple
    class="visually-hidden"
    onchange={ui.handleUploadChange}
    disabled={ui.pending}
  />
</label>

<style>
  label.btn {
    width: 100%;

    &.pending {
      opacity: 0.5;
      pointer-events: none;
    }
  }
</style>
