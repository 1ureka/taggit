<script lang="ts">
  import { IconUpload } from "@tabler/icons-svelte";
  import { createTaggerUpload } from "./taggerUpload.svelte.js";

  type Props = {
    loading: boolean;
  };

  let { loading = $bindable() }: Props = $props();

  const ui = createTaggerUpload({
    get loading() {
      return loading;
    },
    set loading(v) {
      loading = v;
    },
  });
</script>

<div class="tagger-sidebar-footer">
  <input
    bind:this={ui.fileInputEl}
    type="file"
    accept="image/*"
    multiple
    class="visually-hidden"
    onchange={ui.handleUploadChange}
    tabindex={-1}
  />
  <button class="btn btn-sm tagger-upload-btn" onclick={ui.handleUploadClick} disabled={ui.loading}>
    <IconUpload size={14} />
    加入圖片
  </button>
</div>

<style>
  .tagger-sidebar-footer {
    padding: 0.5rem 0.75rem;
    border-top: 1px solid var(--border);
  }

  .tagger-upload-btn {
    width: 100%;
  }
</style>
