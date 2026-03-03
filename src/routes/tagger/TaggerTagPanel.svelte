<script lang="ts">
  import { IconClipboard, IconCheck, IconTrash } from "@tabler/icons-svelte";
  import Rating from "$lib/components/Rating.svelte";
  import TagAutocomplete from "$lib/components/TagAutocomplete.svelte";
  import { addToast } from "$lib/stores/toast.js";
  import type { TagInfo } from "$lib/types.js";

  let {
    allTags,
    currentTags = $bindable([]),
    currentRating = $bindable(0),
    oncommit,
    ontrash,
    oncopyprevious,
  }: {
    allTags: TagInfo[];
    currentTags: string[];
    currentRating: number;
    oncommit: () => void;
    ontrash: () => void;
    oncopyprevious: () => void;
  } = $props();

  function addTag(rawTag: string) {
    const tag = rawTag.trim().toLowerCase();
    if (!tag) return;
    if (currentTags.includes(tag)) {
      addToast("標籤已存在", "info");
      return;
    }
    currentTags = [...currentTags, tag];
  }

  function removeTag(tag: string) {
    currentTags = currentTags.filter((t) => t !== tag);
  }

  function removeLastTag() {
    if (currentTags.length > 0) {
      currentTags = currentTags.slice(0, -1);
    }
  }

  /** Focus the tag input programmatically (called from parent keyboard handler). */
  export function focusInput() {
    (document.querySelector(".tagger-tags-input-wrap input") as HTMLInputElement)?.focus();
  }
</script>

<aside class="tagger-panel">
  <div class="tagger-rating">
    <Rating bind:value={currentRating} size="1.5rem" />
  </div>
  <div class="separator"></div>

  <div class="tagger-tags">
    <div class="tagger-tags-list">
      {#each currentTags as tag}
        <button type="button" class="chip chip-removable" onclick={() => removeTag(tag)}>
          <span>{tag}</span>
          <span class="chip-remove">x</span>
        </button>
      {/each}
    </div>
    <div class="tagger-tags-input-wrap">
      <TagAutocomplete
        {allTags}
        excludedTags={currentTags}
        placeholder="輸入標籤..."
        onselect={addTag}
        {oncommit}
        onbackspace={removeLastTag}
      />
    </div>
  </div>

  <div class="separator"></div>

  <div class="tagger-actions">
    <button class="btn btn-sm" onclick={oncopyprevious} title="複製上一張標籤">
      <IconClipboard size={16} />
      複製上一張
    </button>
    <button class="btn btn-primary btn-sm" onclick={oncommit}>
      <IconCheck size={16} />
      提交
    </button>
    <button class="btn btn-destructive btn-sm" onclick={ontrash}>
      <IconTrash size={16} />
      刪除
    </button>
  </div>

  <div class="separator"></div>

  <div class="tagger-shortcuts">
    <div>
      <div><span class="kbd">←</span><span class="kbd">→</span></div>
      切換圖片
    </div>
    <div>
      <div><span class="kbd">1</span>-<span class="kbd">5</span></div>
      評等
    </div>
    <div>
      <div><span class="kbd">T</span></div>
      聚焦標籤
    </div>
    <div>
      <div><span class="kbd">C</span></div>
      複製標籤
    </div>
    <div>
      <div><span class="kbd">Enter</span></div>
      提交
    </div>
  </div>
</aside>

<style>
  .tagger-panel {
    width: 280px;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    border-left: 1px solid var(--border);
    background: var(--bg-card);
    overflow-y: auto;
  }

  .tagger-rating {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem 0;
  }

  .tagger-tags {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .tagger-tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
    max-height: 12rem;
    overflow-y: auto;
    align-content: flex-start;
  }

  .tagger-tags-input-wrap {
    position: relative;
  }

  .tagger-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .tagger-actions :global(.btn) {
    flex: 1;
    min-width: 0;
  }

  .tagger-shortcuts {
    display: grid;
    grid-template-columns: max-content 1fr max-content 1fr;
    gap: 0.25rem 2rem;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  .tagger-shortcuts > div {
    grid-column: span 2;
    display: grid;
    grid-template-columns: subgrid;
    align-items: center;
    gap: 0.25rem;
  }

  /* ─── Mobile ─────────────────────────────────────────────────────────── */

  @media (max-width: 768px) {
    .tagger-panel {
      width: 100%;
      min-width: 0;
      max-height: 40vh;
      border-left: none;
      border-top: 1px solid var(--border);
      overflow-y: auto;
    }

    .tagger-shortcuts {
      display: none;
    }
  }
</style>
