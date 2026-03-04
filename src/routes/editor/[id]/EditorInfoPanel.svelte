<script lang="ts">
  import Rating from "$lib/components/Rating.svelte";
  import TagAutocomplete from "$lib/components/TagAutocomplete.svelte";
  import { formatDate, formatSize } from "$lib/utils.js";
  import { editStore } from "./stores.svelte.js";
  import { addTag, removeTag, removeLastTag, setRating } from "./actions.js";

  let image = $derived(editStore.image!);
  let ratingProxy = $state(editStore.currentRating);

  // Sync store → proxy
  $effect(() => {
    ratingProxy = editStore.currentRating;
  });

  // Detect user-initiated rating change from bind
  let prevProxy = editStore.currentRating;
  $effect(() => {
    if (ratingProxy !== prevProxy) {
      prevProxy = ratingProxy;
      if (ratingProxy !== editStore.currentRating) {
        setRating(ratingProxy);
      }
    }
  });
</script>

<aside class="editor-panel">
  <div class="editor-rating">
    <Rating bind:value={ratingProxy} size="1.5rem" />
  </div>
  <div class="separator"></div>

  <div class="editor-tags">
    <div class="editor-tags-list">
      {#each editStore.currentTags as tag}
        <button type="button" class="chip chip-removable" onclick={() => removeTag(tag)}>
          <span>{tag}</span>
          <span class="chip-remove">x</span>
        </button>
      {/each}
    </div>
    <div class="editor-tags-input-wrap">
      <TagAutocomplete
        allTags={editStore.allTags}
        excludedTags={editStore.currentTags}
        placeholder="輸入標籤..."
        onselect={addTag}
        onbackspace={removeLastTag}
      />
    </div>
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
    min-width: 300px;
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    border-left: 1px solid var(--border);
    background: var(--bg-card);
    overflow-y: auto;
  }

  .editor-rating {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0;
  }

  .editor-tags {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .editor-tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    max-height: 14rem;
    overflow-y: auto;
    align-content: flex-start;
  }

  .editor-tags-input-wrap {
    position: relative;
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
