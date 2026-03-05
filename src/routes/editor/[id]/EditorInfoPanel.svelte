<script lang="ts">
  import Rating from "$lib/components/Rating.svelte";
  import TagAutocompleteNew from "$lib/components/TagAutocompleteNew.svelte";
  import { formatDate, formatSize } from "$lib/utils.js";
  import { editStore } from "./stores.svelte.js";
  import { markDirty } from "./actions.js";

  let image = $derived(editStore.image!);
</script>

<aside class="editor-panel">
  <div class="editor-rating">
    <Rating bind:value={editStore.currentRating} size="1.5rem" onchange={markDirty} />
  </div>
  <div class="separator"></div>

  <div class="editor-tags">
    <TagAutocompleteNew
      bind:tags={editStore.currentTags}
      variant="top"
      placeholder="輸入標籤..."
      onchange={markDirty}
    />
  </div>

  <div class="separator"></div>

  <div class="editor-meta">
    <span class="editor-meta-label">ID</span>
    <span class="editor-meta-value mono">{image.id}</span>

    <span class="editor-meta-label">原始檔名</span>
    <span class="editor-meta-value">{image.originalName || "—"}</span>

    <span class="editor-meta-label">檔案名稱</span>
    <span class="editor-meta-value mono">{image.id}{image.ext}</span>

    <span class="editor-meta-label">提交時間</span>
    <span class="editor-meta-value">{image.committedAt ? formatDate(image.committedAt) : "—"}</span>

    <span class="editor-meta-label">檔案大小</span>
    <span class="editor-meta-value">{image.fileSize ? formatSize(image.fileSize) : "—"}</span>

    {#if image.width && image.height}
      <span class="editor-meta-label">解析度</span>
      <span class="editor-meta-value">{image.width} × {image.height}</span>
    {/if}
  </div>
</aside>

<style>
  .editor-panel {
    width: 300px;
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    border-left: 1px solid var(--border);
    background: var(--bg-card);
  }

  .editor-rating {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0;
  }

  .editor-tags {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .editor-meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 0.75rem;
    font-size: 0.75rem;
  }

  .editor-meta-label {
    color: var(--text-dim);
    white-space: nowrap;
  }

  .editor-meta-value {
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .editor-meta-value.mono {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
  }

  /* ─── Mobile ─────────────────────────────────────────────────────────── */

  @media (max-width: 768px) {
    .editor-panel {
      width: 100%;
      min-width: 0;
      max-height: 50vh;
      border-left: none;
      border-top: 1px solid var(--border);
    }
  }
</style>
